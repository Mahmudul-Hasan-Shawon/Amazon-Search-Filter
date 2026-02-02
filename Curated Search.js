// ==UserScript==
// @name         NDLE – Amazon Curated Results with Independent Toggles
// @namespace    ndle.amazon.ui.toggles
// @version      2.8
// @description  NDLE: Filter Budget / Value / Premium independently with toggles
// @match        https://www.amazon.com/s*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ---------------- STATE ----------------
    let toggleBudget = true;
    let toggleValue = true;
    let togglePremium = true;
    let panelVisible = false;

    let curatedResults = [];
    let originalDisplay = new Map();
    let checkInterval = null;
    let uiInjected = false;

    let status = {
        budget: 0,
        value: 0,
        premium: 0
    };

    // ---------------- HELPERS ----------------
    function getResults() {
        return Array.from(
            document.querySelectorAll('div[data-component-type="s-search-result"]')
        );
    }

    function hasText(el, words) {
        const t = el.innerText.toLowerCase();
        return words.some(w => t.includes(w.toLowerCase()));
    }

    function getRating(el) {
        // Method 1: Try to get rating from aria-label in the new structure
        const starRating = el.querySelector('.a-icon-alt, [aria-label*="out of 5 stars"]');
        if (starRating) {
            const ariaLabel = starRating.getAttribute('aria-label') || starRating.textContent || '';
            const match = ariaLabel.match(/(\d+\.?\d*)\s*out of 5 stars/);
            if (match) {
                return parseFloat(match[1]);
            }
        }

        // Method 2: Try to get rating from the visible text (like "4.5")
        const ratingText = el.querySelector('.a-size-small.a-color-base, .a-size-base.a-color-base');
        if (ratingText) {
            const text = ratingText.textContent.trim();
            const match = text.match(/(\d+\.?\d*)/);
            if (match) {
                return parseFloat(match[1]);
            }
        }

        // Method 3: Try to get from star mini icon classes
        const starIcon = el.querySelector('.a-icon-star-mini');
        if (starIcon) {
            const classList = starIcon.className;
            const match = classList.match(/a-star-mini-(\d+\.?\d*)/);
            if (match) {
                return parseFloat(match[1]);
            }
        }

        return 0;
    }

    function isAmazonBasics(el) {
        // Check for Amazon Basics in title
        const titleEl = el.querySelector('h2.a-size-base-plus, h2.a-size-medium, .a-text-normal');
        if (titleEl && titleEl.innerText.toLowerCase().includes('amazon basics')) {
            return true;
        }

        // Check for Amazon Basics badge
        const badgeEl = el.querySelector('.a-badge-label');
        if (badgeEl && badgeEl.innerText.toLowerCase().includes('amazon basics')) {
            return true;
        }

        return false;
    }

    function isAmazonChoice(el) {
        // Method 1: Check for specific Amazon's Choice badge structure
        const choiceSpan = el.querySelector('.mvt-ac-badge-rectangle, .ac-badge-rectangle, [class*="ac-badge"]');
        if (choiceSpan) {
            const choiceText = choiceSpan.textContent || '';
            if (choiceText.includes("Amazon's Choice") || choiceText.includes("Amazons Choice")) {
                return true;
            }
        }

        // Method 2: Check for data-action attribute (as shown in your HTML)
        const declarativeEl = el.querySelector('[data-action="a-popover"][data-a-popover*="amazons-choice"]');
        if (declarativeEl) {
            return true;
        }

        // Method 3: Check for specific text in span elements
        const spans = el.querySelectorAll('span.a-size-small, span.a-size-mini');
        for (const span of spans) {
            const text = span.textContent || '';
            if (text.includes("Amazon's Choice") || text.includes("Amazons Choice")) {
                return true;
            }
        }

        // Method 4: Fallback to text search
        return hasText(el, ["amazon's choice", "amazons choice"]);
    }

    function isBestSeller(el) {
        // Method 1: Check for Best Seller badge classes
        const bestSellerSpan = el.querySelector('.sb_3PpUJm, .sb_BP8-Bh, [class*="best-seller"]');
        if (bestSellerSpan) {
            const badgeText = bestSellerSpan.textContent || '';
            if (badgeText.includes('Best Seller') || badgeText.includes('#1 Best Seller')) {
                return true;
            }
        }

        // Method 2: Check for aria-label attribute
        const bestSellerBadge = el.querySelector('span[aria-label*="Best Seller"], span[aria-label*="Best Seller"]');
        if (bestSellerBadge) {
            const ariaLabel = bestSellerBadge.getAttribute('aria-label') || '';
            if (ariaLabel.includes('Best Seller')) {
                return true;
            }
        }

        // Method 3: Check for badge text
        const badges = el.querySelectorAll('.a-badge-text, .s-badge-text, .sb_BP8-Bh');
        for (const badge of badges) {
            const text = badge.textContent || '';
            if (text.includes('Best Seller') || text.includes('#1 Best Seller')) {
                return true;
            }
        }

        // Method 4: Check text content
        return hasText(el, ["best seller", "#1 best seller"]);
    }

    function isBestDeal(el) {
        // Method 1: Check for Best Deal badges
        const dealBadge = el.querySelector('.sb_2pRjVF, .sb_2PjsX9, [class*="deal-badge"]');
        if (dealBadge) {
            const badgeText = dealBadge.textContent || '';
            if (badgeText.includes('Best Deal') || badgeText.includes('Best Value') || badgeText.includes('Deal')) {
                return true;
            }
        }

        // Method 2: Fallback to text search
        return hasText(el, ["best deal", "best value", "deal of the day", "limited time deal"]);
    }

    // ---------------- CURATION ----------------
    function curate() {
        const results = getResults();
        if (!results.length) return;

        curatedResults = [];
        status = { budget: 0, value: 0, premium: 0 };

        // Track which results are in each category
        const budgetResults = new Set();
        const valueResults = new Set();
        const premiumResults = new Set();

        results.forEach(r => {
            // Debug: Log each product's details
            const title = r.querySelector('h2')?.textContent?.substring(0, 50) || 'No title';
            const rating = getRating(r);

            // Budget category
            const isBudget = isAmazonChoice(r) || isAmazonBasics(r);
            if (toggleBudget && isBudget) {
                budgetResults.add(r);
                status.budget++;
                console.log(`📦 Budget item found: "${title}"`);
            }

            // Value category
            const isValue = isBestDeal(r) || isBestSeller(r);
            if (toggleValue && isValue) {
                valueResults.add(r);
                status.value++;
                const type = isBestSeller(r) ? 'Best Seller' : 'Best Deal';
                console.log(`🔥 Value item found (${type}): "${title}"`);
            }

            // Premium category (4.8 to 5.0 only)
            const isPremium = rating >= 4.8 && rating <= 5.0;
            if (togglePremium && isPremium) {
                premiumResults.add(r);
                status.premium++;
                console.log(`⭐ Premium item found (${rating} stars): "${title}"`);
            }
        });

        // Combine results
        const combinedSet = new Set();
        if (toggleBudget) budgetResults.forEach(r => combinedSet.add(r));
        if (toggleValue) valueResults.forEach(r => combinedSet.add(r));
        if (togglePremium) premiumResults.forEach(r => combinedSet.add(r));

        // If no badges found in active categories, show first 3 results
        if (combinedSet.size === 0 && results.length > 0) {
            console.log('ℹ️ No badges found, showing first 3 results');
            curatedResults = results.slice(0, 3);
        } else {
            curatedResults = Array.from(combinedSet);
        }

        // Log summary
        console.log('🎯 NDLE Summary:', {
            totalResults: results.length,
            budget: status.budget,
            value: status.value,
            premium: status.premium,
            curated: curatedResults.length
        });
    }

    // ---------------- APPLY FILTER ----------------
    function applyNDLE() {
        const results = getResults();
        if (results.length === 0) return;

        curate();

        results.forEach(r => {
            if (!originalDisplay.has(r)) {
                originalDisplay.set(r, r.style.display);
            }
            r.style.display = curatedResults.includes(r) ? '' : 'none';
        });

        // Only show banner if NO badges were found (showing first 3 results)
        const showBanner = status.budget === 0 && status.value === 0 && status.premium === 0;
        if (showBanner) {
            injectBanner(results.length);
        } else {
            removeBanner();
        }

        updateStatusUI();
    }

    // ---------------- BANNER ----------------
    function injectBanner(total) {
        removeBanner();
        const banner = document.createElement('div');
        banner.id = 'ndle-banner';
        banner.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    🛡️ <strong>NDLE Smart Selection:</strong>
                    No badges found, showing top 3 products
                </div>
                <div style="font-size: 12px; color: #4b5563;">
                    ${curatedResults.length} of ${total} shown
                </div>
            </div>
        `;

        banner.style.cssText = `
            background: linear-gradient(135deg, rgba(236, 253, 245, 0.9) 0%, rgba(209, 250, 229, 0.9) 100%) !important;
            color: #065f46 !important;
            padding: 16px 24px !important;
            margin: 20px 0 !important;
            border-radius: 12px !important;
            border: 2px solid #10b981 !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15) !important;
            z-index: 2147483646 !important;
            position: relative !important;
            backdrop-filter: blur(8px) !important;
            -webkit-backdrop-filter: blur(8px) !important;
        `;

        const slot = document.querySelector('.s-main-slot, .s-search-results, #search');
        if (slot) {
            slot.insertBefore(banner, slot.firstChild);
        } else {
            // Fallback: insert at top of body
            document.body.insertBefore(banner, document.body.firstChild);
        }
    }

    function removeBanner() {
        const b = document.getElementById('ndle-banner');
        if (b) b.remove();
    }

    // ---------------- TOGGLE BUTTON ----------------
    function createToggleButton() {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'ndle-toggle-btn';
        toggleBtn.innerHTML = '🛡️ NDLE';
        toggleBtn.title = 'Toggle NDLE Curator Panel';

        toggleBtn.style.cssText = `
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            width: 60px !important;
            height: 60px !important;
            border-radius: 50% !important;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
            color: white !important;
            border: none !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4) !important;
            z-index: 2147483646 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            backdrop-filter: blur(10px) !important;
            -webkit-backdrop-filter: blur(10px) !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
        `;

        toggleBtn.addEventListener('click', togglePanel);
        toggleBtn.addEventListener('mouseenter', () => {
            toggleBtn.style.transform = 'scale(1.1)';
            toggleBtn.style.boxShadow = '0 6px 25px rgba(16, 185, 129, 0.6)';
        });
        toggleBtn.addEventListener('mouseleave', () => {
            if (!panelVisible) {
                toggleBtn.style.transform = 'scale(1)';
                toggleBtn.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
            }
        });

        document.body.appendChild(toggleBtn);
        return toggleBtn;
    }

    // ---------------- PANEL FUNCTIONS ----------------
    function showPanel() {
        const panel = document.getElementById('ndle-ui');
        const toggleBtn = document.getElementById('ndle-toggle-btn');

        if (!panel || !toggleBtn) return;

        panelVisible = true;

        // Hide toggle button
        toggleBtn.style.opacity = '0';
        toggleBtn.style.transform = 'scale(0.5)';
        toggleBtn.style.pointerEvents = 'none';

        // Show panel with animation
        panel.style.display = 'block';
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(20px) scale(0.95)';

        // Animate panel in
        setTimeout(() => {
            panel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0) scale(1)';
        }, 10);
    }

    function hidePanel() {
        const panel = document.getElementById('ndle-ui');
        const toggleBtn = document.getElementById('ndle-toggle-btn');

        if (!panel || !toggleBtn) return;

        panelVisible = false;

        // Animate panel out
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(20px) scale(0.95)';

        setTimeout(() => {
            panel.style.display = 'none';

            // Show toggle button
            toggleBtn.style.opacity = '1';
            toggleBtn.style.transform = 'scale(1)';
            toggleBtn.style.pointerEvents = 'auto';
            toggleBtn.style.boxShadow = '0 4px 20px rgba(16, 185, 129, 0.4)';
        }, 300);
    }

    function togglePanel() {
        if (panelVisible) {
            hidePanel();
        } else {
            showPanel();
        }
    }

    // ---------------- UI PANEL ----------------
    function injectUI() {
        if (uiInjected) return;

        // Remove existing UI if present
        const existingUI = document.getElementById('ndle-ui');
        if (existingUI) existingUI.remove();

        const existingBtn = document.getElementById('ndle-toggle-btn');
        if (existingBtn) existingBtn.remove();

        // Create toggle button first
        createToggleButton();

        // Create main panel (initially hidden)
        const panel = document.createElement('div');
        panel.id = 'ndle-ui';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="ndle-header">
                <span>🛡️ NDLE Curator</span>
                <button id="ndle-close" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:0;margin-left:auto;">×</button>
            </div>
            <div class="ndle-toggle">
                <div class="ndle-toggle-label">
                    <span class="ndle-icon">💰</span>
                    <span class="ndle-category">Budget</span>
                    <span class="ndle-count" id="budget-count">0</span>
                </div>
                <label class="ndle-switch">
                    <input type="checkbox" ${toggleBudget ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="ndle-toggle">
                <div class="ndle-toggle-label">
                    <span class="ndle-icon">🔥</span>
                    <span class="ndle-category">Value</span>
                    <span class="ndle-count" id="value-count">0</span>
                </div>
                <label class="ndle-switch">
                    <input type="checkbox" ${toggleValue ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="ndle-toggle">
                <div class="ndle-toggle-label">
                    <span class="ndle-icon">⭐</span>
                    <span class="ndle-category">Premium</span>
                    <span class="ndle-count" id="premium-count">0</span>
                </div>
                <label class="ndle-switch">
                    <input type="checkbox" ${togglePremium ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="ndle-footer">
                <div id="ndle-total">Curated: 0 products</div>
                <div class="ndle-hint">Click toggles to filter</div>
            </div>
        `;

        // Add styles with backdrop blur
        const style = document.createElement('style');
        style.id = 'ndle-styles';
        style.textContent = `
            #ndle-ui {
                position: fixed !important;
                bottom: 20px !important;
                right: 20px !important;
                width: 280px !important;
                background: rgba(255, 255, 255, 0) !important;
                border-radius: 16px !important;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3) !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                z-index: 2147483647 !important;
                border: 1px solid rgba(229, 231, 235, 0.8) !important;
                overflow: hidden !important;
                backdrop-filter: blur(5px)!important;
                -webkit-backdrop-filter: blur(5px)!important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }

            #ndle-ui::before {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.9) 100%) !important;
                border-radius: 16px !important;
                z-index: -1 !important;
            }

            .ndle-header {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%) !important;
                color: white !important;
                padding: 16px !important;
                font-size: 16px !important;
                font-weight: 600 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
            }

            .ndle-toggle {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 14px 16px !important;
                border-bottom: 1px solid rgba(243, 244, 246, 0.8) !important;
                transition: all 0.2s ease !important;
            }

            .ndle-toggle:hover {
                background-color: rgba(249, 250, 251, 0.8) !important;
            }

            .ndle-toggle-label {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
                font-size: 14px !important;
            }

            .ndle-icon {
                font-size: 18px !important;
                filter: drop-shadow(0 2px 3px rgba(0,0,0,0.1)) !important;
            }

            .ndle-category {
                font-weight: 600 !important;
                color: #1f2937 !important;
                text-shadow: 0 1px 1px rgba(255,255,255,0.8) !important;
            }

            .ndle-count {
                background: rgba(243, 244, 246, 0.9) !important;
                color: #6b7280 !important;
                padding: 4px 10px !important;
                border-radius: 12px !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                min-width: 30px !important;
                text-align: center !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                border: 1px solid rgba(209, 213, 219, 0.6) !important;
                box-shadow: inset 0 1px 2px rgba(0,0,0,0.05) !important;
            }

            .ndle-footer {
                padding: 14px 16px !important;
                text-align: center !important;
                background: rgba(249, 250, 251, 0.9) !important;
                font-size: 12px !important;
                color: #4b5563 !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                border-top: 1px solid rgba(243, 244, 246, 0.8) !important;
            }

            .ndle-hint {
                font-size: 10px !important;
                color: #9ca3af !important;
                margin-top: 4px !important;
            }

            .ndle-switch {
                position: relative !important;
                width: 44px !important;
                height: 24px !important;
                display: inline-block !important;
            }

            .ndle-switch input {
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
            }

            .slider {
                position: absolute !important;
                cursor: pointer !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background-color: rgba(209, 213, 219, 0.9) !important;
                border-radius: 34px !important;
                transition: .4s !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                border: 1px solid rgba(156, 163, 175, 0.4) !important;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.1) !important;
            }

            .slider:before {
                position: absolute !important;
                content: "" !important;
                height: 18px !important;
                width: 18px !important;
                left: 3px !important;
                bottom: 3px !important;
                background-color: white !important;
                border-radius: 50% !important;
                transition: .4s !important;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                border: 1px solid rgba(0,0,0,0.1) !important;
            }

            input:checked + .slider {
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%) !important;
            }

            input:checked + .slider:before {
                transform: translateX(20px) !important;
            }

            #ndle-banner {
                z-index: 2147483645 !important;
            }
        `;

        // Remove existing styles
        const existingStyles = document.getElementById('ndle-styles');
        if (existingStyles) existingStyles.remove();

        // Append to document
        document.head.appendChild(style);
        document.body.appendChild(panel);
        uiInjected = true;

        // Add event listeners
        const closeBtn = panel.querySelector('#ndle-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                hidePanel();
            });
        }

        const toggles = panel.querySelectorAll('input');
        toggles[0].addEventListener('change', e => {
            toggleBudget = e.target.checked;
            applyNDLE();
        });
        toggles[1].addEventListener('change', e => {
            toggleValue = e.target.checked;
            applyNDLE();
        });
        toggles[2].addEventListener('change', e => {
            togglePremium = e.target.checked;
            applyNDLE();
        });

        // Make panel draggable
        makeDraggable(panel.querySelector('.ndle-header'), panel);

        updateStatusUI();
    }

    function makeDraggable(handle, element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.style.cursor = 'move';

        handle.addEventListener('mousedown', dragMouseDown);

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.addEventListener('mouseup', closeDragElement);
            document.addEventListener('mousemove', elementDrag);
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }

        function closeDragElement() {
            document.removeEventListener('mouseup', closeDragElement);
            document.removeEventListener('mousemove', elementDrag);
        }
    }

    function updateStatusUI() {
        // Update counts
        const budgetCount = document.getElementById('budget-count');
        const valueCount = document.getElementById('value-count');
        const premiumCount = document.getElementById('premium-count');
        const totalEl = document.getElementById('ndle-total');

        if (budgetCount) budgetCount.textContent = status.budget;
        if (valueCount) valueCount.textContent = status.value;
        if (premiumCount) premiumCount.textContent = status.premium;
        if (totalEl) totalEl.textContent = `Curated: ${curatedResults.length} products`;
    }

    // ---------------- INTERVAL CHECK ----------------
    function startProductCheck() {
        let productsLoaded = false;
        let checkCount = 0;
        const maxChecks = 30; // Max 30 seconds of checking

        checkInterval = setInterval(() => {
            const results = getResults();

            if (results.length > 0) {
                productsLoaded = true;

                // Apply filtering once we have products
                if (!uiInjected) {
                    injectUI();
                }

                applyNDLE();

                // Stop checking after 2 seconds of stable results
                checkCount++;
                if (checkCount > 2) {
                    clearInterval(checkInterval);
                    console.log('✅ NDLE: Products loaded, stopped interval check');
                }
            } else if (checkCount >= maxChecks) {
                // Stop checking after max attempts
                clearInterval(checkInterval);
                console.log('⚠️ NDLE: Max checks reached, no products found');
            } else {
                checkCount++;
            }
        }, 1000); // Check every second
    }

    // ---------------- INIT ----------------
    function init() {
        console.log('🚀 NDLE script loading...');

        // Start checking for products
        startProductCheck();

        // Also check when user navigates (like clicking next page)
        window.addEventListener('popstate', () => {
            // Reset state for new page
            curatedResults = [];
            originalDisplay.clear();
            uiInjected = false;

            // Restart product check
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            startProductCheck();
        });

        // Check for AJAX navigation (Amazon uses this)
        const originalPushState = history.pushState;
        history.pushState = function() {
            originalPushState.apply(this, arguments);

            // Reset state for new page
            curatedResults = [];
            originalDisplay.clear();
            uiInjected = false;

            // Restart product check
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            startProductCheck();
        };
    }

    // Start when page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();