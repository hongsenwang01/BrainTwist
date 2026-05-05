import {
  _decorator,
  assetManager,
  Component,
  ImageAsset,
  Label,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  warn,
} from "cc";

const { ccclass, property } = _decorator;

type UserProfile = {
  userId?: string;
  nickname?: string;
  avatarUrl?: string;
  isGuest?: boolean;
};

type UserProfileData = UserProfile & {
  nickName?: string;
  avatar?: string;
  avatar_url?: string;
};

type UserProfileResponse = {
  code: number;
  message?: string;
  data?: UserProfileData;
};

type GuestLoginResponse = {
  code: number;
  message?: string;
  data?: UserProfile & {
    loginCount?: number;
  };
};

@ccclass("HomeUserProfile")
export class HomeUserProfile extends Component {
  @property({ type: Sprite, displayName: "头像图片" })
  public avatarSprite: Sprite | null = null;

  @property({ type: Label, displayName: "昵称文本" })
  public nicknameLabel: Label | null = null;

  @property({ type: Label, displayName: "登录状态文本" })
  public loginStatusLabel: Label | null = null;

  @property({ type: [SpriteFrame], displayName: "游客头像列表" })
  public guestAvatarFrames: SpriteFrame[] = [];

  @property({ displayName: "进入首页获取用户资料" })
  public fetchProfileOnStart = true;

  @property({ displayName: "缺少登录时游客登录" })
  public guestLoginWhenMissing = true;

  @property({ displayName: "游客进入首页刷新登录" })
  public refreshGuestLoginOnStart = true;

  @property({ displayName: "先显示本地用户缓存" })
  public useCachedProfileFirst = true;

  @property({ displayName: "后端服务地址" })
  public backendBaseUrl = "http://localhost:3000";

  @property({ displayName: "用户资料接口路径" })
  public userProfileApiPath = "/api/auth/profile";

  @property({ displayName: "游客登录接口路径" })
  public loginApiPath = "/api/auth/douyin-login";

  @property({ displayName: "抖音AppId" })
  public appId = "";

  @property({ displayName: "客户端版本" })
  public clientVersion = "dev";

  @property({ displayName: "用户ID缓存Key" })
  public userIdStorageKey = "brain_twist_user_id";

  @property({ displayName: "用户资料缓存Key" })
  public userInfoStorageKey = "brain_twist_user_info";

  @property({ displayName: "游客默认昵称" })
  public guestNickname = "游客";

  @property({ displayName: "登录中文案" })
  public loginPendingText = "登录中...";

  @property({ displayName: "登录成功文案" })
  public loginSuccessText = "登录成功";

  @property({ displayName: "登录失败文案" })
  public loginFailedText = "登录失败";

  private currentAvatarUrl = "";

  start() {
    this.avatarSprite = this.avatarSprite ?? this.node.getComponentInChildren(Sprite);
    this.nicknameLabel = this.nicknameLabel ?? this.node.getComponentInChildren(Label);

    if (this.useCachedProfileFirst) {
      this.applyProfile(this.readCachedProfile());
    } else {
      this.applyGuestProfile();
    }

    if (this.fetchProfileOnStart) {
      void this.fetchProfile();
    }
  }

  public refreshProfile() {
    void this.fetchProfile();
  }

