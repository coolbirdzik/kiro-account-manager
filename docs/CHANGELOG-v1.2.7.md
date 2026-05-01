# Kiro Account Manager v1.2.7 Update Notes

Release Date: 2024-12-09

## 🎨 Interface Beautification

### Global Page Beautification
- **Unified page header design**: All pages use gradient background + blur light effects + theme color titles
- **Unified card styles**: All cards add hover shadow effects and icon background frames
- **Color theming**: Removed all hardcoded colors, unified use of theme variables to ensure color consistency when switching between dark/light modes and theme colors

### New Custom UI Components
- **Toggle switch component**: Replaces native checkbox, provides smooth animation and theme color support
- **Select dropdown component**: Replaces native select, supports option descriptions, check marks, and theme color highlighting

### Beautified Pages
- **Home Page (HomePage)**: Header gradient, statistics cards hover effects, feature cards theming
- **Account Management (AccountManager)**: Header gradient background and icons
- **Settings Page (SettingsPage)**: Header gradient, all card icons unified style, check interval layout optimization
- **Kiro Settings (KiroSettingsPage)**: Header gradient, Toggle switches, Select dropdowns, notification settings grouping
- **About Page (AboutPage)**: Header gradient, all card icons unified style, feature list color unification

## 🔧 Feature Optimization

### OIDC Credentials Batch Import
- **Support GitHub and Google accounts**: Can specify account type via `provider` field during batch import
- **Auto-detect authentication method**: Automatically sets correct `authMethod` (IdC/social) and `idp` based on provider
- **Updated help text**: Added GitHub/Google examples and descriptions

### Batch Import JSON Format Example
```json
[
  {
    "refreshToken": "xxx",
    "clientId": "xxx",
    "clientSecret": "xxx",
    "provider": "BuilderId"
  },
  {
    "refreshToken": "yyy",
    "provider": "Github"
  },
  {
    "refreshToken": "zzz",
    "provider": "Google"
  }
]
```

## 📁 New Files

- `src/renderer/src/components/ui/Toggle.tsx` - Custom toggle switch component
- `src/renderer/src/components/ui/Select.tsx` - Custom dropdown select component

## 🐛 Fixes

- Fixed layout issue with check interval dropdown in settings page
- Fixed inconsistent dropdown widths in Kiro settings page
- Unified width settings for settings page and Kiro settings page
