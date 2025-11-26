// game-logic/GameRoom.js
const { Deck } = require("./Deck");
const { isValidPlay, hasPlayableCard } = require("./GameRules");

class GameRoom {
    constructor(roomId, io) {
        this.roomId = roomId;
        this.io = io; // For broadcasting to the room
        this.players = []; // Stores { id: socket.id, socket: socket, hand: [] }
        this.deck = new Deck();
        this.discardPile = [];
        this.scores = [0, 0]

        this.state = {
            turn: null, // player index
            activeWildChoice: null, // eg { type: 'suit', value: 'H' }
            status: "waiting" // waiting -> playing -> finished
        };
        this.restartVotes = new Set();
    }
    _getScoringValue(rank) {
        if (['J', 'Q', 'K', 'C', 'X'].includes(rank)) return 10;
        if (rank === 'A') return 1;
        if (rank === 'Y') return 11;
        if (rank === '10') return 12;

        const val = parseInt(rank, 10);
        if (val >= 2 && val <= 9) return val;
        return 0;
    }
    _calculateHandScore(hand) {
        let totalScore = 0;
        for (const card of hand) {
            totalScore += this._getScoringValue(card.rank);
        }
        return totalScore;
    }

    // --- Player Management ---
    addPlayer(socket) {
        const player = { id: socket.id, socket: socket, hand: [] };
        this.players.push(player);
        socket.join(this.roomId);

        socket.emit("joinedRoom", {
            roomId: this.roomId,
            playerCount: this.players.length
        });
        this.io.to(this.roomId).emit("playerUpdate", this.players.map(p => p.id));

        if (this.players.length === 2) {
            this.startGame();
        }
    }

    removePlayer(socketId) {
        this.state.status = "finished";
        this.io.to(this.roomId).emit("gameOver", "opponent disconnected.");
    }

    isFull() { return this.players.length >= 2; }
    isEmpty() { return this.players.length === 0; }

    // --- game lifecycle ---
    startGame() {
        this.state.status = "playing";
        this.deck.shuffle();

        // starting hands with 5 cards each
        for (let i = 0; i < 5; i++) {
            this.players[0].hand.push(this.deck.draw());
            this.players[1].hand.push(this.deck.draw());
        }

        // flip the first card to start the discard pile
        this.discardPile.push(this.deck.draw());
        this.state.turn = 0; // room host starts first

        this.broadcastGameState();
        console.log(`[Game ${this.roomId}] started`);
    }

    // --- Core Action Handling ---
    handleAction(socketId, actionType, data) {
        const playerIndex = this.players.findIndex(p => p.id === socketId);
        if (playerIndex !== this.state.turn) {
            return this.players[playerIndex].socket.emit("error", "not your turn");
        }

        switch (actionType) {
            case "playCard":
                this.handlePlayCard(playerIndex, data.cardId);
                break;
            case "drawCard":
                this.handleDrawCard(playerIndex);
                break;
            case "setWildChoice":
                this.handleSetWildChoice(playerIndex, data.choice);
        }
    }

    handlePlayCard(playerIndex, cardId) {
        const player = this.players[playerIndex];
        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) { return player.socket.emit("error", "You don't have that card"); }

        const playedCard = player.hand[cardIndex];
        const topCard = this.discardPile[this.discardPile.length - 1];

        if (!isValidPlay(playedCard, topCard, this.state.activeWildChoice)) {
            return player.socket.emit("error", "inValid card play");
        }

        // --- valid action ---
        this.state.activeWildChoice = null;
        player.hand.splice(cardIndex, 1);
        this.discardPile.push(playedCard);

        // 5. each round win check
        if (player.hand.length === 0) {
            // player has emptied their hand and wins the round
            const winner = player;
            const winnerIndex = playerIndex;

            // find opponent
            const opponentIndex = (playerIndex + 1) % 2;
            const opponent = this.players[opponentIndex];

            // calculate round score
            const roundScore = this._calculateHandScore(opponent.hand);

            // add to total scores
            this.scores[winnerIndex] += roundScore;

            console.log(`[Game ${this.roomId}] Player ${winner.id} won this round, got ${roundScore} scores. Total: ${this.scores}`);

            // check for entire game win
            if (this.scores[winnerIndex] >= 50) {
                // --- if score > 50 ---
                this.state.status = "finished";
                this.io.to(this.roomId).emit("gameOver",
                    `Player ${winner.id} reached 50 first! Final Scores: ${this.scores[0]} - ${this.scores[1]}`
                );
                // (game ended, waiting for player votes "requestRestart")

            } else {
                // --- round end n<50 ---
                this.io.to(this.roomId).emit("roundOver", {
                    winnerId: winner.id,
                    roundScore: roundScore,
                    scores: this.scores
                });

                // reset for next round
                this.resetGame();
            }

            return;
        }

