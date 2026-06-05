import {
  _decorator,
  assetManager,
  Component,
  ImageAsset,
  instantiate,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  Vec3,
  warn,
} from "cc";
import { ApiService } from "../工具/ApiService";

const { ccclass, property } = _decorator;

export type LeaderboardRowData = {
  rank: number;
  userId?: string;
  nickname: string;
  score: number;
  avatarIndex?: number;
  avatarUrl?: string;
  avatar_url?: string;
};

type LeaderboardResponse = {
  code: number;
  message?: string;
  data?: {
    items?: LeaderboardRowData[];
    currentUser?: LeaderboardRowData | null;
  };
};

const RANK_LABEL_KEYS = ["排名", "名次", "rank"];
const NAME_LABEL_KEYS = ["昵称", "名字", "玩家", "name", "nickname"];
const SCORE_LABEL_KEYS = ["分数", "得分", "score"];
const AVATAR_NODE_KEYS = ["头像", "avatar", "head"];

@ccclass("LeaderboardListView")
export class LeaderboardListView extends Component {
  @property({ type: Node, displayName: "4-10名胶囊模板" })
  public rowTemplate: Node | null = null;

  @property({ type: [Node], displayName: "前三名节点" })
  public topRankNodes: Node[] = [];

  @property({ type: Sprite, displayName: "第一名头像" })
  public firstAvatar: Sprite | null = null;

  @property({ type: Label, displayName: "第一名昵称" })
  public firstNicknameLabel: Label | null = null;

  @property({ type: Label, displayName: "第一名分数" })
  public firstScoreLabel: Label | null = null;

  @property({ type: Sprite, displayName: "第二名头像" })
  public secondAvatar: Sprite | null = null;

  @property({ type: Label, displayName: "第二名昵称" })
  public secondNicknameLabel: Label | null = null;

  @property({ type: Label, displayName: "第二名分数" })
  public secondScoreLabel: Label | null = null;

  @property({ type: Sprite, displayName: "第三名头像" })
  public thirdAvatar: Sprite | null = null;

  @property({ type: Label, displayName: "第三名昵称" })
  public thirdNicknameLabel: Label | null = null;

  @property({ type: Label, displayName: "第三名分数" })
  public thirdScoreLabel: Label | null = null;

  @property({ type: Node, displayName: "本人胶囊" })
  public selfRow: Node | null = null;

  @property({ displayName: "后端服务地址" })
  public backendBaseUrl = "http://localhost:8000";

  @property({ displayName: "排行榜接口路径" })
  public leaderboardApiPath = "/api/leaderboard";

  @property({ displayName: "自动加载排行榜" })
  public autoLoadRemoteLeaderboard = true;

  @property({ displayName: "游戏标识" })
  public gameKey = "reverse_brain";

  @property({ displayName: "游戏模式" })
  public gameMode = "classic";

  @property({ displayName: "难度" })
  public difficulty = "normal";

  @property({ displayName: "榜单分组" })
  public seasonKey = "global";

  @property({ displayName: "起始名次" })
  public startRank = 4;

  @property({ displayName: "条目数量" })
  public itemCount = 7;

  @property({ displayName: "垂直间距" })
  public verticalSpacing = 82;

  @property({ displayName: "向下排列" })
  public arrangeDownward = true;

  @property({ displayName: "模板作为第一条" })
  public useTemplateAsFirstRow = true;

  @property({ displayName: "启动时生成" })
  public buildOnStart = true;

  @property({ type: [SpriteFrame], displayName: "默认游客头像" })
  public defaultAvatarFrames: SpriteFrame[] = [];

  private rows: Node[] = [];
  private rowData: LeaderboardRowData[] = [];
  private remoteAvatarFrames = new Map<string, SpriteFrame>();

  start() {
    ApiService.configure({
      localBaseUrl: this.backendBaseUrl,
    });

    if (this.buildOnStart) {
      this.build();
    }

    if (this.autoLoadRemoteLeaderboard) {
      void this.loadRemoteLeaderboard();
    }
  }

  public setRows(rows: LeaderboardRowData[]) {
    this.rowData = rows.map((row) => ({
      rank: Math.max(1, Math.floor(row.rank)),
      userId: row.userId,
      nickname: row.nickname || "游客",
      score: Math.max(0, Math.floor(row.score)),
      avatarUrl: this.normalizeAvatarUrl(row),
      avatarIndex: row.avatarIndex === undefined
        ? this.getRandomAvatarIndex()
        : this.normalizeAvatarIndex(row.avatarIndex),
    }));
    this.build();
  }

