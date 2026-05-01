# Kiro Account Manager

Electron app để quản lý tài khoản Kiro — theo dõi usage, subscription, tự động đăng ký AWS Builder ID, đổi Machine ID và nhiều tiện ích khác.

## Features

- **Quản lý tài khoản**: thêm/xóa/lọc/nhóm/tag, xem chi tiết từng account
- **Kiểm tra usage**: tự động refresh token, theo dõi lượt dùng Kiro AI theo real-time
- **Auto Register AWS Builder ID**: điền form, xác minh email (Graph API / scrape Outlook / manual), lấy SSO token — tất cả tự động
- **Machine ID**: xem và đổi Machine ID trực tiếp trong app
- **Kiro Settings**: chỉnh steering instructions, MCP server config ngay trong app
- **Import/Export**: JSON, batch import nhiều account
- **Đa ngôn ngữ**: Tiếng Anh / Tiếng Việt (i18n)
- **Auto Update**: tự check và cài bản mới

## Input format (Auto Register)

```
email|password|refresh_token|client_id
```

- `refresh_token` + `client_id`: Microsoft Graph API để tự đọc OTP từ Outlook (full-auto)
- Chỉ nhập `email|password`: app sẽ mở Outlook tab, tự click email AWS mới nhất để lấy OTP
- Nếu cả hai đều không có: app hiện cửa sổ browser chờ bạn dán OTP tay

## Tech stack

- Electron + React + TypeScript
- Vite (electron-vite)
- Tailwind CSS v4
- Playwright (tự động hóa browser)
- Zustand (state management)
- electron-store (persistent storage)
- i18next (i18n)

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

## Cài Playwright browser (lần đầu)

```bash
npm run install-browser
```

## License

MIT
