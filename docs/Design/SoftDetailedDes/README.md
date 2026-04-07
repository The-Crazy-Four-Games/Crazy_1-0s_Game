# Module Interface Specification (Detailed Design)

This folder contains the **Module Interface Specification (MIS)** for *Crazy 1-0's!*.

## Contents

| File | Description |
| :--- | :--- |
| `MIS.tex` | LaTeX source for the Module Interface Specification. |
| `MIS.pdf` | Compiled PDF — the primary submission artifact. |

## Document Summary

The MIS provides **formal interface contracts** for every module identified in the Module Guide. For each module it specifies:

- **Exported types and constants** — e.g., `Card`, `Suit`, `GameState`, `NumeralSystem`, `BaseSpec`, `GameAction`, `MatchResult`.
- **Exported functions / methods** — Full signatures (parameters, return types), preconditions, postconditions, and exceptions.
- **State variables** — Internal state maintained by the module and its invariants (e.g., the `gameSessions` Map in the backend, the `RoundState.deck` ordering invariant).
- **Environment variables** — External dependencies such as `DATABASE_URL`, `JWT_SECRET`, and `USE_INMEMORY`.

### Modules Documented

| Module | Package |
| :--- | :--- |
| Base Conversion (`baseConversion`) | `shared` |
| Numeral Systems (`systems`) | `shared` |
| Game Rules (`rules`) | `shared` |
| Scoring (`scoring`) | `shared` |
| Game Actions protocol (`gameActions`) | `shared` |
| Game Engine (`gameEngine`) | `shared` |
| Auth Service + Routes + Middleware | `backend` |
| Matchmaking Service | `backend` |
| Realtime Gateway (Socket.io) | `backend` |
| REST API Routes (lobby, profile, admin) | `backend` |
| Repository (PostgreSQL + In-Memory) | `backend` |
| React Frontend Hooks (`useGameState`) | `frontend` |
| React Components (screens, UI widgets) | `frontend` |
