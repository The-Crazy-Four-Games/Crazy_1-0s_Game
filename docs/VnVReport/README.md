# Verification and Validation Report (Test Report)

This folder contains the **V&V Report** for *Crazy 1-0's!*, documenting the outcomes of all testing and validation activities.

## Contents

| File | Description |
| :--- | :--- |
| `VnVReport.tex` | LaTeX source for the V&V Report document. |
| `VnVReport.pdf` | Compiled PDF — the primary submission artifact. |
| `Makefile` | Builds the PDF from the `.tex` source. |

## Document Summary

The V&V Report presents the **results** of executing the tests defined in the V&V Plan. It covers:

- **Unit test results** — Pass/fail outcomes for all Vitest test suites in the `shared` package, covering base conversion, game rules, scoring, and end-to-end round simulations.
- **Functional requirement coverage** — A traceability table mapping each tested requirement (from the SRS) to the test case(s) that verify it, and their outcomes.
- **Non-functional requirement evaluation** — Measurements and observations for performance, usability, and correctness requirements.
- **Usability testing findings** — Summary of feedback gathered from real users, including identified pain points and UI improvements made in response.
- **Known deviations** — Requirements that were not fully verified (e.g., end-to-end WebSocket integration tests remain manual), with justification.
- **Reflection on the testing process** — What worked, what was harder than expected, and improvements for future test coverage.
