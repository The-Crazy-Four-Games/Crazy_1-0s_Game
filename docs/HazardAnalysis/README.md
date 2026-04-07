# Hazard Analysis

This folder contains the **Hazard Analysis** document for *Crazy 1-0's!*.

## Contents

| File | Description |
| :--- | :--- |
| `HazardAnalysis.tex` | LaTeX source for the Hazard Analysis document. |
| `HazardAnalysis.pdf` | Compiled PDF — the primary submission artifact. |
| `Makefile` | Builds the PDF from the `.tex` source. |

## Document Summary

The Hazard Analysis identifies potential risks to the system and the mitigations put in place. It covers:

- **System boundary** — The scope of analysis includes the web application (frontend SPA, backend REST/WebSocket server, PostgreSQL database) and user devices (browsers). Excluded: infrastructure outside the application layer (e.g., AWS EC2 host, network routing).
- **Failure modes and effects** — Analysis of what can go wrong in each subsystem:
  - *Real-time communication*: WebSocket disconnection mid-game causing desync or data loss.
  - *Authentication*: JWT compromise or session hijacking exposing player accounts.
  - *Database*: Loss of match history or player credentials due to unexpected shutdowns.
  - *Game logic*: Incorrect base-conversion or scoring producing invalid game states.
  - *Concurrency*: Race conditions in simultaneous player actions corrupting round state.
- **Recommended mitigations** — Measures adopted in the implementation, such as server-side game state as the single source of truth, JWT expiry + session_iat invalidation, persistent PostgreSQL storage, and deterministic action application.
- **Safety and security requirements** — Non-functional requirements derived from this analysis (e.g., input validation, HTTPS in production, graceful disconnection handling).
