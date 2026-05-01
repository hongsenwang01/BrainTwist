import { _decorator, Component, director, Label, sys, warn } from "cc";

const { ccclass, property } = _decorator;

type GuestLoginResponse = {
  code: number;
  message?: string;
  data?: {
    userId: string;
    nickname: string;
    avatarUrl: string;
    isGuest: boolean;
    loginCount: number;
  };
};

@ccclass("LoadingPercentLabel")
export class LoadingPercentLabel extends Component {
  @property({ type: Label, displayName: "百分比文本" })
  public percentLabel: Label | null = null;

  @property({ displayName: "目标场景名" })
  public preloadSceneName = "";

  @property({ displayName: "启动后自动播放预览" })
  public autoPlayPreviewOnStart = true;

  @property({ displayName: "预览时长" })
  public previewDuration = 2;

  @property({ displayName: "自动预加载场景" })
  public autoStartPreload = false;

  @property({ displayName: "加载完成后切场景" })
  public loadSceneWhenComplete = false;

  @property({ displayName: "启动时游客登录" })
  public guestLoginOnStart = true;

  @property({ displayName: "后端服务地址" })
  public backendBaseUrl = "http://localhost:3000";

  @property({ displayName: "登录接口路径" })
  public loginApiPath = "/api/auth/douyin-login";

  @property({ displayName: "抖音AppId" })
  public appId = "";

  @property({ displayName: "客户端版本" })
  public clientVersion = "dev";

  @property({ displayName: "登录失败仍继续" })
  public continueWhenLoginFailed = true;

  private previewElapsed = 0;
  private isPreviewPlaying = false;
  private isPreloading = false;
  private isStarting = false;

  onLoad() {
    this.percentLabel = this.percentLabel ?? this.node.getComponent(Label);
    this.setProgress(0);
  }

  async start() {
    if (this.isStarting) {
      return;
    }

    this.isStarting = true;

    if (this.guestLoginOnStart) {
      const loginSuccess = await this.loginAsGuest();
      if (!loginSuccess && !this.continueWhenLoginFailed) {
        return;
      }
    }

    if (this.autoStartPreload) {
      this.preloadScene();
      return;
    }

    if (this.autoPlayPreviewOnStart) {
      this.playPreview();
    }
  }

  update(deltaTime: number) {
    if (!this.isPreviewPlaying) {
      return;
    }

    this.previewElapsed += deltaTime;
    const duration = Math.max(this.previewDuration, 0.01);
    const progress = Math.min(this.previewElapsed / duration, 1);
    this.setProgress(progress);

    if (progress >= 1) {
      this.isPreviewPlaying = false;

      if (this.loadSceneWhenComplete && this.preloadSceneName) {
        director.loadScene(this.preloadSceneName);
      }
    }
  }

  public setProgress(progress: number) {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const percent = Math.round(clampedProgress * 100);

    if (this.percentLabel) {
      this.percentLabel.string = `${percent}%`;
    }
  }

  public playPreview() {
    this.isPreviewPlaying = true;
    this.previewElapsed = 0;
    this.setProgress(0);
  }

  public preloadScene(sceneName = this.preloadSceneName) {
    if (this.isPreloading) {
      return;
    }

    if (!sceneName) {
      warn("LoadingPercentLabel: preloadSceneName is empty.");
      return;
    }

    this.isPreloading = true;
    this.isPreviewPlaying = false;
    this.setProgress(0);

    director.preloadScene(
      sceneName,
      (completedCount: number, totalCount: number) => {
        this.setProgress(totalCount > 0 ? completedCount / totalCount : 1);
      },
      (error: Error | null) => {
        this.isPreloading = false;

        if (error) {
          warn(`LoadingPercentLabel: failed to preload scene "${sceneName}".`);
          return;
        }

        this.setProgress(1);

        if (this.loadSceneWhenComplete) {
          director.loadScene(sceneName);
        }
      },
    );
  }

  private async loginAsGuest() {
    const url = this.createLoginUrl();
    const guestCode = this.getOrCreateGuestCode();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: guestCode,
          userInfo: {
            nickName: "游客",
            avatarUrl: "",
            gender: 0,
            country: "",
            province: "",
            city: "",
            language: "zh_CN",
          },
          appId: this.appId,
          clientVersion: this.clientVersion,
        }),
      });

      if (!response.ok) {
        warn(`LoadingPercentLabel: guest login failed, status ${response.status}.`);
        return false;
      }

      const result = (await response.json()) as GuestLoginResponse;
      if (result.code !== 0 || !result.data) {
        warn(`LoadingPercentLabel: guest login failed, ${result.message ?? "unknown error"}.`);
        return false;
      }

      this.saveLoginData(result.data);
      return true;
    } catch (error) {
      warn(`LoadingPercentLabel: guest login request failed, ${String(error)}.`);
      return false;
    }
  }

  private createLoginUrl() {
    const baseUrl = this.backendBaseUrl.replace(/\/+$/, "");
    const path = this.loginApiPath.startsWith("/")
      ? this.loginApiPath
      : `/${this.loginApiPath}`;
    return `${baseUrl}${path}`;
  }

  private getOrCreateGuestCode() {
    const storageKey = "brain_twist_guest_code";
    const existingCode = sys.localStorage.getItem(storageKey);
    if (existingCode) {
      return existingCode;
    }

    const guestCode = `guest:${this.createClientId()}`;
    sys.localStorage.setItem(storageKey, guestCode);
    return guestCode;
  }

  private createClientId() {
    const randomPart = Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${randomPart}`;
  }

  private saveLoginData(data: NonNullable<GuestLoginResponse["data"]>) {
    sys.localStorage.setItem("brain_twist_user_id", data.userId);
    sys.localStorage.setItem("brain_twist_user_info", JSON.stringify(data));
  }
}
