// backend/src/modules/realtimeGateway/events.ts

export const WS = {
  // client -> server
  JOIN_GAME: "join_game",
  SUBMIT_ACTION: "submit_action",

  // server -> client
  GAME_STATE: "game_state",
  ERROR: "error",
} as const;

export type JoinGamePayload = { gameId: string };
export type SubmitActionPayload = { gameId: string; action: unknown }; // action type can be replaced with actual GameAction type
