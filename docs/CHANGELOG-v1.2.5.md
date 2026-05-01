# Kiro Account Manager v1.2.5 Changelog

**Release Date**: 2025-12-09

---

## 🎨 Theme System Upgrade

### Theme Color Expansion
- Theme colors increased from **13 to 21**, providing richer personalization choices
- Displayed by color groups for users to quickly locate preferred colors:
  - **Blue Series**: Sky Blue, Indigo, Cyan, Sky, Teal
  - **Purple-Red Series**: Purple, Violet, Fuchsia, Pink, Rose
  - **Warm Series**: Red, Orange, Amber, Yellow
  - **Green Series**: Emerald, Green, Lime
  - **Neutral Series**: Slate, Zinc, Stone, Neutral

### Theme Selector Optimization
- Added **collapse/expand** functionality, shows current selected color when collapsed
- Click to expand complete theme selection panel
- Reduces page space usage, cleaner interface

---

## 📊 Home Page Enhancement

### Quota Statistics Card
- Added **Quota Statistics** module to real-time summarize usage data from all valid accounts
- Display content:
  - Total Quota
  - Used
  - Remaining Quota
  - Usage Rate Percentage
- Visual progress bar that changes color based on usage rate:
  - 🟢 Green: < 50%
  - 🟡 Yellow: 50% - 80%
  - 🔴 Red: > 80%

---

## 💾 Export Function Upgrade

### Multi-Format Export Support
- Added export format selection dialog, supports 4 export formats:
  - **JSON**: Complete data, can be used for import restoration
  - **TXT**: Plain text format, easy to read
  - **CSV**: Excel compatible format, supports Chinese
  - **Clipboard**: Direct copy to clipboard

### Export Options
- JSON format can choose whether to include credential information (sensitive data like tokens)
- Supports multi-select account export, only exports selected accounts when selected
- Settings page and account management page share the same export component

---

## 🔧 Machine ID Management Optimization

### Current Machine ID Card
- Added **last modified time** display, consistent with original machine ID backup layout

### Account Machine ID Management Dialog
- Added **search function**, supports searching by email, nickname, machine ID
- Shows friendly message when search has no results

---

## 🐛 Bug Fixes

- Fixed issue where some theme colors switching didn't work
- Completed CSS variable definitions for all new themes
- Fixed `applyTheme` function not including new theme class names

---

## 📝 Technical Improvements

- Theme configuration refactored to group structure for easier maintenance and expansion
- Export functionality componentized to improve code reusability
- Optimized quota statistics using `useMemo` for better performance

---

**完整版本**: 1.2.5  
**兼容性**: Windows / macOS / Linux
