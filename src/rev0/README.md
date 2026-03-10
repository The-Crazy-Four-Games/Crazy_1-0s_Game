# Hierarchy
- **shared**: the source of truth for game rules/state machine.
- **backend**: REST for auth/lobby + WebSocket for realtime game updates.
- **frontend**: UI only (calls backend + listens to WS).

---

## Prerequisites

- Node.js (recommended: v18+)
- npm
- (Optional) WSL/Linux recommended if you want same dev env as mine.

---

## Quick start (recommended order)

### 1) Install dependencies

From `rev0/`:

```bash
cd shared
npm install

cd ../backend
npm install

cd ../frontend
npm install
```
### 2) Build shared
`shared` must be built so backend/frontend can import it correctly.

```bash
cd rev0/shared
npm run build
```

### 3) Start backend
```bash
cd rev0/backend
npm run dev
```

### 4) Start frontend
same as above

### 5) What I implemented
`shared` package:
exports the core engine:
`createGame(opts)`->creates a new `GameState`
`applyAction(game,action)`->returns next state
`getPublicState(game)`->returns a view safe to show publicly

Game rules now:
+ wildcard (`10` + `5`for skip)
+ 3 draw limit, auto-pass + freeplay for opponent if still no playable cards
+ forced suit after playing `10`
+ decimal/dozenal base support, symbol sets (dozenal includes ↊ ↋ and face card C)

#### `shared/src/baseConversion.ts`

This utility manages conversion between standard integers and **Base-12 (Dozenal)**.

- **Symbols**: Uses `0-9`, `↊` (10), and `↋` (11).
- **Aliases**: Accepts `A`/`X` for `↊` and `B`/`E` for `↋` to simplify user input.
- **Key Exports**:
  - `decimalToDozenal(n)`: Converts JS number to Base-12 string (for UI display).
  - `dozenalToDecimal(s)`: Parses Base-12 string to JS number (for calculations).
  - `isValidDozenal(s)`: Boolean check for valid Base-12 input.
  - `normalizeDozenal(s)`: Trims and converts aliases to canonical symbols.

**Example:**
```typescript
decimalToDozenal(22);  // "1↊"
dozenalToDecimal("1↋"); // 23
```

#### `shared/src/systems.ts`

Defines the **Numeral System configurations** for the game, handling deck rules and scoring constants for both Decimal (Base-10) and Dozenal (Base-12).

- **`NumeralSystem` Type**: Contains deck symbols, face card ranks (`J`, `Q`, `K`, etc.), and base-specific target goals.
- **`DECIMAL_SYSTEM`**: Standard base-10 setup.
- **`DOZENAL_SYSTEM`**: Base-12 setup using symbols `↊` and `↋`. Note that `targetSumText: "10"` in this system equals **12** in decimal.
- **Key Exports**:
    - `SYSTEMS`: A registry of available systems.
    - `getSystem(id)`: Helper to retrieve the config by ID (`'dec'` or `'doz'`).
    - `Suit`: Type for card suits (`S`, `H`, `D`, `C`).

**Example for Frontend:**
```typescript
const currentSystem = getSystem("doz");
console.log(currentSystem.targetSumText); // "10" (represents twelve)
console.log(currentSystem.faceRanks);     // ["J","Q","K","C"]
```
#### `shared/src/rules.ts`

This file implements the **Core Game Engine**. It handles state transitions, deck management, and move validation for the card game.

- **`RoundState` Type**: The definitive state object containing the `deck`, `discard` pile, `hands` for each player, the current `turn`, and `drawCount`.
- **Core Play Rules**:
    - **Sum Rule**: A card is playable if the sum of its rank and the `topCard` rank equals the system's target (e.g., 12 in Dozenal).
    - **Wildcards**: 
        - `wildcardTen`: Allows the player to set a `forcedSuit`.
        - `wildcardSkip`: Grants the same player another turn with a `freePlay` status (can play any card).
- **Turn Flow & Draw Logic**:
    - Players can draw up to 3 times per turn.
    - If no cards are playable after 3 draws, the turn is automatically passed, and the opponent is granted a `freePlay` penalty.

##### Core Functions

