import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Card, Suit, PublicState } from '../types/game';
import { WS_EVENTS, getPlayableCards, isWildcard, getCardId } from '../types/game';

const WS_URL = 'http://localhost:3001';

interface ConnectionState {
  socket: Socket | null;
  connected: boolean;
  error: string | null;
}

export function useGameState(token: string | null, gameId: string | null, userId: string | null) {
  const [publicState, setPublicState] = useState<PublicState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showSuitSelector, setShowSuitSelector] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<Card | null>(null);
  const [message, setMessage] = useState<string>('');
  const [connection, setConnection] = useState<ConnectionState>({
    socket: null,
    connected: false,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token) {
      setMessage('Please login first');
      return;
    }
    if (socketRef.current) {
      setMessage('Already connected');
      return;
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnection({ socket, connected: true, error: null });
      setMessage('Connected to server');
    });

    socket.on('disconnect', (reason) => {
      setConnection({ socket: null, connected: false, error: `Disconnected: ${reason}` });
      socketRef.current = null;
    });

    socket.on(WS_EVENTS.GAME_STATE, (state: PublicState) => {
      setPublicState(state);
      setMessage(`Turn: ${state.turn === userId ? 'Your turn!' : 'Opponent\'s turn'}`);
    });

    socket.on(WS_EVENTS.MY_HAND, (payload: { hand: Card[] }) => {
      setMyHand(payload.hand || []);
    });

    socket.on(WS_EVENTS.ERROR, (error: { code: string; message: string }) => {
      setMessage(`Error: ${error.message}`);
    });

    socketRef.current = socket;
  }, [token, userId]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnection({ socket: null, connected: false, error: null });
    }
  }, []);

  // Join game room
  const joinGame = useCallback(() => {
    if (!socketRef.current || !gameId) {
      setMessage('Connect to server and have a game ID first');
      return;
    }
    socketRef.current.emit(WS_EVENTS.JOIN_GAME, { gameId });
    setMessage('Joining game...');
  }, [gameId]);

  // Emit action to server
  const emitAction = useCallback((action: any) => {
    if (!socketRef.current || !gameId) {
      setMessage('Not connected or no game');
      return;
    }
    socketRef.current.emit(WS_EVENTS.SUBMIT_ACTION, { gameId, action });
  }, [gameId]);

  // Computed values
  const isPlayerTurn = publicState?.turn === userId;
  const topCard = publicState?.topCard || null;
  const playableCards = publicState && topCard
    ? getPlayableCards(myHand, topCard, publicState.forcedSuit, publicState.faceRanks)
    : [];

  // Select a card
  const selectCard = useCallback((card: Card) => {
    if (!isPlayerTurn) return;
    setSelectedCard(prev => 
      prev && getCardId(prev) === getCardId(card) ? null : card
    );
  }, [isPlayerTurn]);

  // Play the selected card
  const playCard = useCallback(() => {
    if (!selectedCard || !isPlayerTurn || !userId) return;

    // If playing a wildcard (10), show suit selector
    if (isWildcard(selectedCard.rank)) {
      setPendingWildCard(selectedCard);
      setShowSuitSelector(true);
      return;
    }

    // Execute play
    emitAction({
      type: 'PLAY',
      playerId: userId,
      card: selectedCard,
    });
    setSelectedCard(null);
  }, [selectedCard, isPlayerTurn, userId, emitAction]);

  // Handle suit selection for wildcard
  const selectSuit = useCallback((suit: Suit) => {
    if (pendingWildCard && userId) {
      emitAction({
        type: 'PLAY',
        playerId: userId,
        card: pendingWildCard,
        chosenSuit: suit,
      });
      setPendingWildCard(null);
      setShowSuitSelector(false);
      setSelectedCard(null);
    }
  }, [pendingWildCard, userId, emitAction]);

  // Cancel suit selection
  const cancelSuitSelection = useCallback(() => {
    setPendingWildCard(null);
    setShowSuitSelector(false);
  }, []);

  // Draw a card
  const drawCard = useCallback(() => {
    if (!isPlayerTurn || !userId) return;
    emitAction({
      type: 'DRAW',
      playerId: userId,
    });
  }, [isPlayerTurn, userId, emitAction]);

  // Pass turn
  const passTurn = useCallback(() => {
    if (!isPlayerTurn || !userId) return;
    emitAction({
      type: 'PASS',
      playerId: userId,
    });
  }, [isPlayerTurn, userId, emitAction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    // Connection
    connected: connection.connected,
    connect,
    disconnect,
    joinGame,
    
    // Game state
    publicState,
    myHand,
    isPlayerTurn,
    topCard,
    playableCards,
    
    // Card selection
    selectedCard,
    selectCard,
    showSuitSelector,
    
    // Actions
    playCard,
    selectSuit,
    cancelSuitSelection,
    drawCard,
    passTurn,
    
    // UI
    message,
  };
}
