
const { io } = require("socket.io-client");
const readline = require("readline");

// create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// connect to server
const socket = io("http://localhost:3001");

let myHand = []; // store player's hand locally
let myId = "";
let currentRoomId = "";
let currentTurn = "";
let currentTopCard = null;
let myScore = 0;
let opponentScore = 0;
// show game prompt
function showGamePrompt() {
    console.log("--------------------");
    console.log(`🏆 Total Score: You [${myScore}] - Opponent [${opponentScore}] 🏆`);
    console.log(`Room: ${currentRoomId} | Your ID: ${myId}`);
    console.log(`Top Card on Discard Pile: ${currentTopCard ? currentTopCard.id : "N/A"}`);
    console.log(`\nYour Hand Cards: [ ${myHand.map(c => c.id).join(", ")} ]\n`);

    if (currentTurn === myId) {
        console.log(">>> Now it's your turn <<<");
        rl.question("enter 'play cardId' or 'draw' > ", handleGameInput);
    } else {
        console.log(`wait ${currentTurn} to move...`);

    }
}

// about wildcard choice
function showWildChoicePrompt() {
    console.log("--------------------");
    console.log("You played 10 (Wildcard)!");
    rl.question("Please specify (H, D, C, S) > ", (input) => {
        // convert to uppercase and trim whitespace
        const suit = input.toUpperCase().trim();

        // validate input
        if (['H', 'D', 'C', 'S'].includes(suit)) {

            const choice = { type: 'suit', value: suit };

            // send wild choice to server
            socket.emit("setWildChoice", { choice });
        } else {
            console.log("Invalid choice。Please enter 'H', 'D', 'C', or 'S'。");
            showWildChoicePrompt(); // re-prompt
        }
    });
}

// ---------------------------------
// Socket.IO event handlers
// ---------------------------------

socket.on("connect", () => {
    myId = socket.id;
    console.log(`[Client] Connected Successfully! Your ID: ${myId}`);
    // after connecting, show lobby prompt
    showLobbyPrompt();
});

// --- Lobby event ---
function showLobbyPrompt() {
    rl.question("Enter 'create' to create a game, or 'join roomId' to join an existing room > ", (input) => {
        if (input === "create") {
            socket.emit("createGame");
        } else if (input.startsWith("join ")) {
            const roomId = input.split(" ")[1];
            socket.emit("joinGame", roomId);
        } else {
            console.log("Invalid command.");
            showLobbyPrompt();
        }
    });
}

socket.on("gameCreated", (data) => {
    currentRoomId = data.roomId;
    console.log(`[Client] Game room created! Room ID: ${currentRoomId}`);
    console.log("Waiting for another player to join...");
});

socket.on("joinedRoom", (data) => {
    currentRoomId = data.roomId;
    console.log(`[Client] Joined game room ID: ${currentRoomId}`);
    if (data.playerCount < 2) {
        console.log("Waiting for another player to join...");
    }
});

// --- Game Event ---

// monitor game state updates
socket.on("gameStateUpdate", (state) => {
    console.log("\n--- Game state update ---");

    // update local variables
    myHand = state.myHand;
    currentTurn = state.turn;
    currentTopCard = state.discardTop;
    myScore = state.myScore;
    opponentScore = state.opponentScore;

    // print public info

    state.playerHandCounts.forEach(p => {
        const tag = p.id === myId ? " (You)" : " (Opponent)";
        console.log(`Player ${p.id.substring(0, 4)}${tag} has ${p.count} cards`);
    });

    // Check Wildcard
    if (state.activeWildChoice) {
        console.log(`** Wildcard activated: need ${state.activeWildChoice.type} = ${state.activeWildChoice.value} **`);
    }

    // show prompt for next action
    showGamePrompt();
});


// monitor wildcard choice request
socket.on("requestWildChoice", () => {
    showWildChoicePrompt();
});

// monitor drew cards event
socket.on("drewCards", (message) => {
    console.log(`[Server] ${message}`);

});

// monitor game over event
socket.on("gameOver", (message) => {
    console.log("\n!!!!!!!!!!!!!!!!!!!!");
    console.log(`Game is over: ${message}`);
    console.log("!!!!!!!!!!!!!!!!!!!!");
    rl.question("Start a new game? (enter 'yes' or 'y' to restart, 'no' or 'n' to quit) > ", (input) => {
        const answer = input.toLowerCase().trim();
        if (answer === 'yes' || answer === 'y') {
            console.log("Waiting for opponent...");
            socket.emit("requestRestart");
        }
        else if(answer === 'no' || answer === 'n'){
            console.log("You declined. Quitting game...");
            socket.emit("declineRestart");
            socket.disconnect();
            rl.close();
        }
    
        else {
            console.log("Invalid input, quitting...");
            socket.emit("declineRestart");
            socket.disconnect();
            rl.close();
        }
    });
});
socket.on("restartDeclined", (message) => {
    console.log("\n----------------");
    console.log(message); // "Opponent declined the restart."
    console.log("Quitting game...");
    console.log("----------------");
    socket.disconnect();
    rl.close();
});
// Monitor error events
socket.on("error", (message) => {
    console.error(`\n!!! Server error: ${message} !!!`);

    // If error occurs during player's turn, re-show prompt
    if (currentTurn === myId) {
        rl.question("enter 'play cardId' or 'draw' > ", handleGameInput);
    }
});

socket.on("disconnect", () => {
    console.log("[Client] disconnected from server.");
    rl.close();
});
socket.on("roundOver", (data) => {
    console.log("\n++++++++++++++++++++");
    console.log("Round ended!");

    if (data.winnerId === null) {
        console.log("Draw game!");
    } else {
        const winnerTag = data.winnerId === myId ? "(You!)" : "(Opponent)";
        console.log(`Winner: ${data.winnerId.substring(0, 4)} ${winnerTag}`);
        console.log(`Got scores: +${data.roundScore}`);
    }

    console.log(`New Total: ${data.scores[0]} - ${data.scores[1]}`);
    console.log("... Preparing for next game ...");
    console.log("++++++++++++++++++++\n");

});


socket.on("gameOver", (message) => {
  console.log("\n!!!!!!!!!!!!!!!!!!!!");
  console.log(`GG: ${message}`);
  console.log("!!!!!!!!!!!!!!!!!!!!");
  
  // restart prompt
  rl.question("Want another game? (enter 'yes' or 'y' , otherwise quit) > ", (input) => {
    const answer = input.toLowerCase().trim();
    if (answer === 'yes' || answer === 'y') {
      // send restart request to server
      socket.emit("requestRestart");
    } else {
      console.log("Thanks for playing!");
      socket.disconnect();
      rl.close();
    }
  });
});

// ---------------------------------
// Command handlers
// ---------------------------------

// input handler for game actions
function handleGameInput(input) {
    if (input.startsWith("play ")) {
        const cardId = input.split(" ")[1];
        socket.emit("playCard", { cardId });
    } else if (input === "draw") {
        socket.emit("drawCard");
    } else {
        console.log("Invalid command.");
        showGamePrompt();
    }
    // wait for server response...



}
