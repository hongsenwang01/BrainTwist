import {
  _decorator,
  assetManager,
  Component,
  ImageAsset,
  Label,
  Mask,
  Node,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  UITransform,
  warn,
} from "cc";
import { ApiService } from "../工具/ApiService";

const { ccclass, property } = _decorator;
const AVATAR_SIZE = 80;
const ROUNDED_AVATAR_NODE_NAME = "圆形头像图片";

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
  public fetchProfileOnStart = false;

  @property({ displayName: "先显示本地用户缓存" })
  public useCachedProfileFirst = true;

  @property({ displayName: "用户资料接口路径" })
  public userProfileApiPath = "/api/auth/profile";

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
    this.ensureRoundedAvatarMask();

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
    const userId = sys.localStorage.getItem(this.userIdStorageKey);

    if (!userId) {
      this.setLoginStatus(this.loginFailedText);
      this.applyGuestProfile();
      return;
    }

    try {
      const result = await ApiService.requestJson<UserProfileResponse>(
        this.userProfileApiPath,
        {
          method: "GET",
          query: { userId },
        },
      );
      if (result.code !== 0 || !result.data) {
        warn(`HomeUserProfile: profile request failed, ${result.message ?? "unknown error"}.`);
        this.setLoginStatus(this.loginFailedText);
        return;
      }

      const profile = this.normalizeProfile({
        ...this.readCachedProfile(),
        ...result.data,
      });
      this.saveProfileCache(profile);
      this.applyProfile(profile);
      this.setLoginStatus(this.loginSuccessText);
    } catch (error) {
      warn(`HomeUserProfile: profile request failed, ${String(error)}.`);
      this.setLoginStatus(this.loginFailedText);
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
    this.fitAvatarSprite();
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
        this.fitAvatarSprite();
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

  private normalizeProfile(profile: UserProfileData): UserProfile {
    return {
      userId: profile.userId,
      nickname: profile.nickname ?? profile.nickName,
      avatarUrl: profile.avatarUrl ?? profile.avatar ?? profile.avatar_url,
      isGuest: profile.isGuest,
    };
  }

  private ensureRoundedAvatarMask() {
    if (!this.avatarSprite) {
      return;
    }

    const hostNode = this.avatarSprite.node;
    const originalSprite = this.avatarSprite;
    const hostTransform = hostNode.getComponent(UITransform);
    if (hostTransform) {
      hostTransform.setContentSize(AVATAR_SIZE, AVATAR_SIZE);
    }

    const mask = hostNode.getComponent(Mask) ?? hostNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_ELLIPSE;
    mask.segments = 48;

    let avatarNode = hostNode.getChildByName(ROUNDED_AVATAR_NODE_NAME);
    if (!avatarNode) {
      avatarNode = new Node(ROUNDED_AVATAR_NODE_NAME);
      avatarNode.layer = hostNode.layer;
      hostNode.addChild(avatarNode);
      avatarNode.setPosition(0, 0, 0);
    }

    const avatarTransform = avatarNode.getComponent(UITransform) ?? avatarNode.addComponent(UITransform);
    avatarTransform.setContentSize(AVATAR_SIZE, AVATAR_SIZE);

    const roundedSprite = avatarNode.getComponent(Sprite) ?? avatarNode.addComponent(Sprite);
    roundedSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    roundedSprite.spriteFrame = originalSprite.spriteFrame;

    originalSprite.enabled = false;
    this.avatarSprite = roundedSprite;
    this.fitAvatarSprite();
  }

  private fitAvatarSprite() {
    if (!this.avatarSprite) {
      return;
    }

    this.avatarSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const transform = this.avatarSprite.node.getComponent(UITransform);
    transform?.setContentSize(AVATAR_SIZE, AVATAR_SIZE);
  }
}
