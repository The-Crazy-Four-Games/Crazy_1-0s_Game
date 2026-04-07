# Crazy 1-0's — Source (`src/rev0`)

A full-stack, real-time two-player card game built with React, Express, Socket.io, and a shared game-logic library. Supports **Decimal (Base-10)**, **Dozenal (Base-12)**, and **Octal (Base-8, experimental)** numeral systems.

---

## Project Architecture

```
rev0/
├── shared/     ── Shared game library (source of truth for rules, scoring, base conversion)
├── backend/    ── Express REST API + Socket.io real-time gateway
├── frontend/   ── React + Vite SPA
└── docker-compose.yml
```

- **`shared`**: Pure TypeScript library. Contains the complete game engine, rule logic, base-conversion utilities, and scoring. Has zero runtime dependencies on the other packages.
- **`backend`**: Consumes `shared`. Handles HTTP (auth, lobby, profile, admin) and WebSocket (game events). Supports PostgreSQL (default) or in-memory storage.
- **`frontend`**: Consumes `shared`. A polished React app wired to the backend via REST and Socket.io.

---

## Prerequisites

- **Node.js** v18+ and **npm**
- **PostgreSQL** (or use `USE_INMEMORY=true` to skip)
- **Docker & Docker Compose** (optional but easiest for full-stack deployment)