| Function | Description |
| :--- | :--- |
| `isPlayable` | Validates if a specific move is legal based on suits, ranks, sums, or wildcards. |
| `applyPlay` | Executes a play move, updates the state, and handles wildcard side-effects. |
| `applyDraw` | Handles drawing a card and the logic for automatic turn passing after 3 failed draws. |
| `initRound` | Shuffles the deck and initializes a fresh `RoundState` for two players. |

##### Logic Example
```typescript
// Example of a game loop step
if (isPlayable(system, state, player, card)) {
  const newState = applyPlay(system, state, player, card, chosenSuit);
  // Broadcast newState to all clients
}
```

#### `shared/src/scoring.ts`

This utility manages the calculation of scores based on the cards remaining in a player's hand, supporting both decimal values for logic and formatted strings for display.

##### Scoring Logic
* **Card Valuation**: 
    * **Numeric Cards**: Worth their actual face value (e.g., "7" is 7 points).
    * **Face Cards**: Worth a fixed point value defined in the `NumeralSystem` (e.g., 10 points).
* **Round Outcome**: The winner of a round earns points equal to the total value of the cards left in the loser's hand.

##### Core Functions

| Function | Description |
| :--- | :--- |
| `handPointsDec` | Sums the decimal point values of all cards in a specific hand. |
| `roundGainDec` | Calculates the total points the winner earns (decimal format). |
| `roundGain` | Returns a combined result: the decimal total and the formatted text in the current base (e.g., "1↊" for 22 in Dozenal). |

##### Logic Example
```typescript
const winnerEarnings = roundGain(loserHand, system);
// Result: { gainDec: 22, gainText: "1↊" }
```

#### `shared/src/gameActions.ts`

This file defines the **standardized action types** that can be dispatched by players. It serves as the protocol for communication between the frontend and backend.

##### Action Types & Validation
* **`GameAction` Union**: Defines the three primary interactions allowed in the game:
    * `PLAY`: Playing a card from hand (includes optional `chosenSuit` for wildcards).
    * `DRAW`: Drawing a card from the deck.
    * `PASS`: Passing the turn (usually after draw limits or specific rules).
* **Metadata**: Every action includes a `playerId` and an optional `at` (timestamp) for auditing or synchronization.

##### Core Functions

| Function | Description |
| :--- | :--- |
| `withTimestamp` | Ensures an action has a `Date.now()` timestamp if one isn't already provided. |
| `assertTurn` | A safety check that throws an error if the player attempting the action is not the one currently assigned the turn. |

##### Action Structure Example
```typescript
// Example of a PLAY action for a wildcard
const action: GameAction = {
  type: "PLAY",
  playerId: "player_1",
  card: { suit: "S", rank: "↊" },
  chosenSuit: "H",
  at: Date.now()
};
```

#### `shared/src/gameEngine.ts`

This file acts as the **high-level orchestrator** for the entire game. It wraps the low-level rules into a persistent `GameState`, manages multiple rounds, and tracks overall scores.

##### Game Management & State
* **`GameState` Type**: The complete container for a match. It includes the `NumeralSystem`, current `RoundState`, cumulative `scoresDec`, an `actionLog` for history, and a `status` (ONGOING/GAME_OVER).
* **Round Transitions**: When a round ends (a player empties their hand), the engine automatically calculates points, updates the total score, and determines if it should start a new round or end the game based on the `targetScoreText`.
* **Undo Support**: Maintains a `lastSnapshot` to allow reverting the game to its previous state.

##### Core Functions

| Function | Description |
| :--- | :--- |
| `createGame` | Factory function to initialize a full match state for two players in a chosen base (e.g., "doz"). |
| `applyAction` | The primary entry point for gameplay. Processes a `GameAction` (PLAY, DRAW, or PASS), validates the turn, updates the round, and handles end-of-round scoring logic. |
| `undo` | Reverts the `GameState` to the version stored in `lastSnapshot`. |
| `getPublicState` | Filters the internal state into a safe object for broadcasting to clients. It replaces private hand data with counts and provides scores formatted in the current numeral system. |

