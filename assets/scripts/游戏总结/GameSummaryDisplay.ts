import { _decorator, Component, Label, sys, warn } from "cc";
import { GameResultData, GameResultStore } from "../工具/GameResultStore";
import { ScoreCountUpLabel } from "./ScoreCountUpLabel";

const { ccclass, property } = _decorator;

const ACHIEVEMENT_CACHE_DIRTY_KEY = "brain_twist_achievement_cache_dirty";
const BEST_SCORE_CACHE_KEY = "brain_twist_best_score_cache_v1";

type BestScoreCache = {
  userId: string;
  gameKey: string;
  gameMode: string;
  difficulty: string;
  savedAt: number;
  bestScore: number;
};

type BestScoreResponse = {
  code: number;
  message?: string;
  data?: {
    bestScore?: number;
  };
};

type SubmitScoreResponse = {
  code: number;
  message?: string;
  data?: {
    roundId?: string;
    isNewBest?: boolean;
    bestScore?: number;
  };
};

@ccclass("GameSummaryDisplay")
export class GameSummaryDisplay extends Component {
  @property({ type: Label, displayName: "本局分数文本" })
  public scoreLabel: Label | null = null;

  @property({ type: Label, displayName: "历史最高分文本" })
  public historyBestScoreLabel: Label | null = null;

  @property({ type: Label, displayName: "正确次数文本" })
  public correctCountLabel: Label | null = null;

  @property({ type: Label, displayName: "正确率文本" })
  public accuracyLabel: Label | null = null;

  @property({ type: Label, displayName: "最快反应文本" })
  public fastestReactionLabel: Label | null = null;

  @property({ type: Label, displayName: "最大连击文本" })
  public maxComboLabel: Label | null = null;

  @property({ type: Label, displayName: "游戏时长文本" })
  public durationLabel: Label | null = null;

  @property({ type: Label, displayName: "失误次数文本" })
  public wrongCountLabel: Label | null = null;

  @property({ displayName: "分数增长整体延迟" })
  public scoreCountUpStartDelay = 0.35;

  @property({ displayName: "历史分数延迟增加" })
  public historyScoreExtraDelay = 0.12;

  @property({ displayName: "自动上传成绩" })
  public autoUploadScore = true;

  @property({ displayName: "后端服务地址" })
  public backendBaseUrl = "http://localhost:3000";

  @property({ displayName: "提交成绩接口路径" })
  public submitScoreApiPath = "/api/game-scores/submit";

  @property({ displayName: "最高分接口路径" })
  public bestScoreApiPath = "/api/game-scores/best";

  @property({ displayName: "游戏标识" })
  public gameKey = "reverse_brain";

  @property({ displayName: "游戏模式" })
  public gameMode = "classic";

  @property({ displayName: "难度" })
  public difficulty = "normal";

  @property({ displayName: "客户端版本" })
  public clientVersion = "dev";

  private hasUploadedScore = false;
  private displayedHistoryBestScore = 0;

  start() {
    const result = GameResultStore.getResult();
    this.prepareLabelsForLoading();
    void this.loadSummaryDataThenRender(result);
  }

  public render(result: GameResultData, historyBestScore = result.historyBestScore) {
    this.displayedHistoryBestScore = Math.max(0, Math.floor(historyBestScore));

    this.setScoreLabel(this.scoreLabel, this.formatNumber(result.score), 0);
    this.setScoreLabel(
      this.historyBestScoreLabel,
      this.formatNumber(this.displayedHistoryBestScore),
      this.historyScoreExtraDelay,
    );
    this.setLabel(this.correctCountLabel, `${result.correctCount}`);
    this.setLabel(this.accuracyLabel, `${Math.round(result.accuracy)}%`);
    this.setLabel(
      this.fastestReactionLabel,
      result.fastestReaction > 0 ? result.fastestReaction.toFixed(2) : "--",
    );
    this.setLabel(this.maxComboLabel, `${result.maxCombo}`);
    this.setLabel(this.durationLabel, this.formatDuration(result.durationSeconds));
    this.setLabel(this.wrongCountLabel, `${result.wrongCount}`);
  }

  private setScoreLabel(label: Label | null, text: string, extraDelay: number) {
    if (label) {
      const scoreCountUpLabel = label.node.getComponent(ScoreCountUpLabel);
      if (scoreCountUpLabel) {
        scoreCountUpLabel.startDelay = Math.max(
          0,
          this.scoreCountUpStartDelay + extraDelay,
        );
        scoreCountUpLabel.playToText(text);
        return;
      }

      label.string = text;
    }
  }

