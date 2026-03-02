# CARE Serial Scanner Plugin

USB-COM barcode scanner plugin for CARE. Provides hardware scanner support for patient identification.

## Features

- **Web Serial API** - Direct browser connection (Chrome/Edge)
- **WebSocket Bridge** - Fallback for Firefox/Safari via [Care Scanner Bridge](https://github.com/ohcnetwork/care_scanner_bridge)
- **Auto-reconnect** - Handles tab switching and disconnections
- **Cross-platform** - Works on Windows, macOS

## Installation

This plugin is installed via CARE's plugin system.

## Browser Support

| Browser    | Method                                          |
| ---------- | ----------------------------------------------- |
| Chrome 89+ | Web Serial API (native)                         |
| Edge 89+   | Web Serial API (native)                         |
| Firefox    | WebSocket bridge (requires Care Scanner Bridge) |
| Safari     | WebSocket bridge (requires Care Scanner Bridge) |

## For Firefox/Safari Users

Download and install the **Care Scanner Bridge** desktop app:

- **macOS**: [Download .dmg](https://github.com/ohcnetwork/care_scanner_bridge/releases)
- **Windows**: [Download .exe](https://github.com/ohcnetwork/care_scanner_bridge/releases)

The app runs in the system tray and provides a WebSocket server on `localhost:7001`.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output will be in `dist/` folder.
