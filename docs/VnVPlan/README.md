# Verification and Validation Plan

This folder contains the **Verification and Validation (V&V) Plan** for *Crazy 1-0's!*.

## Contents

| File | Description |
| :--- | :--- |
| `VnVPlan.tex` | LaTeX source for the V&V Plan document. |
| `VnVPlan.pdf` | Compiled PDF — the primary submission artifact. |
| `Makefile` | Builds the PDF from the `.tex` source. |

## Document Summary

The V&V Plan describes how the team verified that the system was built correctly and validated that it meets its requirements. It covers:

- **Verification approach** — Unit testing the `shared` game engine (Vitest), with plans for integration testing of REST endpoints and WebSocket events.
- **Test cases for the `shared` library** — Covering base conversion (`baseConversion.ts`), play legality (`isPlayable`, `applyPlay`), hand scoring (`scoring.ts`), and full round simulation (`gameEngine.ts`).
- **Non-functional requirement validation** — Performance (round-trip latency for game actions), usability (user testing sessions), and correctness (mathematical verification of Dozenal and Octal arithmetic).
- **Traceability** — Each test case is linked back to a specific functional or non-functional requirement from the SRS.
- **Testing tools** — Vitest for unit tests, manual browser testing for WebSocket flows, and usability testing with real participants.
- **Test data** — Example hands, deck seeds, and edge cases (e.g., empty deck reshuffle, arithmetic challenge tie, game-ending challenge answer).