        // check for Wildcard play
        if (playedCard.rank === "10") {
            player.socket.emit("requestWildChoice");
        } else {
            this.nextTurn();
        }

        this.broadcastGameState();
    }

    handleDrawCard(playerIndex) {
        const player = this.players[playerIndex];

        // check if deck is empty
        if (this.deck.isEmpty()) {
            const topCard = this.discardPile[this.discardPile.length - 1];

            // check if a player is stuck (no playable cards, deck empty)
            if (!hasPlayableCard(player.hand, topCard, this.state.activeWildChoice)) {


                // if stuck, declare draw
                console.log(`[Game ${this.roomId}] deck is empty, player ${player.id} doesn't have playable card.Game is a draw.`);

                // broadcast game over
                this.io.to(this.roomId).emit("roundOver", {
                    winnerId: null, // draw
                    roundScore: 0,
                    scores: this.scores
                });

                // reset game
                this.resetGame();

            } else {
                // unstuck player must play from hand
                player.socket.emit("error", "deck is empty, you must play from your hand");
            }
            return;
        }

        // draw 1 card each time
        const newCard = this.deck.draw();
        player.hand.push(newCard);

        // not skipping turn after drawing
        this.broadcastGameState();
        player.socket.emit("drewCards", `you drew ${newCard.id}。`);
    }

    handleSetWildChoice(playerIndex, choice) {
        const player = this.players[playerIndex];

        // validate if it's the right time to set wild choice
        const topCard = this.discardPile[this.discardPile.length - 1];
        if (topCard.rank !== "10") {
            return player.socket.emit("error", "not a time to set wild choice");
        }

        // validate the choice content
        if (!choice ||
            choice.type !== 'suit' ||
            !['H', 'D', 'C', 'S'].includes(choice.value)) {
            return player.socket.emit("error", "Invalid Wildcard choice。Must specify a suit (H, D, C, S)。");
        }

        // set state
        this.state.activeWildChoice = choice;

        // print log
        console.log(`[Game ${this.roomId}] Player ${player.id} set Wild: ${choice.type} = ${choice.value}`);

        // change turn
        this.nextTurn();

        // broadcast updated state
        this.broadcastGameState();
    }
    nextTurn() {
        this.state.turn = (this.state.turn + 1) % 2;
    }

    // --- broadcast ---
    broadcastGameState() {

        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            const opponentIndex = (i + 1) % 2;


            const playerState = {
                // public info
                discardTop: this.discardPile[this.discardPile.length - 1],
                turn: this.players[this.state.turn].id,
                activeWildChoice: this.state.activeWildChoice,
                playerHandCounts: this.players.map(p => ({ id: p.id, count: p.hand.length })),

                // private info
                myHand: player.hand,
                myScore: this.scores[i],
                opponentScore: this.scores[opponentIndex]
            };

            // send to each player
            player.socket.emit("gameStateUpdate", playerState);
        }
    }
    requestRestart(socketId) {
        if (this.state.status !== "finished") return;

        this.restartVotes.add(socketId);


        const player = this.players.find(p => p.id === socketId);
        const opponent = this.players.find(p => p.id !== socketId);


        player.socket.emit("info", "sent restart request to opponent, waiting for approval...");


        if (opponent) {
            opponent.socket.emit("info", "opponent requests a game restart. Type 'yes' or 'y' to agree.");
        }


        if (this.restartVotes.size === 2) {
            this.resetGame();
        }
    }
    declineRestart(socketId) {
        if (this.state.status !== "finished") return;

        console.log(`[Game ${this.roomId}] Player ${socketId} declined restart.`);

        
        this.io.to(this.roomId).emit("restartDeclined", "Opponent declined to play again. Game closing.");

        
        this.restartVotes.clear();
    }

    resetGame() {
        console.log(`[Game ${this.roomId}] both players agreed to restart. Resetting game...`);


        // reset game state
        this.deck = new Deck(); // new shuffled deck
        this.discardPile = [];
        this.players[0].hand = [];
        this.players[1].hand = [];
        this.restartVotes.clear(); // clear votes
        this.state.activeWildChoice = null;


        this.startGame();
    }
}



module.exports = { GameRoom };