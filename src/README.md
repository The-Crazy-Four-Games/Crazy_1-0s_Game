# Project Name Source Code

The folders and files for this project are as follows:
This Proof of Concept (POC) demonstrates all core game logic, including:
* **Real-time, two-player matches** (via Socket.IO)
* **Custom Game Rules**:
    * **52-Card Deck**: Standard 4 suits x 13 ranks (A-K).
    * **"Sum-to-10"**: Players can match cards if their ranks sum to 10.
    * **Wildcard**: The `'10'` rank is the Wildcard and allows the player to set the next suit.
* **Multi-Round Scoring System**: Players compete across multiple rounds until one player reaches 100 points.
* **Command-Line (CLI) Demo**: The entire demo runs in the terminal, no web frontend is required.

---

## 🛠️ Tech Stack

* **Node.js**: Runtime environment
* **Socket.IO**: For real-time WebSocket communication between server and clients
* **`socket.io-client`**: Used by `client.js` to simulate a game client
* **`uuid`**: For generating unique `roomId`s

---

## ⚙️ Installation

1.  Clone or download this repository.
2.  Open a terminal in the project's root directory.
3.  Run `npm install` to install all necessary dependencies:

    ```bash
    npm install
    ```
    *(This will install `socket.io`, `socket.io-client`, and `uuid`)*

---

## 🚀 How to Run the Demo

**This is the most important part!** This demo **must** be run using **three (3)** separate terminal windows (1 for the server, 2 for the players).

### Terminal 1: Start the Server

This is your game "host".

1.  Open a terminal in the project folder.
2.  Run `node server.js`.

    ```bash
    node server.js
    ```
3.  You should see: `Server is running on port 3001...`
4.  **Leave this terminal running!** It will show server logs, such as players connecting and disconnecting.

### Terminal 2: Player 1 (Create Game)

This is the first player.

1.  **Open a NEW terminal window.**
2.  In the **same** project folder, run `node client.js`.

    ```bash
    node client.js
    ```
3.  You will be prompted: `Enter 'create' to start a new game, or 'join [roomId]' to join >`
4.  Type `create` and press Enter.
5.  You will see a message like: `[Client] Game Created! Room ID: e14de0`
6.  **Take note of this `e14de0` (your ID will be different). Player 2 needs it.**

### Terminal 3: Player 2 (Join Game)

This is the second player.

1.  **Open a THIRD new terminal window.**
2.  In the **same** project folder, run `node client.js`.

    ```bash
    node client.js
    ```
3.  You will see the same prompt: `Enter 'create' ...`
4.  Type `join [roomId]`, replacing `[roomId]` with the ID you got from **Terminal 2**.

    ```
    join e14de0
    ```
5.  Press Enter.

### 🎮 Play the Game!

The moment Player 2 joins, the server's `GameRoom` will automatically start the game.

* Both **Terminal 2** and **Terminal 3** will refresh to show the scoreboard, the top card, and their respective hands.
* Player 1 (the host) will have the first turn.
* In the terminal whose turn it is (`>>> It's YOUR turn! <<<`), type your command.

#### In-Game Commands

* **`play [cardId]`**: Play a card from your hand.
    * *Example:* `play AH` (Plays the Ace of Hearts)
    * *Example:* `play 10H` (Plays the '10' of Hearts / Wildcard)
* **`draw`**: Draw one card from the deck. Your turn will **continue**, and you can choose to `play` or `draw` again.
* **`win`**: (Debug Command) Instantly win the current round. Used for quickly testing the scoring and multi-round logic.

#### Game Flow

* The game automatically keeps score and resets the board after each round.
* When a player's total score reaches or exceeds 100 points, the entire match ends.
* At this point, both terminals will ask if you want to play again `(Type 'yes' or 'y' to restart)`, which starts a completely new match.

---

## 📁 Project Structure

* `server.js`: **Server Entrypoint**. Starts Socket.IO and listens for new connections. Routes connections to the `GameManager`.
* `client.js`: **Command-Line Client**. Simulates a player, sends `socket.emit` events, and listens for `socket.on` events.
* `server-logic/GameManager.js`: **Lobby/Registry**. Manages all active `GameRoom` instances. Responsible for `createGame` and `joinGame`.
* `game-logic/GameRoom.js`: **Core Game Engine**. Manages the state, hands, turns, and scoring for a single two-player match.
* `game-logic/rules.js`: **Rulebook**. Contains `isValidPlay` (the core matching logic) and `hasPlayableCard`.
* `game-logic/Deck.js`: **Card Toolkit**. Defines the `Card` and `Deck` classes. Responsible for creating and shuffling the 52-card deck.
...
