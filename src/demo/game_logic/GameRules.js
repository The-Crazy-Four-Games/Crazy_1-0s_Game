  // game-logic/rules.js

  /**
   * check if a played card is valid based on the game rules
   * @param {Card} playedCard - the card player wants to play
   * @param {Card} topCard - card on top of the discard pile
   * @param {object | null} activeWildChoice - active "Wildcard" choice if any
   * @returns {boolean}
   */
  function isValidPlay(playedCard, topCard, activeWildChoice) {
    if (!playedCard || !topCard) {
      return false;
    }
    if (playedCard.rank === '10') {
      return true;} // Wildcard can be played anytime
    // check wildcard 
    if (activeWildChoice) {
      if (activeWildChoice.type === 'suit') {
        return playedCard.suit === activeWildChoice.value;
      }
    }

    // Match suit
    if (playedCard.suit === topCard.suit) {
      return true;
    }

    // Match rank
    if (playedCard.rank === topCard.rank) {
      return true;
    }

    // Match value sum to 10
    if (playedCard.value && topCard.value && (playedCard.value + topCard.value === 12)) {
      return true;
    }

    return false;
  }


  /**
   * check if player has any playable card
   * @param {Card[]} hand - hand card 
   * @param {Card} topCard - card on top of discard pile
   * @param {object | null} activeWildChoice - active "Wildcard" choice if any
   * @returns {boolean}
   */
  function hasPlayableCard(hand, topCard, activeWildChoice) {
    for (const card of hand) {
      if (isValidPlay(card, topCard, activeWildChoice)) {
        return true;
      }
    }
    return false;
  }

  module.exports = { isValidPlay, hasPlayableCard }

