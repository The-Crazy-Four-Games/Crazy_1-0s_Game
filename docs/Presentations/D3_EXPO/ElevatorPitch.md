# Elevator Pitch — Crazy 1-0's! (EXPO)

**Target length:** ~75 seconds  
**Audience:** General public, judges, professors  
**Tone:** Enthusiastic, clear, a little playful

---

## Script

**Hook (0–10s)**
> "Quick question — what does '10 plus 2' equal?"
> *(pause for answer)*
> "In decimal, sure, it's 12. But if you're counting in base 8? Ten plus 2 is… also '10' — just a completely different ten."

**Problem (10–25s)**
> "Most of us were never really taught to *think* in other number bases — we just memorize conversion formulas and forget them. Existing tools are passive: videos, textbooks, flashcards. None of them make you actually *use* the skill under pressure."

**Solution (25–50s)**
> "So we built **Crazy 1-0's** — a real-time multiplayer card game that teaches you to count and do arithmetic in Dozenal — that's Base-12 — and other numeral systems, just by playing.
>
> It's based on Crazy Eights. You match cards by suit, or by making them sum to '10' *in the base you're playing in*. When you play a face card, both players race to answer a math question — addition, subtraction, multiplication — displayed entirely in that base. First correct answer gets bonus points.
>
> The whole game runs in your browser. No install, no setup. You create a room, send a link, and play."

**Technical highlight (50–65s)**
> "Under the hood, we built a shared TypeScript game engine that's completely decoupled from the front and back end — so the same rules power both the React UI and the Express server. Real-time sync runs over Socket.io, and everything's containerized with Docker."

**Close (65–75s)**
> "We're live right now at **thecrazy10.click** — if you've got 60 seconds, scan the QR code and try a round. I promise by the time you're done, you'll have a better intuition for Base-12 than most people ever get."

---

## Key Numbers to Remember

| Fact | Value |
| :--- | :--- |
| Numeral bases supported | 3 (Decimal, Dozenal, Octal 🧪) |
| Game mode | Real-time 1v1 multiplayer |
| Stack | React · Express · Socket.io · PostgreSQL · Docker |
| Live URL | thecrazy10.click |

---

## Audience Q&A Prep

**"Why Dozenal specifically?"**
> Base-12 is actually more mathematically elegant than Base-10 — 12 is divisible by 1, 2, 3, 4, 6, and 12, while 10 is only divisible by 1, 2, 5, and 10. There's a whole community of mathematicians who advocate for it. We thought it was the perfect teaching tool.

**"How does the game actually teach you anything?"**
> You can't win without doing the arithmetic in your head — there's no decimal translation shown. The game forces you to internalize the base to play fast. Repetition through play is exactly how you build fluency.

**"Is it hard to learn?"**
> Nope — there's an in-game hint panel with addition and multiplication tables in whatever base you're playing. New players can reference it any time.

**"What was the hardest part to build?"**
> Keeping the game state consistent between two browsers in real time, especially around edge cases like simultaneous disconnects and arithmetic challenge tie-breakers.
