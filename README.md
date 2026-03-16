# Tauri + React + Typescript

# Nextcloud Notes - Cross-Platform Desktop App

A modern, cross-platform desktop application for [Nextcloud Notes](https://apps.nextcloud.com/apps/notes) built with Tauri + React + TypeScript.

## Features

- ✅ **Cross-platform**: macOS, Linux, Windows
- ✅ **Lightweight**: ~600KB binary (vs 150MB+ Electron)
- ✅ **Modern UI**: React + TailwindCSS
- ✅ **Full sync**: Create, edit, delete, favorite notes
- ✅ **Search & filter**: Find notes quickly, filter by favorites
- ✅ **Auto-save**: Changes save automatically after 1.5s
- ✅ **Secure**: Credentials stored in system keychain (localStorage for now)
- ✅ **Background sync**: Auto-sync every 5 minutes

## Prerequisites

- **Rust**: Install from https://rustup.rs/
- **Node.js**: v18+ recommended
- **Nextcloud instance** with Notes app enabled

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## First Launch

1. Enter your Nextcloud server URL (e.g., `https://cloud.example.com`)
2. Enter your username
3. Enter your password or **App Password** (recommended)
   - Generate at: Settings → Security → Devices & Sessions in Nextcloud
4. Click **Connect**

## Building for Distribution

### macOS
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/macos/
```

### Linux
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/appimage/ or .deb
```

### Windows
```bash
npm run tauri build
# Output: src-tauri/target/release/bundle/msi/
```

## Tech Stack

- **Tauri**: Rust-based native wrapper (~600KB)
- **React 18**: UI framework
- **TypeScript**: Type safety
- **TailwindCSS**: Utility-first styling
- **Vite**: Fast build tool

## Advantages over Native Swift App

- ✅ **Cross-platform**: One codebase for macOS, Linux, Windows
- ✅ **No SwiftUI state issues**: React's state management is mature
- ✅ **Smaller binary**: Tauri is much lighter than Electron
- ✅ **Easier to maintain**: Web technologies vs platform-specific code
- ✅ **No Xcode required**: Build on any platform

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