  private async fetchProfile() {
    let userId = sys.localStorage.getItem(this.userIdStorageKey);
    const cachedProfile = this.readCachedProfile();
    const shouldLoginAsGuest =
      (!userId && this.guestLoginWhenMissing) ||
      (this.refreshGuestLoginOnStart &&
        (cachedProfile?.isGuest === true || (!cachedProfile && this.hasGuestCode())));

    if (shouldLoginAsGuest) {
      this.setLoginStatus(this.loginPendingText);
      const loginProfile = await this.loginAsGuest();
      if (loginProfile?.userId) {
        userId = loginProfile.userId;
        this.applyProfile(loginProfile);
        this.setLoginStatus(this.loginSuccessText);
      } else {
        this.setLoginStatus(this.loginFailedText);
        if (!userId) {
          this.applyGuestProfile();
          return;
        }
      }
    }

    if (!userId) {
      this.setLoginStatus(this.loginFailedText);
      this.applyGuestProfile();
      return;
    }

    try {
      const response = await fetch(this.createProfileUrl(userId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        warn(`HomeUserProfile: profile request failed, status ${response.status}.`);
        if (!shouldLoginAsGuest) {
          this.setLoginStatus(this.loginFailedText);
        }
        return;
      }

      const result = (await response.json()) as UserProfileResponse;
      if (result.code !== 0 || !result.data) {
        warn(`HomeUserProfile: profile request failed, ${result.message ?? "unknown error"}.`);
        if (!shouldLoginAsGuest) {
          this.setLoginStatus(this.loginFailedText);
        }
        return;
      }

      const profile = this.normalizeProfile({
        ...this.readCachedProfile(),
        ...result.data,
      });
      this.saveProfileCache(profile);
      this.applyProfile(profile);
      if (!shouldLoginAsGuest) {
        this.setLoginStatus(this.loginSuccessText);
      }
    } catch (error) {
      warn(`HomeUserProfile: profile request failed, ${String(error)}.`);
      if (!shouldLoginAsGuest) {
        this.setLoginStatus(this.loginFailedText);
      }
    }
  }

  private async loginAsGuest() {
    try {
      const response = await fetch(this.createLoginUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: this.getOrCreateGuestCode(),
          userInfo: {
            nickName: this.guestNickname,
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
        warn(`HomeUserProfile: guest login failed, status ${response.status}.`);
        return null;
      }

      const result = (await response.json()) as GuestLoginResponse;
      if (result.code !== 0 || !result.data) {
        warn(`HomeUserProfile: guest login failed, ${result.message ?? "unknown error"}.`);
        return null;
      }

      const profile = this.normalizeProfile(result.data);
      this.saveProfileCache(profile);
      return profile;
    } catch (error) {
      warn(`HomeUserProfile: guest login failed, ${String(error)}.`);
      return null;
    }
  }

  private applyProfile(profile: UserProfile | null) {
    if (!profile || profile.isGuest || !profile.avatarUrl) {
      this.applyGuestProfile(profile?.nickname);
      return;
    }

    this.setNickname(profile.nickname || this.guestNickname);
    this.loadRemoteAvatar(profile.avatarUrl);
  }

  private applyGuestProfile(nickname = this.guestNickname) {
    this.setNickname(nickname || this.guestNickname);
    this.setRandomGuestAvatar();
  }

  private setNickname(nickname: string) {
    if (this.nicknameLabel) {
      this.nicknameLabel.string = nickname;
    }
  }

  private setLoginStatus(status: string) {
    if (this.loginStatusLabel) {
      this.loginStatusLabel.string = status;
    }
  }

  private setRandomGuestAvatar() {
    if (!this.avatarSprite || this.guestAvatarFrames.length === 0) {
      return;
    }

    const index = Math.floor(Math.random() * this.guestAvatarFrames.length);
    this.avatarSprite.spriteFrame = this.guestAvatarFrames[index];
  }

  private loadRemoteAvatar(avatarUrl: string) {
    if (!this.avatarSprite) {
      return;
    }

    this.currentAvatarUrl = avatarUrl;
    assetManager.loadRemote<ImageAsset>(
      avatarUrl,
      { ext: this.getRemoteImageExtension(avatarUrl) },
      (error, imageAsset) => {
        if (error || !imageAsset || this.currentAvatarUrl !== avatarUrl) {
          if (error) {
            warn(`HomeUserProfile: avatar load failed, ${String(error)}.`);
            this.setRandomGuestAvatar();
          }
          return;
        }

        const texture = new Texture2D();
        texture.image = imageAsset;
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;
        this.avatarSprite!.spriteFrame = spriteFrame;
      },
    );
  }

  private getRemoteImageExtension(url: string) {
    const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
    if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) {
      return ".jpg";
    }

    if (cleanUrl.endsWith(".webp")) {
      return ".webp";
    }

    return ".png";
  }

  private readCachedProfile(): UserProfile | null {
    try {
      const rawProfile = sys.localStorage.getItem(this.userInfoStorageKey);
      if (!rawProfile) {
        return null;
      }

      return this.normalizeProfile(JSON.parse(rawProfile) as UserProfileData);
    } catch (error) {
      warn(`HomeUserProfile: read profile cache failed, ${String(error)}.`);
      return null;
    }
  }

  private saveProfileCache(profile: UserProfile) {
    sys.localStorage.setItem(this.userInfoStorageKey, JSON.stringify(profile));

    if (profile.userId) {
      sys.localStorage.setItem(this.userIdStorageKey, profile.userId);
    }
  }

  private createProfileUrl(userId: string) {
    const baseUrl = this.backendBaseUrl.replace(/\/+$/, "");
    const path = this.userProfileApiPath.startsWith("/")
      ? this.userProfileApiPath
      : `/${this.userProfileApiPath}`;
    return `${baseUrl}${path}?userId=${encodeURIComponent(userId)}`;
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

  private hasGuestCode() {
    return Boolean(sys.localStorage.getItem("brain_twist_guest_code"));
  }

  private createClientId() {
    const randomPart = Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${randomPart}`;
  }

  private normalizeProfile(profile: UserProfileData): UserProfile {
    return {
      userId: profile.userId,
      nickname: profile.nickname ?? profile.nickName,
      avatarUrl: profile.avatarUrl ?? profile.avatar ?? profile.avatar_url,
      isGuest: profile.isGuest,
    };
  }
}
