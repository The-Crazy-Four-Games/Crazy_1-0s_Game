// backend/src/cliRealTwoPlayer.ts
import readline from "node:readline";
import {
  createGame,
  applyAction,
  getPlayableCards,
  type GameState,
  type Card,
  type Suit,
  formatInSystem,
  parseInSystem,
  // fromBaseToNumber / toBaseFromNumber are already used inside shared rules,
  // here we only need parse/format helpers from shared.
} from "@rev0/shared";

type BaseId = "doz" | "dec";
type Player = "P1" | "P2";

function question(rl: readline.Interface, q: string): Promise<string> {
  return new Promise(resolve => rl.question(q, resolve));
}
function clearScreen() {
  process.stdout.write("\x1Bc");
}
function isSuit(x: string): x is Suit {
  return x === "S" || x === "H" || x === "D" || x === "C";
}
async function askSuit(rl: readline.Interface): Promise<Suit> {
  while (true) {
    const ans = (await question(rl, "Choose suit (S/H/D/C): ")).trim().toUpperCase();
    if (isSuit(ans)) return ans;
    console.log("Invalid suit. Use S/H/D/C.");
  }
}
function shortCard(c: Card): string {
  return `${c.rank}${c.suit}`;
}
function normalizeRankInput(rankRaw: string, baseId: BaseId): string {
  const r = rankRaw.trim();
  if (baseId === "doz") {
    const up = r.toUpperCase();
    if (up === "A") return "↊";
    if (up === "B") return "↋";
    return up; // digits, J/Q/K/C, "10"
  }
  return r.toUpperCase();
}
function parsePlayToken(tokenRaw: string, baseId: BaseId): { rank: string; suit: Suit } | null {
  const t = tokenRaw.trim();
  if (t.length < 2) return null;
  const suitChar = t.slice(-1).toUpperCase();
  if (!isSuit(suitChar)) return null;
  const rankPart = t.slice(0, -1);
  if (!rankPart) return null;
  return { rank: normalizeRankInput(rankPart, baseId), suit: suitChar };
}
function findCardInHand(hand: Card[], want: { rank: string; suit: Suit }): Card | null {
  return hand.find(c => c.rank === want.rank && c.suit === want.suit) ?? null;
}

function getTargetDec(g: GameState): number {
  return parseInSystem(g.sys.targetScoreText, g.sys);
}

function computeRoundGain(prev: GameState, next: GameState): { winner: Player; gainDec: number } | null {
  const p1Delta = next.scoresDec.P1 - prev.scoresDec.P1;
  const p2Delta = next.scoresDec.P2 - prev.scoresDec.P2;
  if (p1Delta === 0 && p2Delta === 0) return null;
  if (p1Delta > 0) return { winner: "P1", gainDec: p1Delta };
  if (p2Delta > 0) return { winner: "P2", gainDec: p2Delta };
  return null;
}

function printHelp(sys: GameState["sys"], baseId: BaseId) {
  console.log(`
Commands:
  play <RS> [S|H|D|C]   play a card by rank+suit. Examples: play 2H, play 10D, play JS
                        (doz typing) A=↊, B=↋, so play AH / play BD
                        If you play wildcardTen (${sys.wildcardTenSymbol}), you may append chosen suit:
                        play 10H D
  draw                  draw a card (max 3 per turn)
  pass                  pass turn
  hand                  show BOTH players' hands (debug/cheat)
  cheat                 current player instantly wins THIS ROUND (score is settled), then next round starts
  help                  show this help
  quit                  exit
`);
}

function renderTurnUI(g: GameState) {
  const turn = g.round.turn as Player;
  const top = g.round.topCard;
  const forced = g.round.forcedSuit;

  console.log(`Base: ${g.sys.id} | Turn: ${turn}`);
  console.log(`TopCard: ${shortCard(top)}${forced ? ` | forcedSuit: ${forced}` : ""}`);

  // avoid old d.ts mismatch
  const freePlayFor = (g.round as unknown as { freePlayFor?: string }).freePlayFor;
  if (freePlayFor === turn) {
    console.log("FREE PLAY: ignore top card / forced suit. You may play ANY card.");
  }

  console.log(`Wildcards: ten="${g.sys.wildcardTenSymbol}" | skip="${g.sys.wildcardSkipSymbol}"`);
  console.log(`Draw used this turn: ${g.round.drawCountThisTurn}/3`);
  console.log("");

  const hand = g.round.hands[turn];
  console.log(`${turn} Hand (${hand.length}):`);
  hand.forEach(c => console.log(`  ${shortCard(c)}`));
  console.log("");

  // hint back
  const playableCount = getPlayableCards(g.sys, g.round as any, turn).length;
  if (playableCount === 0) console.log("Hint: No playable cards. Try 'draw' (up to 3) or 'pass'.");
  else console.log("Hint: You have playable card(s). Try 'play <rank><suit>' (e.g., play 2H / play 10D).");
  console.log("");
}

/**
 * Detailed score breakdown for opponent hand:
 * - numeric: value is parsed in the current system (supports ↊↋ and "10")
 * - face: fixed 10 points (DEC 10), and shown in base as formatInSystem(10)
 */
