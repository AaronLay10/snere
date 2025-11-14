# Sentient Control System - Web Interface

The primary web interface for the Sentient escape room control system, built with React, TypeScript, and Vite.

## Overview

This application provides the control dashboard for managing:
- **Rooms**: Configure and monitor escape rooms
- **Scenes**: Create and edit scene timelines with drag-and-drop support
- **Devices**: View and manage connected hardware devices
- **Timeline Editor**: Visual timeline editor for scene choreography

## Tech Stack

- **React 19.1.1** - UI framework
- **TypeScript** - Type safety
- **Vite 5.4.21** - Fast build tool with HMR
- **React Router v6** - Client-side routing
- **Zustand** - State management
- **TailwindCSS** - Styling
- **Framer Motion** - Animations
- **@dnd-kit** - Drag-and-drop functionality
- **Socket.io Client** - Real-time device communication

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Server will start on `http://localhost:3002`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── layout/         # Layout components (DashboardLayout, etc.)
│   └── timeline/       # Timeline editor components
├── hooks/              # Custom React hooks
├── lib/                # API client and utilities
├── pages/              # Page components
│   ├── Dashboard.tsx
│   ├── RoomsList.tsx
│   ├── RoomDetail.tsx
│   ├── ScenesList.tsx
│   ├── TimelineEditor.tsx
│   └── DevicesList.tsx
├── store/              # Zustand stores
├── App.tsx             # Main app with routing
└── main.tsx            # Entry point
```

## Key Features

### Authentication
- Role-based access control (admin, operator, guest)
- Protected routes with automatic redirect
- Persistent login state with Zustand

### Timeline Editor
- Drag-and-drop step reordering
- Visual step creation and editing
- Support for actions, delays, and cutscenes
- Real-time preview of scene flow

### Device Management
- Real-time device status via Socket.io
- MQTT topic monitoring
- Device capability inspection
- Connection status tracking

### Dashboard Layout
- Consistent sidebar navigation
- Role-based menu filtering
- User profile display
- Neural AI theme with animations

## API Integration

The web interface connects to the Sentient API backend at `http://localhost:3000/api`.

API modules are located in `src/lib/api.ts` and include:
- `auth` - Login and user management
- `rooms` - Room CRUD operations
- `scenes` - Scene management
- `devices` - Device monitoring
- `mqtt` - MQTT topic inspection

## Development Notes

### Browser Caching
If you see the old interface after updates:
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

OR use Incognito/Private mode for a clean slate.

### Visual Indicator
The sidebar displays "VITE ⚡" to confirm you're on the current Vite-based interface.

### Hot Module Replacement (HMR)
Vite provides instant updates during development. Changes to components will reflect immediately without losing state.

## Migration History

This application was migrated from Next.js to Vite in October 2024 to resolve persistent caching issues and improve development experience. The migration included:
- Conversion from Next.js App Router to React Router v6
- Removal of Next.js-specific APIs (`'use client'`, `next/navigation`)
- Path alias conversion (`@/` to relative paths)
- Updated authentication flow
- Improved build performance with Vite

## ESLint Configuration

Current setup uses recommended ESLint rules. For production, consider enabling type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
```

## License

Proprietary - Sentient Escape Room Control System
