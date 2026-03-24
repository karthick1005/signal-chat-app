# Signal Chat App 🔒

A production-ready, **end-to-end encrypted** real-time chat application built with **Next.js** and the **Signal Protocol**. Inspired by Signal and WhatsApp, it provides secure one-on-one and group messaging, video calling, offline support, and a local-first architecture — all without storing message contents on any central server.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Installation](#installation)
  - [Running in Development](#running-in-development)
  - [Running Tests](#running-tests)
  - [Production Build](#production-build)
- [Key Concepts](#key-concepts)
  - [Signal Protocol (E2E Encryption)](#signal-protocol-e2e-encryption)
  - [Local-First Architecture](#local-first-architecture)
  - [Real-Time Messaging](#real-time-messaging)
  - [Group Messaging](#group-messaging)
  - [Message Reactions](#message-reactions)
  - [Video Calling](#video-calling)
- [API & WebSocket Configuration](#api--websocket-configuration)
- [Deployment](#deployment)
  - [Vercel](#vercel)
  - [Docker](#docker)
  - [Environment Variables in Production](#environment-variables-in-production)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| 🔐 **End-to-End Encryption** | All messages encrypted with the Signal Protocol (X3DH + Double Ratchet) |
| 💬 **Real-Time Messaging** | Instant message delivery via Socket.IO WebSockets |
| 👥 **Group Chats** | WhatsApp-like group management with distributed, device-only storage |
| 😍 **Message Reactions** | Add/remove emoji reactions with optimistic UI updates |
| 📹 **Video Calling** | One-on-one video calls powered by ZegoCloud |
| 📱 **PWA Support** | Installable Progressive Web App with offline capabilities |
| 🌗 **Dark / Light Mode** | System-aware theming via `next-themes` |
| 💾 **Offline Support** | IndexedDB local cache — the app works without a network connection |
| ⚡ **Optimistic Updates** | UI reflects changes instantly before server confirmation |
| 🔄 **Background Sync** | Automatic retry and sync queue for offline operations |

---

## Tech Stack

**Frontend**
- [Next.js 16](https://nextjs.org/) — React framework with App Router
- [TypeScript](https://www.typescriptlang.org/) — Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) — Utility-first styling with accessible components
- [Zustand](https://zustand-demo.pmnd.rs/) — Lightweight global state management
- [Socket.IO Client](https://socket.io/) — Real-time bidirectional communication
- [IndexedDB (idb)](https://github.com/jakearchibald/idb) — Local-first persistent storage
- [ZegoCloud](https://www.zegocloud.com/) — Video/audio calling SDK
- [emoji-picker-react](https://github.com/ealush/emoji-picker-react) — Emoji picker for reactions
- [react-hot-toast](https://react-hot-toast.com/) — Notification toasts
- [next-themes](https://github.com/pacocoursey/next-themes) — Dark/light mode

**Security**
- Signal Protocol (X3DH key agreement + Double Ratchet algorithm) — implemented via `libsignal`

**Testing**
- [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/) — Unit and component tests
- [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) — In-memory IndexedDB for tests

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser / PWA                          │
│                                                                 │
│  ┌───────────────┐   ┌───────────────┐   ┌──────────────────┐  │
│  │  React UI     │   │  Zustand Store│   │  Signal Protocol │  │
│  │  (Next.js)    │◄──│  (chat-store) │   │  (E2E Encrypt.)  │  │
│  └──────┬────────┘   └───────┬───────┘   └────────┬─────────┘  │
│         │                    │                     │            │
│  ┌──────▼────────────────────▼─────────────────────▼─────────┐  │
│  │                      IndexedDB (idb)                       │  │
│  │         Messages · Groups · Keys · Reactions               │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                 │
└───────────────────────────────┼─────────────────────────────────┘
                                │ Socket.IO / REST
                    ┌───────────▼────────────┐
                    │   Backend API Server   │
                    │   (localhost:8000)     │
                    │   WebSocket + REST     │
                    └────────────────────────┘
```

- **No plaintext messages ever leave the device.** All content is encrypted client-side before transmission.
- **Groups are device-only.** Group metadata is stored in IndexedDB and shared peer-to-peer, not in a central database.
- **Offline-first.** The app loads cached data instantly and syncs when connectivity is restored.

---

## Project Structure

```
signal-chat-app/
├── public/                        # Static assets & PWA manifest
│   └── manifest.json
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── layout.tsx             # Root layout (theme, socket, toast)
│   │   ├── page.tsx               # Main chat page (home)
│   │   └── login/
│   │       └── page.tsx           # Authentication / key generation page
│   ├── components/
│   │   ├── auth/                  # Login form & auth components
│   │   ├── home/                  # Core chat UI components
│   │   │   ├── left-panel.tsx     # Conversation list sidebar
│   │   │   ├── right-panel.tsx    # Active chat view
│   │   │   ├── message-container.tsx
│   │   │   ├── message-input.tsx
│   │   │   ├── message-reactions.tsx
│   │   │   ├── chat-bubble.tsx
│   │   │   ├── create-group-dialog.tsx
│   │   │   └── ...
│   │   ├── ui/                    # Reusable shadcn/ui primitives
│   │   └── video-call/            # ZegoCloud video call components
│   ├── hooks/
│   │   ├── socket.tsx             # Socket.IO context & provider
│   │   ├── useWhatsAppServices.ts # Hook for P2P group & reaction services
│   │   └── ...
│   ├── lib/
│   │   ├── signal/
│   │   │   ├── signal.ts               # Signal Protocol initialisation
│   │   │   ├── SignalProtocolStore.ts  # Key material store (IndexedDB)
│   │   │   ├── SenderKeyStore.ts       # Group sender keys
│   │   │   ├── ChatStore.ts            # IndexedDB wrapper (messages, groups, reactions)
│   │   │   ├── BackgroundSync.ts       # Offline queue & retry logic
│   │   │   ├── ReactionService.ts      # Reaction CRUD + P2P sync
│   │   │   ├── WhatsAppGroupService.ts # Device-only group management
│   │   │   └── WhatsAppSignalGroupService.ts
│   │   ├── chatStoreInstance.ts        # Singleton ChatStore instance
│   │   ├── types.ts                    # Shared TypeScript interfaces
│   │   └── utils.ts                    # Utility helpers
│   ├── providers/
│   │   └── theme-provider.tsx          # next-themes wrapper
│   └── store/
│       └── chat-store.ts               # Zustand global state
├── .env                           # Local environment variables (never commit secrets)
├── jest.config.js                 # Jest configuration
├── next.config.mjs                # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS configuration
└── tsconfig.json                  # TypeScript configuration
```

---

## Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 18.x LTS or later |
| npm | 9.x or later |
| Backend API Server | Running on port `8000` (see [API & WebSocket Configuration](#api--websocket-configuration)) |

### Environment Variables

Copy the example below into a `.env` file at the project root:

```env
# URL of the backend REST API
NEXT_PUBLIC_API_URL=http://localhost:8000

# WebSocket URL for real-time messaging
NEXT_PUBLIC_WS=ws://localhost:8000
```

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are inlined into the client bundle at build time. **Never put secrets in `NEXT_PUBLIC_` variables.**

### Installation

```bash
# Clone the repository
git clone https://github.com/karthick1005/signal-chat-app.git
cd signal-chat-app

# Install dependencies
npm install
```

### Running in Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

On first launch you will be redirected to `/login` to generate your Signal Protocol key bundle. This registers your device with the backend and stores key material locally in IndexedDB.

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file changes)
npm run test:watch
```

Tests use Jest + React Testing Library + `fake-indexeddb` so no real browser or backend is required.

### Production Build

```bash
# Type-check and build
npm run build

# Start the production server
npm start
```

---

## Key Concepts

### Signal Protocol (E2E Encryption)

Every message is encrypted client-side before it is sent to the server.

- **Key Generation** — On registration, the app generates an identity key pair, a signed pre-key pair, and a batch of one-time pre-keys. The public portions are uploaded to the backend.
- **Session Establishment (X3DH)** — When sending a first message to a user, the app fetches the recipient's pre-key bundle and performs an Extended Triple Diffie-Hellman key exchange to establish a shared secret without the server ever seeing it.
- **Double Ratchet** — After session establishment, every message advances a cryptographic ratchet, providing forward secrecy and break-in recovery.
- **Sender Keys (Groups)** — Group messages use the Signal Sender Key scheme: one per-member key encrypts the message, and the group distribution message is sent once per member.

Key material is stored exclusively in `IndexedDB` via `SignalProtocolStore` and `SenderKeyStore` — it never leaves the device in plaintext.

### Local-First Architecture

Inspired by WhatsApp's offline behaviour:

1. **IndexedDB** is the source of truth for messages, groups, and reactions.
2. The UI loads from cache immediately on startup.
3. Network requests happen in the background; the UI updates when fresh data arrives.
4. Failed operations are queued in `BackgroundSync` and retried automatically with exponential back-off.

### Real-Time Messaging

`Socket.IO` provides the real-time transport layer.

- The `SocketProvider` (`src/hooks/socket.tsx`) manages the connection lifecycle and exposes a React context.
- Incoming messages are decrypted and written to IndexedDB, then state is updated via Zustand.
- The socket reconnects automatically on network interruption.

### Group Messaging

Groups follow an authentic WhatsApp-style distributed model:

- Group metadata (name, members, avatar) is stored **only on member devices** — never in a central database.
- When a group is created, the creator distributes metadata to all members via the WebSocket.
- Admin operations (add/remove member, update info) are propagated peer-to-peer and merged using version-based conflict resolution.

See [`WHATSAPP_FEATURES.md`](./WHATSAPP_FEATURES.md) for the full API reference.

### Message Reactions

- Reactions are applied **optimistically** — the UI updates immediately.
- They are persisted to IndexedDB and synced to other members via WebSocket.
- `ReactionService` handles add, remove, and toggle operations with conflict resolution.

### Video Calling

One-on-one video calls are powered by the [ZegoCloud UIKit Prebuilt](https://www.zegocloud.com/). Call signalling is handled through the existing Socket.IO connection.

---

## API & WebSocket Configuration

This frontend expects a companion backend server to be running. Configure the connection via environment variables:

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL for REST API calls (key bundles, user lookup, etc.) |
| `NEXT_PUBLIC_WS` | `ws://localhost:8000` | WebSocket URL for Socket.IO real-time events |

For production, replace these with your deployed backend URLs (e.g. `https://api.yourdomain.com` and `wss://api.yourdomain.com`).

---

## Deployment

### Vercel

The easiest way to deploy the frontend:

1. Push the repository to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Set the environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS`) in the Vercel project settings.
4. Click **Deploy**.

### Docker

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> **Tip:** Enable Next.js [standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output) in `next.config.mjs` (`output: 'standalone'`) to produce a minimal production image.

```bash
docker build -t signal-chat-app .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://api.yourdomain.com \
  -e NEXT_PUBLIC_WS=wss://api.yourdomain.com \
  signal-chat-app
```

### Environment Variables in Production

| Variable | Required | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_WS` | ✅ | `wss://api.yourdomain.com` |

---

## Contributing

1. **Fork** the repository and create your feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. **Install** dependencies: `npm install`
3. **Make your changes** and ensure tests pass: `npm test`
4. **Lint** your code: `npm run lint`
5. **Commit** following [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add read receipts"
   ```
6. **Push** and open a Pull Request against `main`.

### Code Style

- TypeScript is required for all new source files.
- Follow the existing React hooks patterns (no class components).
- Use IndexedDB via `chatStoreInstance` for all persistent storage — do not use `localStorage` for messages or keys.
- Implement optimistic updates for any user-facing mutation.
- Add or update tests for new features.

---

## License

This project is licensed under the MIT License.

---

> Built with ❤️ using [Next.js](https://nextjs.org/), [Signal Protocol](https://signal.org/docs/), and [Socket.IO](https://socket.io/).