##### Logic Example
```typescript
// Initializing a match
let game = createGame({ players: ["Alice", "Bob"], baseId: "doz" });

// Handling an incoming action
try {
  game = applyAction(game, { type: "DRAW", playerId: "Alice" });
} catch (e) {
  console.error("Invalid move:", e.message);
}

// Checking total score in system-specific text
console.log(getPublicState(game).scoresText); // e.g., { Alice: "1↊", Bob: "5" }
```

#### `shared/src/index.ts`

This is the **Central Entry Point** (Barrel File) for the `shared` library. It exports all shared logic, types, and constants to be used by both the `frontend` and `backend` packages.

##### Module Organization
* **Consolidation**: Instead of importing from individual files, you should import everything from this central index to maintain clean and consistent import paths across the workspace.
* **Unified API**: It bundles the following modules:
    * **`baseConversion`**: Generic radix logic.
    * **`systems`**: Numeral system configurations (Decimal vs. Dozenal).
    * **`rules`**: Low-level card game logic and state.
    * **`scoring`**: Point calculation logic.
    * **`gameActions`**: Action type definitions and turn assertions.
    * **`gameEngine`**: High-level match management and state orchestration.

`backend` package:

#### `backend/src/types/audit.ts`

This file defines the **Audit Logging System** architecture. It is used to track security-sensitive actions, gameplay history, and system-level events for debugging and compliance.

##### Event Categories
* **`AuthAuditEvent`**: Tracks authentication lifecycle (register, login, guest access, logout, and failed verifications).
* **`GameplayAuditEvent`**: Records in-game player actions (e.g., "play_card").
* **`SystemAuditEvent`**: Captures backend lifecycle events like server startup or critical configuration changes.

##### Audit Infrastructure
* **`AuditEvent`**: A union type combining all event kinds, uniquely identified by an `id`.
* **`AuditQueryFilter`**: Provides standard parameters (timestamp ranges, player IDs, action types) for searching logs.
* **`AuditStore` (Interface)**: Defines the persistence contract for the auditing system. Any database implementation must satisfy these methods.

##### Interface Methods

| Method | Description |
| :--- | :--- |
| `log[Kind]Event` | Asynchronously persists specific event types to the store. |
| `queryAuditEvents` | Retrieves filtered logs for administrative or analytical purposes. |
| `purgeExpiredEvents` | Maintenance task to remove old logs based on a retention policy. |
| `redactEventPayload` | Security feature to mask sensitive data within a specific log entry. |

#### `backend/src/types/errors.ts`

This file defines a **custom error hierarchy** for the backend, categorizing failures into specific types. Using these classes instead of generic `Error` objects allows the backend and frontend to implement precise error handling and user feedback.

##### Error Categories

| Category | Error Classes | Description |
| :--- | :--- | :--- |
| **Persistence** | `RecordNotFound`, `UniqueConstraintViolation`, `DatabaseConnectionError` | Failures related to database operations, connectivity, or data constraints. |
| **Authentication** | `InvalidCredentials`, `UsernameTaken`, `WeakPassword` | User-facing failures during registration or login. |
| **Security/JWT** | `InvalidToken`, `ExpiredToken`, `TokenSigningError` | Failures related to session validation, token integrity, or expiration. |
| **Storage Internal** | `CredentialStoreError`, `LogStoreError` | Internal failures within the underlying storage implementations for users or logs. |

##### Key Benefits
* **Type Safety**: Use `instanceof` in catch blocks to differentiate between a simple user error (like `InvalidCredentials`) and a system failure (like `DatabaseConnectionError`).
* **Consistency**: Standardizes error names across the backend, preventing mismatched string comparisons in logic.

#### `backend/src/types/repository.ts`

This file defines the **Core Persistence Layer** interfaces. It abstracts all database interactions related to players, authentication credentials, and match statistics.

##### Data Models
* **`Player` & `PlayerData`**: Represent user profiles. Distinguishes between internal unique `PlayerID` and user-facing `username` or `displayName`.
* **`CredentialRecord`**: Securely links a `username` and `passwordHash` to a `PlayerID`.
* **`MatchResult` & `PlayerStats`**: Tracks game outcomes (`win`, `lose`, `draw`) and aggregates performance data for individual players.

##### Repository Interface
The `Repository` interface dictates how the backend services interact with the data store.