  private setLabel(label: Label | null, text: string) {
    if (label) {
      label.string = text;
    }
  }

  private prepareLabelsForLoading() {
    this.setPlainLabel(this.scoreLabel, "");
    this.setPlainLabel(this.historyBestScoreLabel, "");
    this.setLabel(this.correctCountLabel, "");
    this.setLabel(this.accuracyLabel, "");
    this.setLabel(this.fastestReactionLabel, "");
    this.setLabel(this.maxComboLabel, "");
    this.setLabel(this.durationLabel, "");
    this.setLabel(this.wrongCountLabel, "");
  }

  private setPlainLabel(label: Label | null, text: string) {
    if (!label) {
      return;
    }

    label.node.getComponent(ScoreCountUpLabel)?.stop(false);
    label.string = text;
  }

  private formatNumber(value: number) {
    return Math.max(0, Math.floor(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  private formatDuration(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const restSeconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${restSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  private async uploadScore(result: GameResultData) {
    if (this.hasUploadedScore) {
      return null;
    }

    this.hasUploadedScore = true;

    const userId = sys.localStorage.getItem("brain_twist_user_id");
    if (!userId) {
      warn("GameSummaryDisplay: userId is missing, skip score upload.");
      return null;
    }

    try {
      const response = await fetch(this.createSubmitScoreUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.createSubmitScorePayload(userId, result)),
      });

      if (!response.ok) {
        warn(`GameSummaryDisplay: score upload failed, status ${response.status}.`);
        return null;
      }

      const uploadResult = (await response.json()) as SubmitScoreResponse;
      if (uploadResult.code !== 0 || !uploadResult.data) {
        warn(
          `GameSummaryDisplay: score upload failed, ${
            uploadResult.message ?? "unknown error"
          }.`,
        );
        return null;
      }

      sys.localStorage.setItem(ACHIEVEMENT_CACHE_DIRTY_KEY, "1");

      if (typeof uploadResult.data.bestScore === "number") {
        const bestScore = Math.max(0, Math.floor(uploadResult.data.bestScore));
        this.saveBestScoreCache(userId, bestScore);
        return bestScore;
      }
    } catch (error) {
      warn(`GameSummaryDisplay: score upload request failed, ${String(error)}.`);
    }

    return null;
  }

  private async loadSummaryDataThenRender(result: GameResultData) {
    const userId = sys.localStorage.getItem("brain_twist_user_id");
    let historyBestScore = this.getFallbackHistoryBestScore(result);

    if (userId) {
      const remoteHistoryBestScore = await this.loadHistoryBestScoreBeforeSubmit(userId);
      if (typeof remoteHistoryBestScore === "number") {
        historyBestScore = Math.max(historyBestScore, remoteHistoryBestScore);
      }
    }

    if (this.autoUploadScore) {
      const uploadedBestScore = await this.uploadScore(result);
      if (typeof uploadedBestScore === "number") {
        historyBestScore = Math.max(historyBestScore, uploadedBestScore);
      }
    }

    this.render(result, historyBestScore);
  }

  private async loadHistoryBestScoreBeforeSubmit(userId: string) {
    try {
      const response = await fetch(this.createBestScoreUrl(userId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        warn(`GameSummaryDisplay: best score request failed, status ${response.status}.`);
        return null;
      }

      const result = (await response.json()) as BestScoreResponse;
      if (result.code !== 0 || !result.data || typeof result.data.bestScore !== "number") {
        warn(`GameSummaryDisplay: best score request failed, ${result.message ?? "unknown error"}.`);
        return null;
      }

      const historyBestScore = Math.max(0, Math.floor(result.data.bestScore));
      this.saveBestScoreCache(userId, historyBestScore);
      return historyBestScore;
    } catch (error) {
      warn(`GameSummaryDisplay: best score request failed, ${String(error)}.`);
    }

    return null;
  }

  private createSubmitScorePayload(userId: string, result: GameResultData) {
    return {
      clientRoundKey: this.createClientRoundKey(userId, result),
      userId,
      gameKey: this.gameKey,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      score: Math.max(0, Math.floor(result.score)),
      correctCount: Math.max(0, Math.floor(result.correctCount)),
      wrongCount: Math.max(0, Math.floor(result.wrongCount)),
      wrongInputCount: Math.max(0, Math.floor(result.wrongInputCount)),
      missedCount: Math.max(0, Math.floor(result.missedCount)),
      totalQuestions: Math.max(0, Math.floor(result.totalQuestions)),
      accuracy: Math.max(0, Math.min(100, result.accuracy)),
      maxCombo: Math.max(0, Math.floor(result.maxCombo)),
      fastestReactionMs:
        result.fastestReaction > 0 ? Math.round(result.fastestReaction * 1000) : null,
      durationMs: Math.max(0, Math.floor(result.durationMs)),
      remainingLives: Math.max(0, Math.floor(result.remainingLives)),
      startedAt: result.startedAt || null,
      endedAt: result.endedAt || new Date().toISOString(),
      clientVersion: this.clientVersion,
      deviceInfo: this.createDeviceInfo(),
      extraData: {
        durationSeconds: Math.max(0, Math.floor(result.durationSeconds)),
        frontendHistoryBestScore: Math.max(0, Math.floor(result.historyBestScore)),
      },
    };
  }

  private createClientRoundKey(userId: string, result: GameResultData) {
    const startedAt = result.startedAt || "unknown-start";
    const endedAt = result.endedAt || "unknown-end";
    const score = Math.max(0, Math.floor(result.score));
    return `${userId}:${this.gameKey}:${this.gameMode}:${startedAt}:${endedAt}:${score}`;
  }

  private saveBestScoreCache(userId: string, bestScore: number) {
    sys.localStorage.setItem(
      BEST_SCORE_CACHE_KEY,
      JSON.stringify({
        userId,
        gameKey: this.gameKey,
        gameMode: this.gameMode,
        difficulty: this.difficulty,
        savedAt: Date.now(),
        bestScore: Math.max(0, Math.floor(bestScore)),
      }),
    );
  }

  private getCachedBestScore() {
    const userId = sys.localStorage.getItem("brain_twist_user_id");
    if (!userId) {
      return null;
    }

    try {
      const rawCache = sys.localStorage.getItem(BEST_SCORE_CACHE_KEY);
      if (!rawCache) {
        return null;
      }

      const cache = JSON.parse(rawCache) as BestScoreCache;
      if (
        cache.userId !== userId ||
        cache.gameKey !== this.gameKey ||
        cache.gameMode !== this.gameMode ||
        cache.difficulty !== this.difficulty ||
        typeof cache.bestScore !== "number"
      ) {
        return null;
      }

      return Math.max(0, Math.floor(cache.bestScore));
    } catch (error) {
      warn(`GameSummaryDisplay: read best score cache failed, ${String(error)}.`);
      return null;
    }
  }

  private getFallbackHistoryBestScore(result: GameResultData) {
    const cachedBestScore = this.getCachedBestScore();
    return typeof cachedBestScore === "number"
      ? Math.max(cachedBestScore, result.historyBestScore)
      : Math.max(0, Math.floor(result.historyBestScore));
  }

  private createSubmitScoreUrl() {
    const baseUrl = this.backendBaseUrl.replace(/\/+$/, "");
    const path = this.submitScoreApiPath.startsWith("/")
      ? this.submitScoreApiPath
      : `/${this.submitScoreApiPath}`;
    return `${baseUrl}${path}`;
  }

  private createBestScoreUrl(userId: string) {
    const baseUrl = this.backendBaseUrl.replace(/\/+$/, "");
    const path = this.bestScoreApiPath.startsWith("/")
      ? this.bestScoreApiPath
      : `/${this.bestScoreApiPath}`;
    const query = [
      `userId=${encodeURIComponent(userId)}`,
      `gameKey=${encodeURIComponent(this.gameKey)}`,
      `gameMode=${encodeURIComponent(this.gameMode)}`,
      `difficulty=${encodeURIComponent(this.difficulty)}`,
    ].join("&");
    return `${baseUrl}${path}?${query}`;
  }

  private createDeviceInfo() {
    const sysInfo = sys as unknown as Record<string, unknown>;
    return {
      platform: sysInfo.platform ?? "",
      os: sysInfo.os ?? "",
      language: sysInfo.language ?? "",
      isBrowser: sys.isBrowser,
      isMobile: sys.isMobile,
    };
  }
}
