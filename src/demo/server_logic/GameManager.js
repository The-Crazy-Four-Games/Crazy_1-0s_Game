// server-logic/GameManager.js
const { GameRoom } = require("../game_logic/GameRoom");
const { v4: uuidv4 } = require('uuid'); // room ID generator

class GameManager {
    constructor(io) {
        this.io = io; // save io instance
        this.games = new Map(); // store active games, K: roomId, V: GameRoom instance
        this.socketToRoom = new Map(); // K: socket.id, V: roomId
    }

    createGame(socket) {
        const roomId = uuidv4().substring(0, 6); // create a short unique room ID
        const game = new GameRoom(roomId, this.io);

        this.games.set(roomId, game);
        this.socketToRoom.set(socket.id, roomId);

        game.addPlayer(socket);
        socket.emit("gameCreated", { roomId });
    }

    joinGame(socket, roomId) {
        const game = this.games.get(roomId);
        if (!game) {
            return socket.emit("error", "room not found");
        }
        if (game.isFull()) {
            return socket.emit("error", "room is full");
        }

        this.socketToRoom.set(socket.id, roomId);
        game.addPlayer(socket);
    }

    handleRestart(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (roomId) {
            const game = this.games.get(roomId);
            if (game) {
                // send restart request to game room
                game.requestRestart(socket.id);
            }
        }
    }
    handleDecline(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (roomId) {
            const game = this.games.get(roomId);
            if (game) {
                game.declineRestart(socket.id);
            }
        }
    }
    handleGameAction(socket, actionType, data) {
        const roomId = this.socketToRoom.get(socket.id);
        const game = this.games.get(roomId);
        if (!game) {
            return socket.emit("error", "not in a game room");
        }

        // let the game room handle the action
        game.handleAction(socket.id, actionType, data);
    }

    handleDisconnect(socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (roomId) {
            const game = this.games.get(roomId);
            if (game) {
                game.removePlayer(socket.id);
                // if the game is empty after removal, delete it
                if (game.isEmpty()) {
                    this.games.delete(roomId);
                    console.log(`[Manager] Room ${roomId} cleaned up`);
                }
            }
            this.socketToRoom.delete(socket.id);
        }
    }
}

module.exports = { GameManager };