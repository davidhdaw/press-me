// The last act of the game. Advancing past it ends the game: every mission
// locks, players' phones show "mission complete", and nothing more is handed
// out. The session itself stays open, so the bank and awards keep working.
// (Missions in later phases stay in the catalogue but are never assigned.)
export const FINAL_PHASE = 2;

export const isGameOver = (session) => (session?.current_phase || 0) > FINAL_PHASE;