---
## Quick Start (Website)
Our game is currently deployed on [The Crazy 1-0's](thecrazy10.click)
---

## Quick Start (Local Development)

### 1. Install dependencies

Run from `rev0/` (uses npm workspaces):

```bash
npm install
```

Or install each package individually:

```bash
cd shared && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Build `shared`

`shared` must be compiled before `backend` or `frontend` can import it.

```bash
cd shared
npm run build
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | (auto-built from parts) | PostgreSQL connection string |
| `JWT_SECRET` | `dev_secret_change_me` | Secret for signing JWT tokens |
| `PORT` | `3001` | Backend HTTP/WS port |
| `USE_INMEMORY` | `false` | Set `true` to skip PostgreSQL entirely |

### 4. Start backend

```bash
cd backend
npm run dev
```

### 5. Start frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` (Vite default).

---

## Docker Deployment

The easiest way to run the full stack:

```bash
cp .env.example .env
# Edit .env with your POSTGRES_PASSWORD, JWT_SECRET, and FRONTEND_URL

docker compose up --build
```

| Service | Port |
| :--- | :--- |
| Frontend (nginx) | `8080` |
| Backend | `3000` |
| PostgreSQL | `5432` |

---

## Game Modes

| Mode | Base | Target Sum | Win Score | Special Ranks |
| :--- | :--- | :--- | :--- | :--- |
| **Decimal** | Base 10 | 10 | 100 | J, Q, K (10 pts each) |
| **Dozenal** | Base 12 | 12 (`"10"` in base-12) | 144 (`"100"`) | J, Q, K, C (12 pts each) |
| **Octal** 🧪 | Base 8 | 8 (`"10"` in base-8) | 64 (`"100"`) | J, Q (8 pts each) |

---

## Game Rules

- **Play a card**: Its rank + the top card's rank must sum to the system's target (e.g. 10, 12, or 8). Alternatively, match the top card's suit.
- **Wildcard (rank `"10"`)**: Can be played on anything; the player then picks the next forced suit.
- **Skip card**: Playing the skip rank (5 in decimal, 6 in dozenal, 4 in octal) grants the current player an immediate free-play turn.
- **Draw**: Up to 3 cards per turn. After 3 draws with no playable card, the turn automatically passes.
- **Face cards (J, Q, K, C)**: Worth their fixed decimal point value. In dozenal/decimal modes, playing a King or Cancel card triggers an **Arithmetic Challenge** popup.
- **Arithmetic Challenges**: Both players compete to answer a math question (addition, subtraction, multiplication, or division) in the current numeral base. The first correct answer gains bonus points. One attempt per player.
- **Win condition**: First player to accumulate the target score across multiple rounds wins the match.

---

## `shared` Package

### `baseConversion.ts`

Generic radix-conversion engine supporting any integer base ≥ 2.

- **`BaseSpec`**: Configuration type — defines `base`, `digits` array, optional `aliases`, sign rules, and leading-zero stripping.
- **`fromBase(s, spec)`** / **`toBase(n, spec)`**: BigInt-precise conversion between string representations and internal integers.
- **`fromBaseToNumber`** / **`toBaseFromNumber`**: Convenience wrappers for JS safe-integer range.
- **`normalizeNumberString(s, spec)`**: Validates and normalizes input (applies aliases, strips whitespace, handles signs).
- **`isValidNumberString(s, spec)`**: Non-throwing boolean validity check.
- **`DOZENAL_SPEC`**: Pre-configured dozenal spec using `↊` (ten) and `↋` (eleven) as canonical digit symbols, with ASCII aliases `A/X → ↊` and `B/E → ↋`.
- **`decimalToDozenal(n)`**, **`dozenalToDecimal(s)`**, **`normalizeDozenal(s)`**, **`isValidDozenal(s)`**: Convenience wrappers for the dozenal spec.

**Example:**
```typescript
decimalToDozenal(22);   // "1↊"
dozenalToDecimal("1↋"); // 23
```

---

### `systems.ts`

Defines **`NumeralSystem`** — the configuration that parameterizes the entire game for a given base.

**`NumeralSystem` fields:**

| Field | Description |
| :--- | :--- |
| `id` | `"dec"` \| `"doz"` \| `"oct"` |
| `spec` | `BaseSpec` for conversion |
| `deckNumericSymbols` | Symbols for numeric cards in the deck |
| `faceRanks` | Face card rank symbols (e.g. `["J","Q","K","C"]`) |
| `valueOf` | Map from rank symbol → decimal integer value |
| `targetSumText` | Base-native string for the play target (e.g. `"10"`) |
| `targetScoreText` | Base-native win threshold (e.g. `"100"` = 144 decimal in dozenal) |
| `wildcardTenSymbol` | Rank symbol for the wildcard card |
| `wildcardSkipSymbol` | Rank symbol for the skip card |
| `facePointsDec` | Decimal point value of face cards |

**Exports:** `DECIMAL_SYSTEM`, `DOZENAL_SYSTEM`, `OCTAL_SYSTEM`, `SYSTEMS` registry, `getSystem(id)`.

---

### `rules.ts`

Core low-level game engine. Contains all state-transition logic.

**`RoundState` fields:** `deck`, `discard`, `topCard`, `forcedSuit`, `hands`, `players`, `turn`, `drawCount`, `freePlay`, `activeChallenge`.

**Key functions:**

| Function | Description |
| :--- | :--- |
| `isPlayable(sys, state, playerId, card)` | Validates a move (suit match, sum-to-target, freePlay, wildcard). |
| `applyPlay(sys, state, playerId, card, chosenSuit?, chosenOp?)` | Executes the play: updates discard, hand, turn, forcedSuit; triggers challenges on face cards. |
| `applyDraw(sys, state, playerId)` | Draws a card; auto-passes after 3 consecutive failed draws. |
| `passTurn(state)` | Ends the current player's turn. |
| `initRound(sys, players, handSize, rngDeck?)` | Shuffles deck, deals initial hand, picks top card. |
| `getPlayableCards(sys, state, playerId)` | Returns filtered list of playable cards from hand. |
| `isRoundOver(state)` | True when any player's hand is empty. |
| `roundWinner(state)` | Returns the winning player ID. |
| `parseInSystem(text, sys)` | Parses a base-native string → decimal integer. |
| `formatInSystem(n, sys)` | Formats decimal integer → base-native string. |

---

### `scoring.ts`

Calculates round scores.

| Function | Description |
| :--- | :--- |
| `handPointsDec(hand, sys)` | Sums decimal values of all cards in a hand. |
| `roundGainDec(loserHand, sys)` | The integer points the round winner earns. |
| `roundGain(loserHand, sys)` | Returns `{ gainDec, gainText }` — both the number and base-native display string. |

**Example:**
```typescript
const result = roundGain(loserHand, DOZENAL_SYSTEM);
// { gainDec: 22, gainText: "1↊" }
```

---

### `gameActions.ts`

Defines the **action protocol** shared between frontend and backend.

**`GameAction` union:**

| Type | Fields | Description |
| :--- | :--- | :--- |
| `PLAY` | `card`, `chosenSuit?`, `chosenOperation?` | Play a card (with optional suit for wildcards or math op for face cards). |
| `DRAW` | — | Draw a card from the deck. |
| `PASS` | — | Pass the current turn. |
| `ANSWER_CHALLENGE` | `answer: number` | Submit an answer to an active arithmetic challenge. |
| `CHEAT_WIN` | — | (Testing only) Instantly empties the player's hand to trigger scoring. |

**Helpers:** `withTimestamp(action)`, `assertTurn(turn, action)`.

---

### `gameEngine.ts`

High-level match orchestrator wrapping `rules.ts`.

**`GameState` fields:** `gameId`, `sys`, `round`, `scoresDec`, `status`, `actionLog`, `lastSnapshot`, `activeChallenge`, `lastRoundResult`.

**Key functions:**

| Function | Description |
| :--- | :--- |
| `createGame(opts)` | Factory: initializes a full `GameState` for two players in a chosen base. |
| `applyAction(game, action)` | Main entry point: applies PLAY/DRAW/PASS/ANSWER_CHALLENGE/CHEAT_WIN, handles end-of-round scoring, and auto-passes when neither player can move. |
| `undo(game)` | Reverts to `lastSnapshot`. |
| `getPublicState(game)` | Returns a safe broadcast object: hides hands (shows counts), strips the challenge answer, formats scores in the current base, and includes `lastRoundResult` with base-aware text. |

**Arithmetic challenge flow:** Correct `ANSWER_CHALLENGE` awards `reward` points immediately. If those points push the player past `targetScoreText`, the game ends mid-round.

---

### `index.ts`

Barrel file — re-exports everything from `baseConversion`, `systems`, `rules`, `scoring`, `gameActions`, and `gameEngine`. Always import from `@rev0/shared` (not from individual files).

---

## `backend` Package

### Storage Layer

The backend transparently supports two repositories, selected at startup via the `USE_INMEMORY` environment variable:

| Mode | Repository | Audit |
| :--- | :--- | :--- |
| `USE_INMEMORY=true` | `InMemoryRepository` (Map-based, volatile) | `InMemoryAuditStore` |
| Default | `PgRepository` (PostgreSQL) | `PgAuditStore` |

**PostgreSQL schema** (`modules/db/init.sql`): idempotent — safe to re-run on every startup. Tables: `players`, `credentials`, `match_results`, `audit_events`, `game_states`. Indexes on `match_results(player_id)`, `audit_events(kind)`, `audit_events(timestamp)`.

---

### `types/`

#### `repository.ts`
Defines `Repository` interface — all methods used by services (`findPlayerByUsername`, `createPlayer`, `storeCredential`, `saveMatchResult`, `getMatchHistory`, `getPlayerStats`, `searchPlayers`, `clearMatchHistory`, `changePassword`, `clearSessionIat`, `saveGameState`, `getGameState`, etc.).

Also defines `Lobby`, `LobbyID`, `MatchResult`, `PlayerStats`, `Player`, and `CredentialRecord` types.

#### `audit.ts`
Defines `AuditStore` interface and event types: `AuthAuditEvent`, `GameplayAuditEvent`, `SystemAuditEvent`.

#### `auth.ts`
Defines `TokenClaims` (JWT payload with `userId`, `username`, `role`, `iat`, `exp`), `SessionToken`, and `AuthResult`.

#### `errors.ts`
Custom error class hierarchy: `RecordNotFound`, `UniqueConstraintViolation`, `DatabaseConnectionError`, `InvalidCredentials`, `UsernameTaken`, `WeakPassword`, `InvalidToken`, `ExpiredToken`, `ActiveSessionExists`, and more.

#### `matchmakingTypes.ts`
Defines `Lobby` with `hostId`, `guestId`, `hostUsername`, `baseId`, `status` (`OPEN` | `STARTED`).

---

### `modules/auth/`

#### `authService.ts`
Business logic: registers players, hashes passwords (bcrypt), issues JWTs, verifies tokens, creates guest sessions, changes passwords, and validates admin credentials. All significant events are logged to `AuditStore`.

| Method | Description |
| :--- | :--- |
| `createAccount` | Register → hash PW → issue JWT |
| `login` | Verify credentials → issue JWT (prevents concurrent logins via `session_iat`) |
| `createGuestSession` | Guest token with a random UUID, no DB write |
| `loginAsAdmin` | Admin-only auth via `ADMIN_USER`/`ADMIN_PASS` env vars |
| `verifyToken` | Decode + validate JWT signature and expiry |
| `changePassword` | Self-service password change |

#### `authRoutes.ts`
REST endpoints under `/api/v1/auth/`:

| Method | Path | Description |
| :--- | :--- | :--- |
| POST | `/register` | Create a permanent account |
| POST | `/login` | Authenticate with credentials |
| POST | `/guest` | Start a guest session |
| POST | `/logout` | Log the audit event |
| POST | `/refresh` | Issue a new JWT from a valid existing token |

#### `authMiddleware.ts`
- **`requireAuth(auth)`**: Validates Bearer token; attaches `req.user` (`userId`, `username`, `role`). Returns `401` if missing/invalid.
- **`requireUser(auth)`**: Like `requireAuth` but additionally rejects guest roles with `403`.
- **`requireAdmin(auth)`**: Rejects non-admin tokens with `403`.

---

### `modules/matchmaking/matchmakingService.ts`

Manages lobbies in a `Map<LobbyID, Lobby>`.

| Method | Description |
| :--- | :--- |
| `createLobby(hostId, displayName, baseId)` | Creates an `OPEN` lobby with a unique ID |
| `joinLobby(lobbyId, guestId)` | Fills the guest slot |
| `startMatch(lobbyId, hostId)` | Initializes `GameState` via `createGame`; returns `{ gameId, game, lobby, publicState }` |
| `getLobby(lobbyId)` | Retrieve lobby state |
| `leaveLobby(lobbyId, userId)` | Host leaving deletes room; guest leaving reopens it |
| `deleteLobby(lobbyId)` | Admin force-delete |
| `listOpenRooms()` | Returns all lobbies with enriched metadata |

---

### `modules/realtimeGateway/`

#### `events.ts`
Centralizes Socket.io event name constants in a `WS` object to prevent magic-string bugs.

| Constant | Direction | Payload |
| :--- | :--- | :--- |
| `WS.JOIN_GAME` | Client → Server | `{ gameId }` |
| `WS.SUBMIT_ACTION` | Client → Server | `{ gameId, action: GameAction }` |
| `WS.GAME_STATE` | Server → Client | `PublicState` (broadcast to room) |
| `WS.MY_HAND` | Server → Client | `{ hand: Card[] }` (private, per-socket) |
| `WS.ERROR` | Server → Client | `{ code, message }` |
| `WS.CHAT_MESSAGE` | Bidirectional | `{ from, text, ts }` |
| `WS.RESTART_REQUEST` | Bidirectional | `{ gameId, requesterId }` |
| `WS.CHALLENGE_RESULT` | Server → Client | Challenge outcome per player |
| `WS.CHALLENGE_RESOLUTION` | Server → Client | Final resolution with correct answer |
| `WS.OPPONENT_LEFT` | Server → Client | Notification when opponent disconnects |
| `WS.FORCE_DISCONNECT` | Server → Client | Admin forced-logout kick |

#### `realtimeGateway.ts`

Real-time hub. Authenticates every WebSocket connection via JWT. Manages per-game rooms (`game:<gameId>`).

**Key event handlers:**

| Event | Logic |
| :--- | :--- |
| `connection` | Validates JWT; attaches `socket.userId`. |
| `JOIN_GAME` | Verifies participant; joins room; sends `GAME_STATE` + `MY_HAND`. |
| `SUBMIT_ACTION` | Applies action via `applyAction`; broadcasts new state; handles challenge scoring and resolution; records final match results in repo. |
| `CHAT_MESSAGE` | Relays message to all players in room. |
| `RESTART_REQUEST` | Negotiates two-player rematch consent; reinitializes game on mutual accept. |
| `disconnect` | Logs disconnection; notifies opponent via `OPPONENT_LEFT`. |

**Internal helpers:** `emitMyHand`, `emitHandsToRoom`, `emitError`, `forceDisconnectUser`, `kickUserFromRoom` (for admin actions).

---

### `api/` (REST Routes)

All routes are mounted under `/api/v1`:

#### `auth.ts` → `/auth`
See authRoutes above.

#### `lobby.ts` → `/lobby`

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/list` | List all open rooms (public) |
| POST | `/create` | Create a room; resolves host's display name from repo |
| POST | `/join` | Join an existing room |
| POST | `/start` | Host starts the match; initializes `GameState` in `gameSessions` |
| GET | `/status?lobbyId=` | Poll lobby state and associated `gameId` |
| POST | `/leave` | Leave a room |

#### `profile.ts` → `/profile`

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/` | Fetch profile, stats, last 5 match results (with challenge stats) |
| PUT | `/nickname` | Update display name |
| PUT | `/password` | Self-service password change |
| DELETE | `/` | Delete account (clears session, removes player record) |

#### `admin.ts` → `/admin` *(requires admin token)*

| Method | Path | Description |
| :--- | :--- | :--- |
| POST | `/login` | Admin login (returns admin JWT) |
| GET | `/players?q=` | Search players; returns stats alongside each result |
| POST | `/reset-password` | Force-reset a player's password + invalidate their session |
| POST | `/clear-history` | Wipe a player's match history |
| POST | `/force-logout` | Invalidate session + kick via WebSocket |
| GET | `/rooms` | List all open lobbies |
| POST | `/delete-room` | Delete a lobby + kick affected players from WS room |

#### `health.ts` → `/health`
Simple `GET /health` returning `200 OK`.

---

### `app.ts`
Express application factory (`createApp`). Configures CORS, JSON parsing, a global auth interceptor (attaches `req.userId` from Bearer token if present, without blocking), and mounts all routers under `/api/v1`. Injects all service dependencies to keep the app decoupled and testable.

### `index.ts`
Composition root. Selects storage backend (in-memory or PostgreSQL), wires all services, creates the shared `gameSessions` Map (used by both REST and WebSocket), creates the HTTP server, attaches Socket.io, and starts listening.

---

## `frontend` Package

A Vite + React 18 SPA. The `App.tsx` root manages authentication state, routing between screens (Login → Lobby → Game / Profile / Admin), and the main Socket.io connection lifecycle.

### Components

| Component | Purpose |
| :--- | :--- |
| `LobbyScreen` | Login/Register/Guest screen, animated card background, base-mode selector (Dozenal / Decimal / Octal), room list with auto-refresh, host/join/start flow. |
| `GameScreen` | Full game board: opponent hand (face-down), top card with drag-and-drop, player hand with sort (by rank / by suit), turn indicator, per-base score display, round-end and game-over modals, rematch flow, chat, in-game hints panel (rules / addition table / multiplication table), card-back customization (6 options), wildcard suit picker, arithmetic operation picker for face cards, highlight filters (suit/rank/sum), victory animation effects. |
| `ArithmeticPopup` | Full-Base arithmetic challenge UI with base-aware numpad, countdown timer (60 s), one-attempt lock-out, real-time resolution message that persists after the server clears the challenge. |
| `Card` | Renders a single playing card (face-up or face-down), with suit symbols, rank, color, and custom card-back image support. |
| `CardEffects` | Overlay animations triggered on skip / wildcard / face-card plays. |
| `GameBoard` | Intermediate board layout wrapper. |
| `GameTable` | Table area layout (draw pile + discard pile). |
| `PlayerHand` | Renders the player's hand grid with selection state. |
| `ProfilePage` | Player stats (W/L/D, win rate), last 5 match history with per-match challenge stats (🎯 correct/attempted, ⚡ first-to-answer), nickname editor, password change, account deletion. |
| `AdminPage` | Admin panel: player search, password reset, history clear, force-logout, game room list/delete. |

### Hooks

#### `useGameState.ts`
Manages the Socket.io connection lifecycle, state synchronization, and action dispatch:
- `connect()` / `disconnect()`: Manage the socket.
- `joinGame()`: Emits `JOIN_GAME` to enter a room.
- `playCard()` / `drawCard()` / `passTurn()` / `selectSuit()`: Emit `SUBMIT_ACTION`.
- Returns: `publicState`, `myHand`, `isPlayerTurn`, `topCard`, `playableCards`, `selectedCard`, `showSuitSelector`, `connected`, `message`.

### `types/game.ts`
Shared frontend type definitions and utility helpers:
- `PublicState`, `Card`, `Suit`, `MathChallenge` types.
- `WS_EVENTS` constants (mirrors backend events).
- `getPlayableCards()`, `isWildcard()`, `sanitizeDozenalDisplay()`, `getChallengeLabel()`, `computeChallengeAnswer()`, `getCardId()`, `isSelectOpCard()`.

---



## Known Limitations & Roadmap

### Data Persistence
- **Current**: PostgreSQL is supported. `InMemoryRepository` remains as a dev fallback (`USE_INMEMORY=true`).
- **Planned**: Redis for `gameSessions` caching to handle server restarts and horizontal scaling.

### Security
- **Current**: Bcrypt hashing, JWT auth, concurrent-login prevention via `session_iat`, admin-only middleware.
- **Planned**: HTTPS enforcement, rate limiting, stricter input sanitization.

### Octal Mode
- **Current**: Marked experimental (🧪). Core gameplay works; Arithmetic Challenges (requiring a face card `K`/`C`) are skipped since Octal only has J/Q as face cards.
- **Planned**: Full challenge support if octal mode is promoted to stable.

### Testing Coverage
- **Current**: Unit tests cover the `shared` engine. Frontend and backend integration tests are minimal.
- **Planned**: End-to-end WebSocket tests; integration tests for REST API.
