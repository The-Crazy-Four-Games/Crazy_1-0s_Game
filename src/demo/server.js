const { Server } = require('socket.io');
const { GameManager } = require('./server_logic/GameManager');
const io = new Server(3001, {
    cors: { origin: "*" }
});
const gameManager = new GameManager(io);

console.log(
    "WebSocket server is running on ws://localhost:3001"
)
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on("createGame", () => {
        gameManager.createGame(socket);
    });
    socket.on("joinGame", (roomId) => {
        gameManager.joinGame(socket, roomId);
    });
    socket.on("playCard", (data) => {
        gameManager.handleGameAction(socket, "playCard", data);
    });
    socket.on("drawCard", () => {
        gameManager.handleGameAction(socket, "drawCard");
    });
    socket.on("setWildChoice", (data) => {
        gameManager.handleGameAction(socket, "setWildChoice", data);
    });
    socket.on("disconnect", () => {
        console.log(`Player ${socket.id} disconnected`);
        gameManager.handleDisconnect(socket);
    });
    socket.on("requestRestart", () => {
        gameManager.handleRestart(socket);
    });
    socket.on("declineRestart", () => {
        gameManager.handleDecline(socket);
    });
});
