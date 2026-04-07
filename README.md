# Crazy 1-0's! — Capstone Project

**Developers:** Ruida Chen, Ammar Sharbat, Alvin Qian, Jiaming Li

**Project Start:** September 16, 2025

🎮 **Play the game live:** [thecrazy10.click](http://thecrazy10.click/)

---

## About the Game

**Crazy 1-0's!** is a variant of the classic card game *Crazy Eights* that teaches players to count, add, subtract, multiply, and divide in alternative numeral systems — starting with **Dozenal (Base-12)** and expanding to **Decimal (Base-10)** and **Octal (Base-8, experimental)**.

The name "1-0's" comes from the fact that `10` in any base represents that base's *target sum* — the core mechanic of the game.

---

## How to Play

- Players take turns discarding cards from their hand onto a shared pile.
- A card is legal to play if its rank **matches the suit** of the top card, or if the two ranks **sum to the base target** (e.g., `10` in Dozenal = 12 in decimal).
- **Wildcard `"10"` cards** can be played on anything; the player then picks the next forced suit.
- **Skip cards** (`[10/2]` — value `5` in decimal, `6` in dozenal, `4` in octal) grant an extra free-play turn.
- **Face cards** (J, Q, K, and C in Dozenal) trigger **Arithmetic Challenge** mini-games — both players race to answer a math question in the current numeral base.
- A **round** ends when one player empties their hand; that player earns points equal to the sum of cards left in the opponent's hand.
- A **match** is won by the first player to reach the base's target score (`100` in the current base, e.g. 144 decimal in dozenal).

Current version supports **1v1 play** only.

---

## Game Modes

| Mode | Base | Target Sum | Win Score |
| :--- | :--- | :--- | :--- |
| Decimal | 10 | 10 | 100 |
| Dozenal | 12 | `10` (= 12) | `100` (= 144) |
| Octal 🧪 | 8 | `10` (= 8) | `100` (= 64) |

---

## Repository Structure

```
Crazy-Tens-Game/
├── src/          ── Full-stack source code (React frontend, Express backend, shared game library)
├── docs/         ── Project documentation (design, planning, analysis, testing, presentations)
├── refs/         ── Reference materials and academic papers
├── test/         ── Additional test artifacts
├── INSTALL.md    ── Installation instructions
├── CONTRIBUTING.md
└── LICENSE
```

> 📂 **For source code details** — architecture, setup instructions, API reference, and component documentation — see [`src/README.md`](./src/README.md).

> 📚 **For project documentation** — development plan, SRS, design docs, V&V plan, and more — see [`docs/README.md`](./docs/README.md).

---

## Reference Materials

**Dozenal System:**

- [Brief Introduction to the Dozenal Counting System](https://dozenal.org/drupal/content/brief-introduction-dozenal-counting.html) — Presents a case for why Dozenal is a better counting system than Decimal.
- [Fundamental Operations In The Duodecimal System – Jay Schiffman](https://dozenal.org/drupal/sites_bck/default/files/db31315_0.pdf) — Covers Addition, Subtraction, Multiplication, and Division in Dozenal.

**Source Code History:**

- POC Demo: [pocdemo branch](https://github.com/The-Crazy-Four-Games/Crazy_1-0s_Game/commits/pocdemo/src)
- Rev0 Source: [main/src/rev0](https://github.com/The-Crazy-Four-Games/Crazy_1-0s_Game/tree/main/src/rev0)
