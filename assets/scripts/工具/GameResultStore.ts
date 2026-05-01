export type GameResultData = {
  score: number;
  historyBestScore: number;
  correctCount: number;
  accuracy: number;
  fastestReaction: number;
  maxCombo: number;
  durationSeconds: number;
  durationMs: number;
  wrongCount: number;
  wrongInputCount: number;
  missedCount: number;
  totalQuestions: number;
  remainingLives: number;
  startedAt: string;
  endedAt: string;
};

const emptyResult: GameResultData = {
  score: 0,
  historyBestScore: 0,
  correctCount: 0,
  accuracy: 0,
  fastestReaction: 0,
  maxCombo: 0,
  durationSeconds: 0,
  durationMs: 0,
  wrongCount: 0,
  wrongInputCount: 0,
  missedCount: 0,
  totalQuestions: 0,
  remainingLives: 0,
  startedAt: "",
  endedAt: "",
};

export class GameResultStore {
  private static result: GameResultData = { ...emptyResult };

  public static setResult(result: GameResultData) {
    this.result = { ...result };
  }

  public static getResult() {
    return { ...this.result };
  }

  public static clear() {
    this.result = { ...emptyResult };
  }
}