function scoreCardDec(card: Card, sys: GameState["sys"]): { dec: number; label: string } {
  const isFace = sys.faceRanks.includes(card.rank);
  if (isFace) {
    const faceDec = 10;
    const faceText = formatInSystem(faceDec, sys);
    return { dec: faceDec, label: `${card.rank}${card.suit}=face(${faceText})` };
  }
  // numeric rank text is in-system, parse to decimal
  const vDec = parseInSystem(card.rank, sys);
  const vText = formatInSystem(vDec, sys);
  return { dec: vDec, label: `${card.rank}${card.suit}=${vText}` };
}

function printDetailedSum(items: { dec: number; label: string }[], sys: GameState["sys"]) {
  if (items.length === 0) {
    console.log("Opponent hand is empty. Gain = 0.");
    return;
  }

  console.log("Score breakdown (opponent remaining hand):");
  for (const it of items) console.log(`  - ${it.label}  (dec ${it.dec})`);

  console.log("\nAddition steps:");
  let accDec = 0;
  let accText = formatInSystem(accDec, sys);

  for (const it of items) {
    const nextDec = accDec + it.dec;
    const nextText = formatInSystem(nextDec, sys);
    const addText = formatInSystem(it.dec, sys);

    console.log(`  ${accText} + ${addText} = ${nextText}   (dec ${accDec} + ${it.dec} = ${nextDec})`);

    accDec = nextDec;
    accText = nextText;
  }

  console.log(`\nTotal gain: ${formatInSystem(accDec, sys)} (dec ${accDec})`);
}

function startNextRoundLikeEngine(g: GameState): GameState {
  // Minimal “start next round” for CLI cheat:
  // We re-create a fresh game but keep scores and baseId, then continue.
  // NOTE: This is only for cheat/debug; your real engine should provide an API.
  const baseId = g.sys.id as BaseId;
  const fresh = createGame({ players: ["P1", "P2"], baseId });

  const gg: any = fresh;
  gg.scoresDec = { ...g.scoresDec };
  gg.status = "ONGOING";
  return gg as GameState;
}

function settleRoundCheat(g: GameState, winner: Player): { nextGame: GameState; gainDec: number } {
  const loser: Player = winner === "P1" ? "P2" : "P1";
  const loserHand = g.round.hands[loser] ?? [];

  const items = loserHand.map(c => scoreCardDec(c, g.sys));
  const gainDec = items.reduce((a, b) => a + b.dec, 0);

  // Apply score gain to winner
  const gg: any = g;
  gg.scoresDec = { ...g.scoresDec, [winner]: g.scoresDec[winner] + gainDec };

  // Check overall victory
  const targetDec = getTargetDec(g);
  if (gg.scoresDec[winner] >= targetDec) {
    gg.status = "GAME_OVER";
    return { nextGame: gg as GameState, gainDec };
  }

  // Otherwise, next round (fresh round state, same scores)
  const next = startNextRoundLikeEngine(gg as GameState);
  return { nextGame: next, gainDec };
}