| Category | Methods | Description |
| :--- | :--- | :--- |
| **Profile** | `findPlayerByUsername`, `findPlayerById`, `createPlayer`, `updatePlayerProfile`, `deletePlayer` | CRUD operations for managing player accounts and profile settings. |
| **Auth** | `storeCredential`, `getCredentialByUsername` | Methods for persisting and retrieving hashed passwords during login/registration. |
| **Stats** | `saveMatchResult`, `getMatchHistory`, `getPlayerStats` | Records game ends and retrieves player performance metrics. |

##### Implementation Note
This is an **interface**. The actual implementation (e.g., using PostgreSQL, MongoDB, or an In-Memory store) must adhere to these method signatures to ensure the `backend` services remain decoupled from the specific database technology.

##### Matchmaking Models
* **Lobby**: Represents a virtual room where players wait for a match to start.
* **Lobby Status**: 
    * `OPEN`: The host is waiting for a second player (guest) to join.
    * `STARTED`: Both players are ready and the game session has been initialized.

##### Type Definitions

| Type | Structure | Description |
| :--- | :--- | :--- |
| `LobbyID` | `string` | A unique identifier for the matchmaking room. |
| `Lobby` | `object` | Contains the `hostId`, an optional `guestId`, and a `status` flag. |
| `UserID` | `string` | Alias for the player's unique identifier. |

##### Implementation Detail
The `Lobby` type is marked as `Readonly` to encourage an immutable state pattern within the matchmaking service, preventing accidental direct mutations of the lobby state.

#### `backend/src/types/auth.ts`

This file defines the **Authentication and Session** data structures, specifically focusing on JWT (JSON Web Token) payloads and successful login responses.

##### Auth Data Structures
* **`TokenClaims`**: Represents the payload encoded inside a JWT.
    * `iat` (Issued At) and `exp` (Expires At) are standard Unix timestamps used to manage session longevity.
    * Includes `role` to distinguish between "guest" and "user" for permission-based logic.
* **`AuthResult`**: The standard object returned to the client upon successful authentication (Login, Registration, or Guest entry). It contains the active `token` and a summary of the `user` profile.

##### Key Types

| Type | Description |
| :--- | :--- |
| `SessionToken` | A string alias for the JWT string passed in the `Authorization` header. |
| `TokenClaims` | The decoded content of a token, used by the backend to identify the requester. |
| `AuthResult` | The expected response body for authentication-related API endpoints. |

#### `backend/src/modules/audit/inMemoryAudit.ts`

This file provides an **In-Memory implementation** of the `AuditStore` interface. It is primarily used for local development, testing, or MVP stages where a persistent database (like PostgreSQL) is not yet required.

##### Implementation Details
* **Volatile Storage**: Data is stored in a private array (`events`). All logs will be lost when the server restarts.
* **Automatic ID Generation**: Uses `crypto.randomUUID()` to ensure every log entry has a unique identifier.
* **Filtering & Sorting**: Supports complex queries via `queryAuditEvents`, returning the most recent events first by default.

##### Core Methods

| Method | Logic |
| :--- | :--- |
| `log[Kind]Event` | Assigns a UUID and the appropriate `kind` tag before pushing to the array. |
| `queryAuditEvents` | Applies multiple filters (ID, timestamp, action) and returns a sorted, sliced array. |
| `purgeExpiredEvents` | Calculates a cutoff timestamp based on `retentionDays` and removes older entries. |
| `redactEventPayload` | Locates a specific event and masks sensitive fields in the `meta` object with `[REDACTED]`. |

##### Usage Note
Because this implementation is asynchronous (`async/await`), it can be swapped out for a real database implementation later without changing any business logic in the services that call it.

Markdown
#### `backend/src/modules/auth/authService.ts`

This file contains the **Business Logic for Authentication**. It acts as the bridge between the raw data (Repository) and the API, handling password hashing, JWT management, and session creation.

##### Core Responsibilities
* **Identity Management**: Handles user registration (`createAccount`), login, and temporary guest sessions.
* **Security**: Uses **Bcrypt** for password hashing and **JSON Web Tokens (JWT)** for stateless session management.
* **Auditing**: Automatically logs authentication success and failure events (e.g., login attempts, registrations) to the `AuditStore`.
* **Validation**: Enforces basic password strength and ensures usernames are unique.

