const RANKS = [
    "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "J", "Q", "K", "A","X","Y","C"
];

const SUITS = ["H", "D", "C", "S"]; // Hearts, Diamonds, Clubs, Spades

const getCardValue = (rank) => {
    const value = parseInt(rank, 10);
    if (rank === "A") return 1;
    if (rank === "X") return 10; // dozenal card X
    if (rank === "Y") return 11; // dozenal card Y
    if (rank === "10") return 12; // 10 is treated as 12 in dozenal
    if (value >= 2 && value < 10) return value;
    return null; // Face cards have no numeric value
};

class Card {
    constructor(rank, suit) {
        this.rank = rank;
        this.suit = suit;
        this.value = getCardValue(rank);
        this.id = `${rank}${suit}`; // Unique identifier for the card
    }

}

class Deck {
    constructor() {
        this.cards = [];
        // Initialization will call the reset and shuffle methods
        this.reset();
        this.shuffle();
    }
    reset() {
        this.cards = []; //clear existing cards
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new Card(rank, suit));

            }
        }
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    draw() {
        return this.cards.pop();
    }
    isEmpty() {
        return this.cards.length === 0;
    }
}
module.exports = { Deck, Card };