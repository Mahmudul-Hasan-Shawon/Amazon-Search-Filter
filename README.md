<div align="center">

# 🛡️ NDLE: Amazon Search Filter

**Curated Amazon search results, right on the page.**

A Tampermonkey userscript that scans Amazon.com search results for trust signals
(Amazon's Choice, Best Seller, Best Deal, top ratings), hides everything else with
smooth animations, and gives you a glassmorphism control panel with independent
toggles for each category.

[![Version](https://img.shields.io/badge/version-2.9.2-f59e0b?style=flat-square)](Amazon.user.js)
[![Userscript](https://img.shields.io/badge/userscript-Tampermonkey%20%2F%20Violentmonkey-00485B?style=flat-square)](https://www.tampermonkey.net/)
[![Target](https://img.shields.io/badge/target-amazon.com%2Fs-ff9900?style=flat-square)](https://www.amazon.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](Amazon.user.js)
[![Size](https://img.shields.io/badge/size-~35%20KB-blue?style=flat-square)](Amazon.user.js)
[![GitHub stars](https://img.shields.io/github/stars/Mahmudul-Hasan-Shawon/Amazon-Search-Filter?style=social)](https://github.com/Mahmudul-Hasan-Shawon/Amazon-Search-Filter)
[![Fiverr](https://img.shields.io/badge/built%20as%20a-Fiverr%20client%20project-1DBF73?style=flat-square&logo=fiverr&logoColor=white)](https://www.fiverr.com/)

</div>

---

## 📖 About

Amazon search pages bury the signals that actually matter behind a wall of sponsored
listings and noise. NDLE runs directly on `https://www.amazon.com/s*` and re-weights
the page in your favor: it detects trust badges and star ratings on every result card,
keeps only the picks worth seeing, and animates the rest away.

Everything is one file, zero dependencies, and zero network calls. The only external
resource loaded is the [Inter font](https://fonts.google.com/specimen/Inter) for the UI.

> 💼 **This was a client project delivered on Fiverr**: a custom-built Amazon result
> curator, made to spec for a buyer.

## ✨ Features

### 🧠 Smart Curation

Every result card is scanned and sorted into three overlapping categories:

| Category | Icon | A product qualifies if... |
|----------|:----:|---------------------------|
| **Budget** | 💰 | It carries the **Amazon's Choice** badge (checked via badge classes, popover `data-action`, badge text, then full-card text search) **or** it is an **Amazon Basics** product (title or badge text) |
| **Value** | 🔥 | It carries a **Best Seller** badge **or** a **Best Deal** badge (including "Best Value", "Deal of the Day", "Limited Time Deal") |
| **Premium** | ⭐ | Its star rating is **4.8 to 5.0**, read from `aria-label` ("x out of 5 stars"), visible rating text, or `a-icon-star-mini` CSS classes, in that order |

Ratings and badges are detected with layered fallbacks because Amazon ships several
different card markups depending on A/B tests and product type.

### 🎛️ Control Panel

| Feature | Detail |
|---------|--------|
| Floating launcher | A round amber **NDLE** button, fixed to the bottom-right corner, with hover scale effect |
| Draggable panel | Grab the gradient header to move the panel anywhere on screen |
| Independent toggles | Three custom animated switches, one per category, each instantly re-filtering the page |
| Live counters | Per-category pill counts plus a "Curated: N products" footer total |
| Design | Glassmorphism: blurred translucent surfaces, amber gradient header, Inter typography |
| Open/close | The launcher hides while the panel is open; the panel animates in and out; close with the × button |

### ✨ Animated Filtering

| Feature | Detail |
|---------|--------|
| Smooth transitions | Non-matching cards fade out, scale to 95%, then collapse via `max-height` (400 ms ease) |
| Flash-free | Cards already on screen are marked processed once and never re-animate |
| Race-safe | A card hidden by a pending timeout is re-checked before `display: none` lands, so fast toggle flips never strand a visible card in a hidden state |
| Fast lookup | Curated results live in a `Set` for O(1) membership checks per card |

### 🛡️ Fallback Banner

If no active category matches anything on the page, NDLE does not blank the search:
it keeps the **top 3 results** and injects an amber pill banner above the results grid:
*"🛡️ NDLE Smart Selection: No badges found, showing top 3 of N"*. The banner updates
in place if the result count changes and removes itself the moment any category matches.

### 🧭 Navigation Aware

| Signal | Behavior |
|--------|----------|
| Initial load | Polls every second (up to ~30 s) until result cards appear, then injects the UI and applies the filter |
| `popstate` | Resets all state and restarts the watcher (browser back/forward) |
| AJAX pagination | Wraps `history.pushState` so Amazon's SPA-style page changes trigger a fresh curation pass |
| Stability check | Applies the filter on 3 consecutive polls with results, then stops the interval to stay idle |

## ⚙️ How It Works

```text
                 amazon.com/s?k=...  (document-idle)
                          │
                          ▼
              ┌───────────────────────┐
              │   startProductCheck   │  setInterval, 1 s ticks
              │   (waits for cards)   │
              └──────────┬────────────┘
                         │  result cards found
                         ▼
              ┌───────────────────────┐        ┌──────────────────┐
              │       injectUI        │───────▶│ Floating button  │
              │  panel + button + CSS │        │ Draggable panel  │
              └──────────┬────────────┘        │ 3 toggles+counts │
                         │                     └────────┬─────────┘
                         ▼                              │ toggle flip
              ┌───────────────────────┐                 │
              │        curate         │◀────────────────┘
              │ badge + rating detect │
              │ per result card       │
              └──────────┬────────────┘
                         │  curated Set (or top-3 fallback)
                         ▼
              ┌───────────────────────┐
              │       applyNDLE       │
              │ animated show / hide  │
              │ + banner management   │
              └──────────┬────────────┘
                         │
                         ▼
              popstate / history.pushState hooks
              reset state and restart the watcher
```

The script is stateless by design: nothing is persisted, so every page load (and every
AJAX page change) re-curates from scratch. All console output is prefixed with emoji
(`📦` budget hits, `🔥` value hits, `⭐` premium hits, `🎯` per-page summary) for easy
debugging in DevTools.

## 📁 Project Structure

```text
Amazon-Search-Filter/
└── Amazon.user.js    # The entire project: metadata block, curation engine,
                      # filtering, banner, and glassmorphism UI in one IIFE
```

## 🧰 Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Language | Vanilla JavaScript (ES6+) | Single IIFE, `'use strict'`, no build step |
| Delivery | UserScript | Tampermonkey / Violentmonkey metadata block (`@match https://www.amazon.com/s*`, `@run-at document-idle`, `@grant none`) |
| UI | Hand-written DOM + CSS | Injected `<style>` with `!important` rules to survive Amazon's own styles |
| Typography | Inter via Google Fonts | Injected `<link>` at runtime |
| Page watching | `setInterval` polling | 1 s cadence, self-terminating once results are stable |
| SPA hooks | `history.pushState` wrapper + `popstate` listener | Keeps the filter alive across Amazon's AJAX pagination |
| Dependencies | None | No libraries, no network requests, no storage |

## 🚀 Getting Started

### Prerequisites

- A userscript manager:
  - [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Edge, or Safari, or
  - [Violentmonkey](https://violentmonkey.github.io/) for Firefox
- That's it. No Node.js, no package manager, no build.

### Install

**Option A: one click**

1. Open the raw script URL:
   `https://github.com/Mahmudul-Hasan-Shawon/Amazon-Search-Filter/raw/main/Amazon.user.js`
2. Your userscript manager intercepts the request and opens its install page.
3. Click **Install**.

**Option B: manual paste**

1. Open your userscript manager dashboard.
2. Create a new script (Tampermonkey: the `+` tab).
3. Delete the template, paste the full contents of [Amazon.user.js](Amazon.user.js).
4. Save with `Ctrl + S`.

### Run

1. Go to any Amazon search page, e.g. <https://www.amazon.com/s?k=mechanical+keyboard>.
2. The amber **NDLE** button appears in the bottom-right corner once results load.
3. Click it to open the curator panel and flip toggles to taste.
4. Watch DevTools console for the `🎯 NDLE Summary` log (total, per-category and curated counts).

### First-run notes

- The filter applies automatically with all three toggles **on** by default.
- Category counters only count items while that category's toggle is on.
- Nothing is saved between visits: toggles reset to "all on" on each page load.

## 🧩 UI & Code Map

What you'll interact with on the page:

| Element | DOM id | Purpose |
|---------|--------|---------|
| Floating launcher | `#ndle-toggle-btn` | Opens/closes the curator panel |
| Curator panel | `#ndle-ui` | Toggles, counters, footer, draggable header |
| Fallback banner | `#ndle-banner` | "No badges found, showing top 3 of N" pill |
| Injected stylesheet | `#ndle-styles` | All panel, switch, and banner styles |

<details>
<summary><strong>Internal function reference</strong> (source of truth: <a href="Amazon.user.js">Amazon.user.js</a>)</summary>

| Function | Role |
|----------|------|
| `getResults()` | Collects all `div[data-component-type="s-search-result"]` cards |
| `hasText(el, words)` | Case-insensitive multi-word text match on a card |
| `getRating(el)` | Star rating via `aria-label`, visible text, then `a-icon-star-mini` classes |
| `isAmazonBasics(el)` | Amazon Basics detection via title and badge text |
| `isAmazonChoice(el)` | Amazon's Choice detection via badge classes, popover attrs, and text fallbacks |
| `isBestSeller(el)` | Best Seller detection via badge classes, `aria-label`, and text fallbacks |
| `isBestDeal(el)` | Best Deal / Best Value / limited-time deal detection |
| `curate()` | Classifies every card into the three categories and builds the curated set |
| `applyNDLE()` | Animates cards in/out of view and manages the fallback banner |
| `injectBanner(total)` / `removeBanner()` | Creates, updates, or removes the no-badges banner |
| `createToggleButton()` | Builds the floating NDLE launcher with hover effects |
| `showPanel()` / `hidePanel()` / `togglePanel()` | Animated panel open/close, swapping visibility with the launcher |
| `injectUI()` | Builds the panel, styles, toggles, and wires up all listeners |
| `makeDraggable(handle, element)` | Classic mousedown/mousemove drag for the panel header |
| `updateStatusUI()` | Syncs counters and the "Curated: N products" footer |
| `startProductCheck()` | 1 s polling watcher that waits for results, applies the filter, then stops |
| `init()` | Boots the watcher and installs the `popstate` / `pushState` navigation hooks |

</details>

## 💡 Why NDLE Exists

Amazon's default ranking optimizes for what Amazon wants to sell. This script flips the
lens: it keeps only products with independently verifiable trust signals, the badges
Amazon itself awards (Amazon's Choice, Best Seller, Best Deal) and near-perfect customer
ratings, and pushes the rest out of view. One click gives you a page of only
budget-credible, deal-credible, or top-rated picks, without touching Amazon's own
filters or sort order.

## 🤝 Contributing

The whole project is one file. To contribute: fork, edit [Amazon.user.js](Amazon.user.js),
bump the `@version` in the metadata block, and open a pull request. Please test against
a live Amazon search page (desktop layout) before submitting, since card markup varies
by product category.

---

<div align="center">

**NDLE** · a single-file userscript for calmer Amazon shopping · built as a Fiverr client project

</div>