async function main() {
  const baseArg = process.argv.find(a => a.startsWith("--base="));
  const baseId: BaseId = (baseArg?.split("=")[1] as BaseId) ?? "doz";

  let g = createGame({ players: ["P1", "P2"], baseId });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    clearScreen();

    if (g.status === "GAME_OVER") {
      const targetDec = getTargetDec(g);
      const winner: Player = g.scoresDec.P1 >= targetDec ? "P1" : "P2";
      console.log("=== GAME OVER ===");
      console.log(`Winner: ${winner}`);
      console.log(
        `Final scores: P1=${formatInSystem(g.scoresDec.P1, g.sys)} (dec ${g.scoresDec.P1}) | ` +
          `P2=${formatInSystem(g.scoresDec.P2, g.sys)} (dec ${g.scoresDec.P2})`
      );
      console.log(`Target: ${g.sys.targetScoreText} (dec ${targetDec})`);
      console.log("");
      break;
    }

    renderTurnUI(g);

    const turn = g.round.turn as Player;
    const line = (await question(rl, `${turn}> `)).trim();
    if (!line) continue;

    const [cmdRaw, ...rest] = line.split(/\s+/);
    const cmd = cmdRaw.toLowerCase();

    try {
      if (cmd === "quit" || cmd === "exit") break;

      if (cmd === "help" || cmd === "h" || cmd === "?") {
        clearScreen();
        printHelp(g.sys, baseId);
        await question(rl, "\nPress Enter to continue...");
        continue;
      }

      if (cmd === "hand") {
        clearScreen();
        console.log("=== HANDS (debug/cheat) ===");
        (["P1", "P2"] as Player[]).forEach(pid => {
          const h = g.round.hands[pid];
          console.log(`${pid} (${h.length}): ${h.map(shortCard).join(" ")}`);
        });
        console.log("");
        await question(rl, "Press Enter to continue...");
        continue;
      }

      if (cmd === "cheat") {
        clearScreen();
        console.log(`=== CHEAT: ${turn} wins THIS ROUND ===`);
        const loser: Player = turn === "P1" ? "P2" : "P1";
        const loserHand = g.round.hands[loser] ?? [];

        const items = loserHand.map(c => scoreCardDec(c, g.sys));
        printDetailedSum(items, g.sys);

        const beforeScoreDec = g.scoresDec[turn];
        const { nextGame, gainDec } = settleRoundCheat(g, turn);

        console.log("\nRound result:");
        console.log(`Winner: ${turn}`);
        console.log(`Gained: ${formatInSystem(gainDec, g.sys)} (dec ${gainDec})`);

        const afterScoreDec = (nextGame as any).scoresDec[turn] as number;
        const targetDec = getTargetDec(g);
        const remainDec = Math.max(0, targetDec - afterScoreDec);

        console.log(`Total score: ${formatInSystem(afterScoreDec, g.sys)} (dec ${afterScoreDec})`);
        console.log(`To overall victory: ${formatInSystem(remainDec, g.sys)} more (dec ${remainDec})`);

        if (nextGame.status !== "GAME_OVER") {
          console.log("\nStarting next round...");
        }

        g = nextGame;
        await question(rl, "\nPress Enter to continue...");
        continue;
      }

      if (cmd === "draw") {
        const prevTurn = g.round.turn;
        const prev = g;

        g = applyAction(g, { type: "DRAW", playerId: turn });

        if (g.round.turn !== prevTurn) {
          console.log(`Auto-pass -> Turn changed to ${g.round.turn}. FREE PLAY granted.`);
          await question(rl, "Press Enter...");
        }

        const gain = computeRoundGain(prev, g);
        if (gain) {
          // If your engine already settles rounds, show summary (not detailed steps here)
          const targetDec = getTargetDec(g);
          const newScoreDec = g.scoresDec[gain.winner];
          const remainDec = Math.max(0, targetDec - newScoreDec);

          console.log("=== ROUND WIN ===");
          console.log(`Winner: ${gain.winner}`);
          console.log(`Gained this round: ${formatInSystem(gain.gainDec, g.sys)} (dec ${gain.gainDec})`);
          console.log(`Total score: ${formatInSystem(newScoreDec, g.sys)} (dec ${newScoreDec})`);
          console.log(`To overall victory: ${formatInSystem(remainDec, g.sys)} more (dec ${remainDec})`);
          await question(rl, "Press Enter to continue...");
        }
        continue;
      }

      if (cmd === "pass") {
        g = applyAction(g, { type: "PASS", playerId: turn });
        continue;
      }

      if (cmd === "play") {
        if (rest.length < 1) {
          console.log("Usage: play 2H | play 10D | play JS | (doz) play AH");
          await question(rl, "Press Enter...");
          continue;
        }

        const parsed = parsePlayToken(rest[0], baseId);
        if (!parsed) {
          console.log("Invalid card format. Use rank+suit like 2H, 10D, JS. (doz) A=↊, B=↋.");
          await question(rl, "Press Enter...");
          continue;
        }

        const hand = g.round.hands[turn];
        const card = findCardInHand(hand, parsed);
        if (!card) {
          console.log(`You don't have ${parsed.rank}${parsed.suit} in your hand.`);
          await question(rl, "Press Enter...");
          continue;
        }

        let chosenSuit: Suit | undefined;
        if (card.rank === g.sys.wildcardTenSymbol) {
          const sArg = rest[1]?.toUpperCase();
          if (sArg && isSuit(sArg)) chosenSuit = sArg;
          else chosenSuit = await askSuit(rl);
        }

        const prev = g;
        const prevTurn = g.round.turn;

        g = applyAction(g, { type: "PLAY", playerId: turn, card, chosenSuit });

        if (card.rank === g.sys.wildcardTenSymbol) {
          console.log(`WildcardTen activated: forcedSuit = ${g.round.forcedSuit ?? "(missing?)"}`);
          await question(rl, "Press Enter...");
        }

        if (card.rank === g.sys.wildcardSkipSymbol && g.round.turn === prevTurn) {
          console.log("Skip activated: you play again!");
          await question(rl, "Press Enter...");
        }

        const gain = computeRoundGain(prev, g);
        if (gain) {
          const targetDec = getTargetDec(g);
          const newScoreDec = g.scoresDec[gain.winner];
          const remainDec = Math.max(0, targetDec - newScoreDec);

          console.log("=== ROUND WIN ===");
          console.log(`Winner: ${gain.winner}`);
          console.log(`Gained this round: ${formatInSystem(gain.gainDec, g.sys)} (dec ${gain.gainDec})`);
          console.log(`Total score: ${formatInSystem(newScoreDec, g.sys)} (dec ${newScoreDec})`);
          console.log(`To overall victory: ${formatInSystem(remainDec, g.sys)} more (dec ${remainDec})`);
          await question(rl, "Press Enter to continue...");
        }

        continue;
      }

      console.log("Unknown command. Type 'help' for commands.");
      await question(rl, "Press Enter...");
    } catch (e: any) {
      console.log(`Error: ${e?.message ?? e}`);
      await question(rl, "Press Enter...");
    }
  }

  rl.close();
  console.log("Bye.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