##### Core Functions

| Function | Description |
| :--- | :--- |
| `createAccount` | Registers a new player, hashes their password, and returns a signed JWT. |
| `login` | Verifies credentials against the database. Logs failed attempts for security monitoring. |
| `createGuestSession` | Generates a temporary session for users who don't want to register (uses a random UUID). |
| `verifyToken` | Decodes a JWT and validates its signature and expiration date. |
| `issueToken` | Creates a new JWT signed with the server's secret and a defined TTL (Time-To-Live). |

#### `backend/src/modules/auth/authRoutes.ts`

This file defines the **Express API Endpoints** for the authentication module. It maps HTTP requests to the corresponding methods in `AuthService` and handles HTTP status code responses.

##### API Endpoints

| Method | Path | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| **POST** | `/register` | Creates a new permanent user account. | `200` (Success), `409` (Conflict), `400` (Bad Request) |
| **POST** | `/login` | Authenticates existing users with credentials. | `200` (Success), `401` (Unauthorized) |
| **POST** | `/guest` | Creates a temporary guest session using a `deviceId`. | `200` (Success) |
| **POST** | `/logout` | Logs the audit event for a session termination. | `200` (Success) |
| **POST** | `/refresh` | Generates a new JWT based on a valid existing token. | `200` (Success) |

##### Implementation Details
* **Error Mapping**: Converts internal domain errors (like `UsernameTaken`) into appropriate HTTP status codes (like `409 Conflict`).
* **Input Sanitization**: Casts request body fields to strings to prevent type-mismatch crashes.
* **Router Factory**: Uses the `makeAuthRouter` pattern to inject the `AuthService` dependency, making it easily testable.

#### `backend/src/modules/auth/authMiddleware.ts`

This file provides **Express Middleware** to protect backend routes. It intercepts requests to verify identities and manage access control before the request reaches the actual route handler.

##### Authentication Logic
* **Global Request Extension**: Extends the Express `Request` type to include a `user` object, allowing downstream handlers to access the authenticated player's `userId`, `username`, and `role`.
* **Bearer Token Extraction**: Automatically parses the `Authorization` header, expecting the `Bearer <token>` format.
* **Token Validation**: Uses `AuthService` to verify the JWT. It handles specific error cases like expired or malformed tokens by returning standard HTTP 401 statuses.

##### Provided Middlewares

| Middleware | Description |
| :--- | :--- |
| `requireAuth` | Basic protection. Ensures a valid token (Guest or Registered User) is present. Returns `401 Unauthorized` if missing or invalid. |
| `requireUser` | Strict protection. Ensures the player is a registered **"user"**. Returns `403 Forbidden` if the player is only a "guest". |

#### `backend/src/modules/matchmaking/matchmakingService.ts`

This file handles the **Matchmaking Lifecycle**, managing how lobbies are created, joined, and eventually transitioned into active game sessions.

##### Lobby Management & Error Handling
* **State Persistence**: Uses an internal `Map` to track active lobbies.
* **Custom Exceptions**: Defines specific errors such as `LobbyNotFound`, `LobbyFull`, and `NotLobbyHost` to provide clear feedback for failed operations.
* **Audit Integration**: Every significant transition (Create, Join, Start) is logged to the `AuditStore` for system monitoring.

##### Core Functions

| Function | Description |
| :--- | :--- |
| `createLobby` | Generates a new lobby with a unique ID and assigns the caller as the `hostId`. |
| `joinLobby` | Allows a second player to occupy the `guestId` slot. Prevents joining if the lobby is full or already started. |
| `startMatch` | Validates that both players are present and that the caller is the host. It then calls the **Shared Game Engine** to initialize the actual `GameState`. |
| `getLobby` | Simple retrieval helper to check the current status of a lobby. |

#### `backend/src/modules/realtimeGateway/events.ts`

This file defines the **Socket.io Event Constants** and the associated data payloads. It acts as the "Contract" for real-time communication between the frontend and backend.

##### WebSocket Protocol
* **Centralized Constants**: Uses a `WS` object to store event names. This prevents "magic string" bugs—if you change an event name here, it updates across the entire system.
* **Directional Flow**:
    * **Client $\rightarrow$ Server**: For user-initiated intents (joining a room or making a move).
    * **Server $\rightarrow$ Client**: For broadcasting state updates or notifying the user of errors.

