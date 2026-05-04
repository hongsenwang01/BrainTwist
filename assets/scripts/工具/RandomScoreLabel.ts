import { _decorator, Component, Label, sys, warn } from "cc";

const { ccclass, property } = _decorator;

type BestScoreResponse = {
  code: number;
  message?: string;
  data?: {
    bestScore?: number;
  };
};

type BestScoreCache = {
  userId: string;
  gameKey: string;
  gameMode: string;
  savedAt: number;
  bestScore: number;
};

const BEST_SCORE_CACHE_KEY = "brain_twist_best_score_cache_v1";

@ccclass("RandomScoreLabel")
export class RandomScoreLabel extends Component {
  @property({ type: Label, displayName: "目标文本" })
  public targetLabel: Label | null = null;

  @property({ displayName: "随机最大分数" })
  public maxScore = 5000;

  @property({ displayName: "开始时随机分数" })
  public randomizeOnStart = true;

  @property({ displayName: "接口获取最高分" })
  public fetchBestScoreOnStart = false;

  @property({ displayName: "后端服务地址" })
  public backendBaseUrl = "http://localhost:3000";

  @property({ displayName: "最高分接口路径" })
  public bestScoreApiPath = "/api/game-scores/best";

  @property({ displayName: "游戏标识" })
  public gameKey = "reverse_brain";

  @property({ displayName: "游戏模式" })
  public gameMode = "classic";

  @property({ displayName: "使用最高分缓存" })
  public useBestScoreCache = true;

  @property({ displayName: "最高分缓存秒" })
  public bestScoreCacheTtlSeconds = 60;

  start() {
    this.targetLabel = this.targetLabel ?? this.node.getComponent(Label);

    if (this.fetchBestScoreOnStart) {
      this.showCachedBestScore();
      void this.fetchBestScore();
      return;
    }

    if (this.randomizeOnStart) {
      this.showRandomScore();
    }
  }

  public showRandomScore() {
    this.setScore(this.createRandomScore());
  }

  public setScore(score: number) {
    if (!this.targetLabel) {
      return;
    }

    this.targetLabel.string = this.formatScore(score);
  }

  private createRandomScore() {
    const max = Math.max(0, Math.floor(this.maxScore));
    return Math.floor(Math.random() * (max + 1));
  }

  private showCachedBestScore() {
    const userId = sys.localStorage.getItem("brain_twist_user_id");
    const cache = this.readBestScoreCache();
    if (!userId || !cache || !this.isCacheForCurrentContext(cache, userId)) {
      this.setScore(0);
      return;
    }

    this.setScore(cache.bestScore);
  }

  private async fetchBestScore() {
    const userId = sys.localStorage.getItem("brain_twist_user_id");
    if (!userId) {
      warn("RandomScoreLabel: userId is missing, skip best score request.");
      return;
    }

    if (this.useBestScoreCache && !this.shouldRefreshBestScore(userId)) {
      return;
    }

    try {
      const response = await fetch(this.createBestScoreUrl(userId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        warn(`RandomScoreLabel: best score request failed, status ${response.status}.`);
        return;
      }

      const result = (await response.json()) as BestScoreResponse;
      if (result.code !== 0 || !result.data || typeof result.data.bestScore !== "number") {
        warn(`RandomScoreLabel: best score request failed, ${result.message ?? "unknown error"}.`);
        return;
      }

      const bestScore = Math.max(0, Math.floor(result.data.bestScore));
      this.setScore(bestScore);
      this.saveBestScoreCache(userId, bestScore);
    } catch (error) {
      warn(`RandomScoreLabel: best score request failed, ${String(error)}.`);
    }
  }

  private shouldRefreshBestScore(userId: string) {
    const cache = this.readBestScoreCache();
    if (!this.isCacheForCurrentContext(cache, userId)) {
      return true;
    }

    const ttlMs = Math.max(0, this.bestScoreCacheTtlSeconds) * 1000;
    return ttlMs > 0 && Date.now() - cache.savedAt >= ttlMs;
  }

  private readBestScoreCache(): BestScoreCache | null {
    try {
      const rawCache = sys.localStorage.getItem(BEST_SCORE_CACHE_KEY);
      if (!rawCache) {
        return null;
      }

      const cache = JSON.parse(rawCache) as BestScoreCache;
      return typeof cache.bestScore === "number" ? cache : null;
    } catch (error) {
      warn(`RandomScoreLabel: read best score cache failed, ${String(error)}.`);
      return null;
    }
  }

  private isCacheForCurrentContext(cache: BestScoreCache | null, userId: string) {
    return Boolean(
      cache &&
        cache.userId === userId &&
        cache.gameKey === this.gameKey &&
        cache.gameMode === this.gameMode,
    );
  }

  private saveBestScoreCache(userId: string, bestScore: number) {
    if (!this.useBestScoreCache) {
      return;
    }

    const cache: BestScoreCache = {
      userId,
      gameKey: this.gameKey,
      gameMode: this.gameMode,
      savedAt: Date.now(),
      bestScore,
    };

    sys.localStorage.setItem(BEST_SCORE_CACHE_KEY, JSON.stringify(cache));
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
    ].join("&");
    return `${baseUrl}${path}?${query}`;
  }

  private formatScore(score: number) {
    const safeScore = Math.max(0, Math.floor(score));
    return safeScore.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}
