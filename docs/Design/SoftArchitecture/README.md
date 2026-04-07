# Module Guide (Software Architecture)

This folder contains the **Module Guide (MG)** for *Crazy 1-0's!*.

## Contents

| File | Description |
| :--- | :--- |
| `MG.tex` | LaTeX source for the Module Guide. |
| `MG.pdf` | Compiled PDF — the primary submission artifact. |
| `Makefile` | Builds the PDF from the `.tex` source. |
| `Crazy10s_basic_game_UI.png` | UI screenshot referenced in the document. |

## Document Summary

The Module Guide presents the **high-level architectural decomposition** of *Crazy 1-0's!* The document:

- Defines the system's **module hierarchy** — decomposing the codebase into `shared` (game logic), `backend` (server/API), and `frontend` (React SPA) packages, each further broken down into sub-modules.
- Describes **uses relationships** — which modules depend on which others (e.g., `backend` and `frontend` both consume `shared`; `frontend` communicates with `backend` over REST + WebSocket).
- Justifies the **decomposition decisions** — separation by secrets (each module encapsulates a distinct concern), enabling independent testing of the game engine without a server, and future extensibility for new numeral bases.
- Provides a **traceability matrix** linking each module to the functional and non-functional requirements it implements.
- Includes a **module summary table** with the responsibility of each module stated concisely.