##### Event Registry

| Event Constant | Direction | Payload Type | Description |
| :--- | :--- | :--- | :--- |
| `WS.JOIN_GAME` | Client $\rightarrow$ Server | `JoinGamePayload` | Sent when a player enters a specific game room. |
| `WS.SUBMIT_ACTION` | Client $\rightarrow$ Server | `SubmitActionPayload` | Sent when a player plays a card, draws, or passes. |
| `WS.GAME_STATE` | Server $\rightarrow$ Client | `unknown` (PublicState) | Broadcasts the updated game board to all connected players. |
| `WS.ERROR` | Server $\rightarrow$ Client | `{ message: string }` | Notifies the specific client if their action was illegal or failed. |

#### `backend/src/modules/realtimeGateway/realtimeGateway.ts`

This file is the **Real-time Communication Hub**. It manages WebSocket connections, player authentication for sockets, and synchronizes the game state between the server and all connected clients.

##### Real-time Security & Flow
* **Socket Authentication**: Every connection must provide a valid JWT (via `handshake.auth` or headers). The `requireUser` function verifies the token before allowing any interaction.
* **State Separation**: 
    * **Public State**: Broadcasted to everyone in the room (e.g., scores, top card, card counts).
    * **Private State (`WS.MY_HAND`)**: Targeted specifically to individual sockets so players only see their own cards.
* **Room Management**: Uses `game:${gameId}` rooms to ensure that actions and state updates are only sent to the players involved in that specific match.

##### Event Handlers

| Event | Logic |
| :--- | :--- |
| **`connection`** | Validates the token and attaches the `userId` to the socket instance. |
| **`JOIN_GAME`** | Validates that the user is a participant, adds them to the room, and sends the initial game data. |
| **`SUBMIT_ACTION`** | Verifies the player's identity, applies the logic via `applyAction`, updates the session, and broadcasts the new state. |
| **`disconnect`** | Logs the disconnection for auditing purposes. |

##### Internal Helpers

| Helper | Description |
| :--- | :--- |
| `emitMyHand` | Sends the specific player's card list to their unique socket. |
| `emitHandsToRoom` | Iterates through all sockets in a room and sends each player their unique private hand data. |
| `emitError` | Sends a formatted error object (`code` and `message`) to the client. |

#### `backend/src/modules/repository/inMemoryRepository.ts`

This file provides a **volatile, in-memory implementation** of the `Repository` interface. It stores all player data, credentials, and match statistics in local `Map` objects.

##### Storage Mechanisms
* **Maps**: Uses separate maps to link IDs to players, usernames to IDs, and usernames to credentials for $O(1)$ lookups.
* **Transient State**: Since data is held in RAM, it will be cleared every time the server restarts. This is ideal for development and testing environments.
* **Concurrency**: Uses `async` methods to simulate real database behavior, allowing for a seamless transition to a persistent database (like MongoDB or PostgreSQL) in the future.

##### Core Methods

| Category | Logic |
| :--- | :--- |
| **Player Management** | Handles account creation with unique username checks and profile updates. Generates unique IDs using `crypto.randomUUID()`. |
| **Authentication** | Stores hashed passwords in `credentialsByUsername`. Throws `UniqueConstraintViolation` if the account already exists. |
| **Match History** | Tracks individual `MatchResult` objects in a list per player ID. |
| **Statistics** | Aggregates wins, losses, and draws on-the-fly when `getPlayerStats` is called. |
| **Game Persistence** | Provides `saveGameState` and `getGameState` to temporarily cache active match snapshots. |

##### Implementation Detail

The class strictly adheres to the custom errors defined in `backend/src/types/errors.ts`. For example, attempting to find a non-existent user will consistently throw a `RecordNotFound` error, which the auth middleware and routes are already configured to handle.

#### `backend/src/app.ts`

This file is the **Express Application Factory**. It configures the global middleware, initializes the routing hierarchy, and sets up the foundational request context for the entire REST API.

