// ==UserScript==
// @name         NDLE – Amazon Curated Results (UI Stable)
// @namespace    ndle.amazon.ui.stable
// @version      1.3
// @description  NDLE with visual toggle and stable curation logic
// @match        https://www.amazon.com/s*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    let ndleEnabled = true;
    let curatedResults = null;
    let originalDisplay = new Map();
    let initialized = false;

    /* ---------------- CORE ---------------- */

    function getResults() {
        return Array.from(
            document.querySelectorAll('div[data-component-type="s-search-result"]')
        );
    }

    function hasText(el, words) {
        const t = el.innerText.toLowerCase();
        return words.some(w => t.includes(w));
    }

    function curateOnce(results) {
        if (curatedResults) return curatedResults;

        const curated = [];

        const budget = results.find(r =>
            hasText(r, ["amazon's choice", "amazon basics"])
        );
        if (budget) curated.push(budget);

        const value = results.find(r =>
            !curated.includes(r) &&
            hasText(r, ["best seller", "best deal"])
        );
        if (value) curated.push(value);

        let premium = null;
        let highest = 0;

        results.forEach(r => {
            if (curated.includes(r)) return;
            const ratingEl = r.querySelector('.a-icon-alt');
            if (!ratingEl) return;

            const rating = parseFloat(ratingEl.innerText);
            if (rating > highest) {
                highest = rating;
                premium = r;
            }
        });

        if (premium) curated.push(premium);

        // Fallback
        results.forEach(r => {
            if (curated.length < 3 && !curated.includes(r)) {
                curated.push(r);
            }
        });

        curatedResults = curated.slice(0, 3);
        return curatedResults;
    }

    function applyNDLE() {
        const results = getResults();
        if (results.length < 3) return;

        const curated = curateOnce(results);

        results.forEach(r => {
            if (!originalDisplay.has(r)) {
                originalDisplay.set(r, r.style.display);
            }
            r.style.display = curated.includes(r) ? '' : 'none';
        });

        injectBanner(results.length);
        initialized = true;
    }

    function restoreAll() {
        originalDisplay.forEach((display, el) => {
            el.style.display = display || '';
        });
        removeBanner();
    }

    /* ---------------- UI ---------------- */

    function injectUI() {
        if (document.getElementById('ndle-ui')) return;

        const panel = document.createElement('div');
        panel.id = 'ndle-ui';
        panel.innerHTML = `
            <div class="ndle-header">🛡️ NDLE</div>
            <div class="ndle-row">
                <span>Protection</span>
                <label class="ndle-switch">
                    <input type="checkbox" checked />
                    <span class="slider"></span>
                </label>
            </div>
            <div class="ndle-footer">Choice Overload Filter</div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            #ndle-ui {
                position: fixed;
                bottom: 24px;
                right: 24px;
                width: 190px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 12px 32px rgba(0,0,0,.18);
                font-family: system-ui, sans-serif;
                z-index: 9999;
            }
            .ndle-header {
                background: #10b981;
                color: white;
                padding: 10px;
                font-weight: 600;
                text-align: center;
            }
            .ndle-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px;
                font-size: 14px;
            }
            .ndle-footer {
                text-align: center;
                font-size: 11px;
                color: #6b7280;
                padding-bottom: 10px;
            }
            .ndle-switch {
                position: relative;
                width: 38px;
                height: 22px;
            }
            .ndle-switch input {
                opacity: 0;
            }
            .slider {
                position: absolute;
                inset: 0;
                background: #d1d5db;
                border-radius: 999px;
                transition: .3s;
            }
            .slider:before {
                content: "";
                position: absolute;
                height: 16px;
                width: 16px;
                left: 3px;
                bottom: 3px;
                background: white;
                border-radius: 50%;
                transition: .3s;
            }
            input:checked + .slider {
                background: #10b981;
            }
            input:checked + .slider:before {
                transform: translateX(16px);
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);

        const toggle = panel.querySelector('input');
        toggle.addEventListener('change', () => {
            ndleEnabled = toggle.checked;
            ndleEnabled ? applyNDLE() : restoreAll();
        });
    }

    /* ---------------- BANNER ---------------- */

    function injectBanner(total) {
        if (document.getElementById('ndle-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'ndle-banner';
        banner.innerText =
            `🛡️ NDLE is protecting you from choice overwhelm — showing 3 curated results instead of ${total}`;

        banner.style.cssText = `
            background:#ecfdf5;
            color:#065f46;
            padding:14px;
            margin:16px 0;
            border-radius:12px;
            border:1px solid #10b981;
            font-size:14px;
            font-weight:500;
        `;

        const slot = document.querySelector('.s-main-slot');
        if (slot) slot.before(banner);
    }

    function removeBanner() {
        const b = document.getElementById('ndle-banner');
        if (b) b.remove();
    }

    /* ---------------- INIT ---------------- */

    const observer = new MutationObserver(() => {
        if (!initialized && ndleEnabled) applyNDLE();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    injectUI();
})();
