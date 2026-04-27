export type GameResultData = {
  score: number;
  historyBestScore: number;
  correctCount: number;
  accuracy: number;
  fastestReaction: number;
  maxCombo: number;
  durationSeconds: number;
  wrongCount: number;
};

const emptyResult: GameResultData = {
  score: 0,
  historyBestScore: 0,
  correctCount: 0,
  accuracy: 0,
  fastestReaction: 0,
  maxCombo: 0,
  durationSeconds: 0,
  wrongCount: 0,
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