##### Configuration & Middleware
* **CORS & JSON**: Enables Cross-Origin Resource Sharing (essential for the React frontend) and provides built-in parsing for JSON request bodies.
* **Global Auth Interceptor**: A lightweight middleware that attempts to extract a JWT from the `Authorization` header. If successful, it attaches the `userId` to the request object. Unlike `requireAuth`, this does not block the request; it simply populates user data if available.
* **Dependency Injection**: The `createApp` function takes a `deps` object containing all core services (Auth, Repository, Audit, Matchmaking), ensuring the app remains decoupled and easy to test.

##### API Structure

| Layer | Responsibility |
| :--- | :--- |
| **App Level** | Global middleware (CORS, JSON parsing). |
| **Auth Level** | Pre-processing Bearer tokens for all incoming requests. |
| **Routing Level** | Delegating endpoint logic to the Version 1 (`/api/v1`) router. |

#### `backend/src/index.ts`

This is the **Main Entry Point** of the backend application. It wires together all the independent modules, sets up the server infrastructure, and initiates the listening loop. It serves as the "Composition Root" for the entire system.

##### System Orchestration
1.  **State & Storage**: Initializes the volatile `InMemoryRepository` and `InMemoryAuditStore`.
2.  **Service Layer**: Configures the `AuthService` with security parameters (JWT secret, TTL, salt rounds) and creates the `MatchmakingService`.
3.  **Shared State**: Creates a single `gameSessions` Map. This is crucial as it is **shared** between the REST API (via `createApp`) and the WebSocket gateway, ensuring both protocols access the same game data.
4.  **Hybrid Server**: Wraps the Express `app` inside a native Node.js `http` server to allow **Socket.io** to run alongside the standard REST endpoints on the same port.

##### Server Components

| Component | Responsibility |
| :--- | :--- |
| **Express App** | Handles standard HTTP requests (Login, Register, Matchmaking API). |
| **Socket.io Server** | Manages real-time, bidirectional gameplay events. |
| **Realtime Gateway** | Binds the Socket.io instance to the game logic and auth services. |



##### Environment Configuration
The server is built to be "Twelve-Factor" friendly, using environment variables for sensitive or variable configurations:
* `JWT_SECRET`: Used for signing session tokens (defaults to a dev string).
* `PORT`: The port the server binds to (defaults to `3001`).

#### Other Routers
under backend/src/api

### Some test tools

#### `backend/src/cliRealTwoPlayer.ts`

This is a **Command-Line Interface (CLI) Test Tool** designed for manual end-to-end testing of the game logic. It allows developers to simulate a full two-player match (P1 vs. P2) without needing a frontend or a network connection.

##### Key Features
* **Multi-Base Support**: Supports both Decimal (`dec`) and Dozenal (`doz`) modes via the `--base` flag.
* **Interactive Gameplay**: Implements a REPL (Read-Eval-Print Loop) using Node.js `readline` for commands like `play`, `draw`, and `pass`.
* **Debug & Cheat Commands**:
    * `hand`: Reveals both players' cards (God mode).
    * `cheat`: Instantly ends the current round with the active player as the winner to test scoring and transitions.
* **Dynamic UI**: Clears the screen and re-renders the board, hand, and playable card hints after every turn.

##### Core Utility Functions

| Function | Description |
| :--- | :--- |
| `normalizeRankInput` | Maps user input (like 'A' or 'B' in dozenal) to internal symbols (↊, ↋). |
| `scoreCardDec` | Calculates the decimal point value of a card, handling face cards vs. numeric ranks. |
| `printDetailedSum` | Prints a step-by-step addition breakdown in the current numeral system—ideal for verifying scoring logic. |
| `renderTurnUI` | Displays the current top card, forced suit, draw count, and the player's current hand. |

##### Command Reference
* **`play <rank><suit> [chosenSuit]`**: Plays a card. Wildcards (10s) can take an optional suit argument.
* **`draw`**: Draws a card (limit of 3 per turn).
* **`pass`**: Ends the turn manually.



##### Usage Example
To start a test session in **Dozenal** mode:
```bash
# Start the CLI
npx ts-node src/cliRealTwoPlayer.ts --base=doz

# Example Gameplay Input
P1> play 7H
P1> play AH S   # Playing a Dozenal 'Ten' (↊) and choosing Spades
P1> draw
```