  public build() {
    const template = this.rowTemplate;
    if (!template) {
      return;
    }

    this.clearGeneratedRows();

    const count = Math.max(0, Math.floor(this.itemCount));
    if (count <= 0) {
      template.active = false;
      return;
    }

    const direction = this.arrangeDownward ? -1 : 1;
    const originPosition = template.position.clone();
    if (!this.useTemplateAsFirstRow) {
      template.active = false;
    }

    for (let index = 0; index < count; index += 1) {
      const row = index === 0 && this.useTemplateAsFirstRow
        ? template
        : this.createRow(template, index);
      const rank = this.startRank + index;
      const data = this.rowData[index] ?? {
        rank,
        nickname: `玩家${rank}`,
        score: 0,
        avatarIndex: this.getRandomAvatarIndex(),
      };

      row.name = `排行榜-${rank}名胶囊`;
      row.active = true;
      row.setPosition(
        new Vec3(
          originPosition.x,
          originPosition.y + direction * this.verticalSpacing * index,
          originPosition.z,
        ),
      );
      this.fillRow(row, data);
    }
  }

  private async loadRemoteLeaderboard() {
    try {
      const userId = sys.localStorage.getItem("brain_twist_user_id") || "";
      const result = await ApiService.requestJson<LeaderboardResponse>(
        this.leaderboardApiPath,
        {
          method: "GET",
          query: {
            userId,
            gameKey: this.gameKey,
            gameMode: this.gameMode,
            difficulty: this.difficulty,
            seasonKey: this.seasonKey,
            limit: 10,
          },
        },
      );

      if (result.code !== 0 || !result.data?.items) {
        warn(`LeaderboardListView: request failed, ${result.message ?? "unknown error"}.`);
        return;
      }

      this.applyLeaderboard(result.data.items, result.data.currentUser ?? null);
    } catch (error) {
      warn(`LeaderboardListView: request failed, ${String(error)}.`);
    }
  }

  private applyLeaderboard(items: LeaderboardRowData[], currentUser: LeaderboardRowData | null) {
    const sortedItems = items
      .map((item) => this.normalizeRowData(item))
      .sort((a, b) => a.rank - b.rank);

    this.fillTopRows(sortedItems.slice(0, 3));
    this.setRows(sortedItems.filter((item) => item.rank >= this.startRank));

    const selfRow = this.getSelfRow();
    if (currentUser && selfRow) {
      this.fillRow(selfRow, this.normalizeRowData(currentUser));
    }
  }

  private fillTopRows(items: LeaderboardRowData[]) {
    const topNodes = this.getTopRankNodes();
    items.forEach((item) => {
      const viewIndex = item.rank - 1;
      const node = topNodes[viewIndex];
      if (!node || !item) {
        return;
      }

      node.active = true;
      this.fillTopRank(viewIndex, node, item);
    });
  }

  private createRow(template: Node, index: number) {
    const row = instantiate(template);
    row.parent = template.parent ?? this.node;
    row.layer = template.layer;
    row.setSiblingIndex(template.getSiblingIndex() + index);
    this.rows.push(row);
    return row;
  }

  private clearGeneratedRows() {
    for (const row of this.rows) {
      if (row.isValid) {
        row.destroy();
      }
    }

    this.rows = [];
  }

  private fillRow(row: Node, data: LeaderboardRowData) {
    for (const label of row.getComponentsInChildren(Label)) {
      const nodeName = label.node.name.toLowerCase();
      if (this.includesAny(nodeName, RANK_LABEL_KEYS)) {
        label.string = `${data.rank}`;
      } else if (this.includesAny(nodeName, NAME_LABEL_KEYS)) {
        label.string = data.nickname;
      } else if (this.includesAny(nodeName, SCORE_LABEL_KEYS)) {
        label.string = this.formatScore(data.score);
      }
    }

    for (const sprite of row.getComponentsInChildren(Sprite)) {
      const nodeName = sprite.node.name.toLowerCase();
      if (this.includesAny(nodeName, AVATAR_NODE_KEYS)) {
        this.applyAvatarSprite(sprite, data);
      }
    }
  }

  private fillTopRank(index: number, root: Node, data: LeaderboardRowData) {
    const view = this.getTopRankView(index, root);

    if (view.avatar) {
      this.applyAvatarSprite(view.avatar, data);
    }

    if (view.nicknameLabel) {
      view.nicknameLabel.string = data.nickname;
    }

    if (view.scoreLabel) {
      view.scoreLabel.string = this.formatScore(data.score);
    }
  }

