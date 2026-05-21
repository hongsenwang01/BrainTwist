interface DouyinRewardedVideoAdCloseData {
  isEnded?: boolean;
  count?: number;
}

interface DouyinRewardedVideoAdError {
  errCode?: number;
  errorCode?: number;
  errMsg?: string;
  message?: string;
}

interface DouyinRewardedVideoAdInstance {
  load?: () => Promise<void> | void;
  show: () => Promise<void> | void;
  onClose?: (callback: (data: DouyinRewardedVideoAdCloseData) => void) => void;
  offClose?: (callback: (data: DouyinRewardedVideoAdCloseData) => void) => void;
  onError?: (callback: (error: DouyinRewardedVideoAdError) => void) => void;
  offError?: (callback: (error: DouyinRewardedVideoAdError) => void) => void;
  destroy?: () => void;
}

interface DouyinApi {
  createRewardedVideoAd?: (options: {
    adUnitId: string;
  }) => DouyinRewardedVideoAdInstance;
}

export interface DouyinRewardedVideoAdOptions {
  adUnitId: string;
  mockSuccess?: boolean;
}

export class DouyinRewardedVideoAd {
  private videoAd: DouyinRewardedVideoAdInstance | null = null;
  private pendingResolve: ((watchedToEnd: boolean) => void) | null = null;
  private lastError: DouyinRewardedVideoAdError | null = null;
  private readonly closeHandler = (data: DouyinRewardedVideoAdCloseData) => {
    this.resolvePending(Boolean(data?.isEnded));
    this.preload();
  };
  private readonly errorHandler = (error: DouyinRewardedVideoAdError) => {
    this.lastError = error;
    this.resolvePending(false);
  };

  constructor(private readonly options: DouyinRewardedVideoAdOptions) {}

  public async show() {
    const tt = this.getDouyinApi();
    if (!tt?.createRewardedVideoAd) {
      return Boolean(this.options.mockSuccess);
    }

    const videoAd = this.ensureVideoAd(tt);
    if (!videoAd || this.pendingResolve) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      this.pendingResolve = resolve;
      this.showWithRetry(videoAd);
    });
  }

  public getLastError() {
    return this.lastError;
  }

  public destroy() {
    if (!this.videoAd) {
      return;
    }

    this.videoAd.offClose?.(this.closeHandler);
    this.videoAd.offError?.(this.errorHandler);
    this.videoAd.destroy?.();
    this.videoAd = null;
    this.resolvePending(false);
  }

  private ensureVideoAd(tt: DouyinApi) {
    if (this.videoAd) {
      return this.videoAd;
    }

    if (!this.options.adUnitId.trim()) {
      this.lastError = { errMsg: "adUnitId is empty" };
      return null;
    }

    try {
      this.videoAd = tt.createRewardedVideoAd?.({
        adUnitId: this.options.adUnitId.trim(),
      }) ?? null;
    } catch (error) {
      this.lastError = this.normalizeError(error);
      return null;
    }

    this.videoAd?.onClose?.(this.closeHandler);
    this.videoAd?.onError?.(this.errorHandler);
    this.preload();
    return this.videoAd;
  }

  private async showWithRetry(videoAd: DouyinRewardedVideoAdInstance) {
    try {
      await Promise.resolve(videoAd.show());
      return;
    } catch (error) {
      this.lastError = this.normalizeError(error);
    }

    try {
      await Promise.resolve(videoAd.load?.());
      await Promise.resolve(videoAd.show());
    } catch (error) {
      this.lastError = this.normalizeError(error);
      this.resolvePending(false);
    }
  }

  private resolvePending(watchedToEnd: boolean) {
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve?.(watchedToEnd);
  }

  private preload() {
    Promise.resolve(this.videoAd?.load?.()).catch((error) => {
      this.lastError = this.normalizeError(error);
    });
  }

  private normalizeError(error: unknown): DouyinRewardedVideoAdError {
    if (error && typeof error === "object") {
      return error as DouyinRewardedVideoAdError;
    }

    return { errMsg: String(error) };
  }

  private getDouyinApi() {
    return (globalThis as unknown as { tt?: DouyinApi }).tt;
  }
}
