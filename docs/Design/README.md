# Design Documentation

This folder contains the **Software Design** documents for *Crazy 1-0's!*, organized into two levels of detail.

## Sub-folders

| Folder | Document | Description |
| :--- | :--- | :--- |
| [`SoftArchitecture/`](./SoftArchitecture/README.md) | Module Guide (MG) | High-level decomposition of the system into modules and their relationships. |
| [`SoftDetailedDes/`](./SoftDetailedDes/README.md) | Module Interface Specification (MIS) | Detailed interface contracts for each module (types, functions, state, exceptions). |

## Document Summaries

### Module Guide (`SoftArchitecture/MG.pdf`)

The Module Guide presents the **architectural decomposition** of the system:

- Division into three packages: `shared` (game logic library), `backend` (Express + Socket.io server), and `frontend` (React SPA).
- Module hierarchy: how higher-level modules depend on lower-level ones.
- Justification for the decomposition — separation of concerns, testability of the `shared` engine in isolation, and clear ownership boundaries.
- A traceability matrix linking modules to the functional requirements in the SRS.

### Module Interface Specification (`SoftDetailedDes/MIS.pdf`)

The MIS provides **formal interface descriptions** for each module:

- Type definitions (e.g., `Card`, `GameState`, `NumeralSystem`, `RoundState`).
- Function signatures, preconditions, postconditions, and exceptions.
- State variables and their invariants (e.g., game session Map, lobby lifecycle).
- Covers modules across `shared` (base conversion, rules, scoring, game engine), `backend` (auth, matchmaking, realtime gateway, REST API), and `frontend` (hooks, component props).