#### `frontend/src/App.tsx`

This file is a **Single-Page React Test Application** that provides a graphical interface for the game's full stack. It demonstrates how to integrate the REST API for matchmaking and **Socket.io** for real-time gameplay.

##### Key Components & State
* **Authentication State**: Manages JWT tokens and `userId` using `localStorage` to persist sessions across page refreshes.
* **Matchmaking Integration**: Provides UI controls for the entire pre-game flow:
    * Creating a lobby and selecting a numeral system (Dozenal/Decimal).
    * Joining an existing lobby via ID.
    * Starting the match (Host only) and synchronizing the `gameId` to the guest.
* **Real-time Synchronization**: Uses a `sockRef` to maintain a persistent WebSocket connection. It listens for `GAME_STATE` to update the board and `MY_HAND` to update the player's private cards.

##### User Interface Sections

| Section | Functionality |
| :--- | :--- |
| **Auth** | Register, Login, and Local Logout. Displays the current token snippet for debugging. |
| **Lobby** | Creation and joining logic. Displays the active `gameId` once the match begins. |
| **Realtime** | WebSocket connection toggle and the `join_game` command required to enter the room. |
| **Game Board** | Visualizes the `topCard`, `forcedSuit`, current turn status, and cumulative scores in the chosen base. |
| **Controls** | Action buttons for DRAW, PASS, and PLAY (with support for wildcard suit selection). |
| **Log** | A live feed of system messages, WS events, and error reports for real-time troubleshooting. |



##### Logic Highlight: Playable Hints
The app includes a `useMemo` hook that provides a "weak hint" to the player by filtering their hand for cards that match the current top card or forced suit. This demonstrates how the frontend can provide UX assistance using the state provided by the backend.

##### How to Test (One Player Per Browser)
Since the app uses `localStorage` for session management:
1.  **Player 1**: Open in a standard tab. Register/Login $\rightarrow$ Create Lobby.
2.  **Player 2**: Open in an **Incognito** tab. Register/Login $\rightarrow$ Paste Lobby ID $\rightarrow$ Join.
3.  **Start**: Player 1 clicks "Start". Player 2 clicks "Sync GameId".
4.  **Connect**: Both players click "Connect WS" and then "Join Game" to enter the real-time session.

## 🛠 Current Limitations & Roadmap

This project is currently in its MVP (Minimum Viable Product) stage. While the core gameplay loop and multi-base engine are fully functional, several architectural areas are earmarked for future development:

### 1. Data Persistence
* **Current State**: The system currently utilizes `InMemoryRepository` and `InMemoryAuditStore`.
* **Limitation**: All data (player accounts, credentials, and audit logs) is volatile and will be lost upon server restart.
* **Planned Improvement**: 
    * Transition to a persistent database such as **PostgreSQL** or **MongoDB** for user data and match history.
    * Implement **Redis** for managing active `gameSessions` to ensure high-performance state retrieval and scalability.

### 2. Security & Authentication
* **Current State**: Basic JWT-based authentication is implemented for session management.
* **Limitation**: Password policies and encryption flows are minimal. The system has not yet undergone rigorous security hardening or deep-dive research into advanced cryptographic implementations.
* **Planned Improvement**:
    * Enhance password strength validation and hashing protocols.
    * Implement HTTPS for all production traffic.
    * Add rate-limiting and request sanitization to protect against common web vulnerabilities.

### 3. Game Rule Extensions
* **Current State**: Core mechanics (Draw, Play, Skip, Wildcards) and Dozenal/Decimal logic are implemented.
* **Limitation**: Several new rules are currently on the backlog.
* **Planned Improvement**: 
    * Expand the variety of wildcard effects and mechanics if development time permits.

### 4. Logic Robustness & Testing
* **Current State**: Testing has been conducted primarily through the CLI tool and basic web simulator.
* **Limitation**: Edge cases in backend state transitions (e.g., race conditions during simultaneous socket actions or reconnection logic) may still contain undiscovered bugs.
* **Planned Improvement**:
    * Increase test coverage with **Unit Tests** for the `shared` rules engine.
    * Implement **End-to-End (E2E) integration tests** for the WebSocket gateway to ensure 100% reliability in state synchronization.