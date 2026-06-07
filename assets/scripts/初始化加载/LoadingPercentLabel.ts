import { _decorator, Component, director, Label, sys, warn } from "cc";
import { ApiService } from "../工具/ApiService";
import { RemoteSceneLoader } from "../工具/RemoteSceneLoader";

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

type DouyinLoginResult = {
  code?: string;
  anonymousCode?: string;
  anonymous_code?: string;
};

type DouyinUserInfo = {
  nickName?: string;
  nickname?: string;
  name?: string;
  avatarUrl?: string;
  avatar?: string;
  gender?: number;
  country?: string;
  province?: string;
  city?: string;
  language?: string;
};

type DouyinUserInfoResult = {
  userInfo?: DouyinUserInfo;
};

type DouyinApi = {
  login?: (options: {
    force?: boolean;
    success?: (result: DouyinLoginResult) => void;
    fail?: (error: unknown) => void;
  }) => void;
  getUserInfo?: (options: {
    withCredentials?: boolean;
    success?: (result: DouyinUserInfoResult) => void;
    fail?: (error: unknown) => void;
  }) => void;
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

  @property({ displayName: "启动时登录" })
  public guestLoginOnStart = true;

  @property({ displayName: "接口前缀" })
  public apiBaseUrl = "http://localhost:8000";

  @property({ displayName: "登录接口路径" })
  public loginApiPath = "/api/auth/douyin-login";

  @property({ displayName: "抖音AppId" })
  public appId = "";

  @property({ displayName: "抖音强制登录" })
  public forceDouyinLogin = true;

  @property({ displayName: "请求用户信息授权" })
  public requestDouyinUserInfo = true;

  @property({ displayName: "非抖音环境允许游客" })
  public allowDevGuestLogin = true;

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
    ApiService.configure({
      baseUrl: this.apiBaseUrl,
    });

    if (this.guestLoginOnStart) {
      const loginSuccess = await this.loginOnStart();
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
        RemoteSceneLoader.loadScene(this.preloadSceneName);
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
          RemoteSceneLoader.loadScene(sceneName);
        }
      },
    );
  }

  private async loginOnStart() {
    const tt = this.getDouyinApi();
    if (typeof tt?.login === "function") {
      const douyinLogin = await this.tryDouyinLogin(tt);
      if (!douyinLogin) {
        return false;
      }

      const userInfo = this.requestDouyinUserInfo
        ? await this.tryGetDouyinUserInfo(tt)
        : undefined;
      if (this.requestDouyinUserInfo && !userInfo) {
        return false;
      }

      return this.loginWithDouyinCode(douyinLogin, userInfo);
    }

    if (!this.allowDevGuestLogin) {
      warn("LoadingPercentLabel: Douyin login is unavailable and dev guest login is disabled.");
      return false;
    }

    return this.loginAsDevGuest();
  }

  private async tryDouyinLogin(tt: DouyinApi) {
    try {
      const result = await new Promise<DouyinLoginResult>((resolve, reject) => {
        tt.login?.({
          force: this.forceDouyinLogin,
          success: resolve,
          fail: reject,
        });
      });

      if (!result.code) {
        warn("LoadingPercentLabel: Douyin login returned empty code.");
        return null;
      }

      return result;
    } catch (error) {
      warn(`LoadingPercentLabel: Douyin login failed, ${String(error)}.`);
      return null;
    }
  }

  private async tryGetDouyinUserInfo(tt: DouyinApi) {
    if (typeof tt.getUserInfo !== "function") {
      warn("LoadingPercentLabel: Douyin getUserInfo is unavailable.");
      return null;
    }

    try {
      const result = await new Promise<DouyinUserInfoResult>((resolve, reject) => {
        tt.getUserInfo?.({
          withCredentials: true,
          success: resolve,
          fail: reject,
        });
      });

      if (!result.userInfo) {
        warn("LoadingPercentLabel: Douyin getUserInfo returned empty userInfo.");
        return null;
      }

      return result.userInfo;
    } catch (error) {
      warn(`LoadingPercentLabel: Douyin getUserInfo failed, ${String(error)}.`);
      return null;
    }
  }

  private async loginWithDouyinCode(
    loginResult: DouyinLoginResult,
    userInfo?: DouyinUserInfo,
  ) {
    try {
      const requestBody = {
        code: loginResult.code,
        anonymousCode: loginResult.anonymousCode ?? loginResult.anonymous_code ?? "",
        userInfo: this.normalizeDouyinUserInfo(userInfo),
        appId: this.appId,
        clientVersion: this.clientVersion,
      };
      const result = await ApiService.requestJson<GuestLoginResponse>(
        this.loginApiPath,
        {
          method: "POST",
          body: requestBody,
        },
      );
      if (result.code !== 0 || !result.data) {
        warn(`LoadingPercentLabel: Douyin login failed, ${result.message ?? "unknown error"}.`);
        return false;
      }

      this.saveLoginData(result.data);
      return true;
    } catch (error) {
      warn(`LoadingPercentLabel: Douyin login request failed, ${String(error)}.`);
      return false;
    }
  }

  private async loginAsDevGuest() {
    const guestCode = this.getOrCreateGuestCode();

    try {
      const result = await ApiService.requestJson<GuestLoginResponse>(
        this.loginApiPath,
        {
          method: "POST",
          body: {
            code: guestCode,
            devGuest: true,
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
          },
        },
      );
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

  private getDouyinApi() {
    return (globalThis as unknown as { tt?: DouyinApi }).tt;
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

  private normalizeDouyinUserInfo(userInfo?: DouyinUserInfo) {
    if (!userInfo) {
      return undefined;
    }

    return {
      nickName: userInfo.nickName ?? userInfo.nickname ?? userInfo.name ?? "玩家",
      avatarUrl: userInfo.avatarUrl ?? userInfo.avatar ?? "",
      gender: userInfo.gender ?? 0,
      country: userInfo.country ?? "",
      province: userInfo.province ?? "",
      city: userInfo.city ?? "",
      language: userInfo.language ?? "zh_CN",
    };
  }
}