  private getTopRankView(index: number, root: Node) {
    const configuredViews = [
      {
        avatar: this.firstAvatar,
        nicknameLabel: this.firstNicknameLabel,
        scoreLabel: this.firstScoreLabel,
      },
      {
        avatar: this.secondAvatar,
        nicknameLabel: this.secondNicknameLabel,
        scoreLabel: this.secondScoreLabel,
      },
      {
        avatar: this.thirdAvatar,
        nicknameLabel: this.thirdNicknameLabel,
        scoreLabel: this.thirdScoreLabel,
      },
    ];

    const configuredView = configuredViews[index];
    return {
      avatar: configuredView?.avatar ?? this.findSpriteByName(root, AVATAR_NODE_KEYS),
      nicknameLabel: configuredView?.nicknameLabel ?? this.findLabelByName(root, NAME_LABEL_KEYS),
      scoreLabel: configuredView?.scoreLabel ?? this.findLabelByName(root, SCORE_LABEL_KEYS),
    };
  }

  private normalizeRowData(row: LeaderboardRowData) {
    return {
      ...row,
      rank: Math.max(1, Math.floor(row.rank)),
      nickname: row.nickname || "游客",
      score: Math.max(0, Math.floor(row.score)),
      avatarUrl: this.normalizeAvatarUrl(row),
      avatarIndex: row.avatarIndex === undefined
        ? this.getRandomAvatarIndex()
        : this.normalizeAvatarIndex(row.avatarIndex),
    };
  }

  private getTopRankNodes() {
    if (this.topRankNodes.length > 0) {
      return this.topRankNodes;
    }

    return [
      this.findNode("第一名"),
      this.findNode("第二名"),
      this.findNode("第三名") ?? this.findNode("第三明"),
    ].filter((node): node is Node => Boolean(node));
  }

  private getSelfRow() {
    return this.selfRow ?? this.findNode("排行榜-本人胶囊");
  }

  private getAvatarFrame(data: LeaderboardRowData) {
    if (this.defaultAvatarFrames.length <= 0) {
      return null;
    }

    const avatarIndex = data.avatarIndex === undefined
      ? this.getRandomAvatarIndex()
      : this.normalizeAvatarIndex(data.avatarIndex);
    return this.defaultAvatarFrames[avatarIndex] ?? this.defaultAvatarFrames[0];
  }

  private normalizeAvatarUrl(row: LeaderboardRowData) {
    return String(row.avatarUrl || row.avatar_url || "").trim();
  }

  private applyAvatarSprite(sprite: Sprite, data: LeaderboardRowData) {
    const fallbackFrame = this.getAvatarFrame(data);
    if (fallbackFrame) {
      sprite.spriteFrame = fallbackFrame;
    }
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const avatarUrl = this.normalizeAvatarUrl(data);
    if (!avatarUrl) {
      return;
    }

    const cachedFrame = this.remoteAvatarFrames.get(avatarUrl);
    if (cachedFrame) {
      sprite.spriteFrame = cachedFrame;
      return;
    }

    assetManager.loadRemote<ImageAsset>(
      avatarUrl,
      { ext: this.getRemoteImageExtension(avatarUrl) },
      (error, imageAsset) => {
        if (error || !imageAsset) {
          if (error) {
            warn(`LeaderboardListView: avatar load failed, ${String(error)}.`);
          }
          return;
        }

        const texture = new Texture2D();
        texture.image = imageAsset;
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = texture;
        this.remoteAvatarFrames.set(avatarUrl, spriteFrame);

        if (sprite.isValid) {
          sprite.spriteFrame = spriteFrame;
          sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
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

  private getRandomAvatarIndex() {
    if (this.defaultAvatarFrames.length <= 0) {
      return 0;
    }

    return Math.floor(Math.random() * this.defaultAvatarFrames.length);
  }

  private normalizeAvatarIndex(value: unknown) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return 0;
    }

    return Math.max(0, Math.floor(numberValue));
  }

  private includesAny(value: string, keys: string[]) {
    return keys.some((key) => value.includes(key.toLowerCase()));
  }

  private formatScore(score: number) {
    return Math.max(0, Math.floor(score))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  private findNode(name: string, root = this.node): Node | null {
    if (root.name === name) {
      return root;
    }

    for (const child of root.children) {
      const found = this.findNode(name, child);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private findLabelByName(root: Node, keys: string[]) {
    for (const label of root.getComponentsInChildren(Label)) {
      const nodeName = label.node.name.toLowerCase();
      if (this.includesAny(nodeName, keys)) {
        return label;
      }
    }

    return null;
  }

  private findSpriteByName(root: Node, keys: string[]) {
    for (const sprite of root.getComponentsInChildren(Sprite)) {
      const nodeName = sprite.node.name.toLowerCase();
      if (this.includesAny(nodeName, keys)) {
        return sprite;
      }
    }

    return null;
  }
}
