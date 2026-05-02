import {
  _decorator,
  Button,
  Component,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  director,
  instantiate,
  resources,
  sys,
  warn,
} from "cc";

const { ccclass, property } = _decorator;

type AchievementCategory = "all" | "growth" | "challenge" | "reaction" | "collect" | "hidden";
type RewardKind = "coin" | "gem";

type AchievementItem = {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  icon: string;
  rewardKind: RewardKind;
  rewardAmount: number;
  current: number;
  target: number;
  progressText: string;
  unlocked: boolean;
  showProgress: boolean;
};

type AchievementApiItem = Partial<AchievementItem> & {
  achievementId?: string;
  rewardType?: RewardKind;
};

type AchievementListResponse = {
  code: number;
  message?: string;
  data?: AchievementApiItem[] | {
    achievements?: AchievementApiItem[];
    items?: AchievementApiItem[];
  };
};

type AchievementCache = {
  userId: string;
  gameKey: string;
  gameMode: string;
  savedAt: number;
  achievements: AchievementItem[];
};

type RowTemplate = {
  baseY: number;
  mode: "flat" | "group";
  nodes: Partial<Record<RowPart, Node>>;
};

type RowPart =
  | "row"
  | "icon"
  | "title"
  | "description"
  | "progressTrack"
  | "progressFill"
  | "progressText"
  | "reward"
  | "rewardAmount"
  | "status";

const DEFAULT_ACHIEVEMENTS: AchievementItem[] = [
  {
    id: "tutorial",
    category: "growth",
    title: "初来乍到",
    description: "完成新手教程",
    icon: "face-pink-wink",
    rewardKind: "coin",
    rewardAmount: 10,
    current: 1,
    target: 1,
    progressText: "1/1",
    unlocked: true,
    showProgress: false,
  },
];

const ACHIEVEMENT_CACHE_KEY = "brain_twist_achievement_cache_v1";
const ACHIEVEMENT_CACHE_DIRTY_KEY = "brain_twist_achievement_cache_dirty";
const ROW_TOP_Y = 134;
const ROW_GAP = 125;
const TEMPLATE_NAMES = ["初来乍到", "一击即中", "百发百中", "连击达人", "反向大师", "无情大脑"];
const CATEGORY_NODE_NAMES: Record<AchievementCategory, string> = {
  all: "分类-全部",
  growth: "分类-成长",
  challenge: "分类-挑战",
  reaction: "分类-反应",
  collect: "分类-收集",
  hidden: "分类-隐藏",
};
const PART_PREFIX: Record<RowPart, string> = {
  row: "成就条",
  icon: "图标",
  title: "标题",
  description: "描述",
  progressTrack: "进度槽",
  progressFill: "进度填充",
  progressText: "进度文本",
  reward: "奖励",
  rewardAmount: "奖励数量",
  status: "状态",
};

@ccclass("AchievementSceneView")
export class AchievementSceneView extends Component {
  @property({ displayName: "自动加载后端成就" })
  public autoLoadRemoteAchievements = true;

  @property({ displayName: "后端服务地址" })
  public backendBaseUrl = "http://localhost:3000";

  @property({ displayName: "成就列表接口路径" })
  public achievementListApiPath = "/api/achievements";

  @property({ displayName: "游戏标识" })
  public gameKey = "reverse_brain";

  @property({ displayName: "游戏模式" })
  public gameMode = "classic";

  @property({ displayName: "请求失败显示默认列表" })
  public useDefaultWhenRequestFailed = true;

  @property({ displayName: "使用本地成就缓存" })
  public useLocalCache = true;

  @property({ displayName: "缓存有效期秒" })
  public cacheTtlSeconds = 300;

  private frames = new Map<string, SpriteFrame>();
  private achievements: AchievementItem[] = [...DEFAULT_ACHIEVEMENTS];
  private activeCategory: AchievementCategory = "all";
  private rowTemplate: RowTemplate | null = null;
  private renderedNodes: Node[] = [];
  private originalTotalFillWidth = 0;

  start() {
    this.prepareSceneTemplates();
    this.bindTabs();
    this.bindBackButton();

    resources.loadDir("textures/achievements", SpriteFrame, (error, frames) => {
      if (error) {
        warn(`AchievementSceneView: load achievement textures failed, ${error.message}`);
      }

      for (const frame of frames ?? []) {
        this.frames.set(frame.name, frame);
      }

      this.loadCachedAchievements();
      this.render();

      if (this.shouldLoadRemoteAchievements()) {
        void this.loadRemoteAchievements();
      }
    });
  }

  private prepareSceneTemplates() {
    this.rowTemplate =
      this.createGroupTemplate("成就条模板") ??
      this.createFlatTemplate("一击即中") ??
      this.createFlatTemplate("初来乍到");

    const totalFill = this.findNode("总进度填充");
    this.originalTotalFillWidth = totalFill?.getComponent(UITransform)?.width ?? 0;

    this.findNode("成就条模板")?.setSiblingIndex(0);
    const commonTemplate = this.findNode("成就条模板");
    if (commonTemplate) {
      commonTemplate.active = false;
    }

    for (const name of TEMPLATE_NAMES) {
      for (const part of Object.keys(PART_PREFIX) as RowPart[]) {
        const node = this.findNode(`${PART_PREFIX[part]}-${name}`);
        if (node) {
          node.active = false;
        }
      }
    }
  }

  private createGroupTemplate(name: string): RowTemplate | null {
    const row = this.findNode(name);
    if (!row) {
      return null;
    }

    const nodes: Partial<Record<RowPart, Node>> = {
      row,
    };

    for (const part of Object.keys(PART_PREFIX) as RowPart[]) {
      if (part === "row") {
        continue;
      }

      const node = this.findNode(PART_PREFIX[part], row);
      if (node) {
        nodes[part] = node;
      }
    }

    return {
      baseY: row.position.y,
      mode: "group",
      nodes,
    };
  }

  private createFlatTemplate(name: string): RowTemplate | null {
    const row = this.findNode(`成就条-${name}`);
    if (!row) {
      return null;
    }

    const nodes: Partial<Record<RowPart, Node>> = {};
    for (const part of Object.keys(PART_PREFIX) as RowPart[]) {
      const node = this.findNode(`${PART_PREFIX[part]}-${name}`);
      if (node) {
        nodes[part] = node;
      }
    }

    return {
      baseY: row.position.y,
      mode: "flat",
      nodes,
    };
  }

  private bindTabs() {
    for (const category of Object.keys(CATEGORY_NODE_NAMES) as AchievementCategory[]) {
      const node = this.findNode(CATEGORY_NODE_NAMES[category]);
      if (!node) {
        continue;
      }

      const button = node.getComponent(Button) ?? node.addComponent(Button);
      node.off(Button.EventType.CLICK);
      node.on(Button.EventType.CLICK, () => this.selectCategory(category), this);
      button.transition = Button.Transition.NONE;
    }
  }

  private bindBackButton() {
    const node = this.findNode("返回按钮");
    if (!node) {
      return;
    }

    const button = node.getComponent(Button) ?? node.addComponent(Button);
    node.off(Button.EventType.CLICK);
    node.on(Button.EventType.CLICK, () => director.loadScene("游戏首页"), this);
    button.transition = Button.Transition.NONE;
  }

  private selectCategory(category: AchievementCategory) {
    this.activeCategory = category;
    this.render();
  }

  private render() {
    this.clearRenderedRows();
    this.updateTabSelectedState();
    this.updateProgressSummary();

    const items = this.achievements.filter(
      (item) => this.activeCategory === "all" || item.category === this.activeCategory,
    );

    items.forEach((item, index) => this.renderRow(item, index));
  }

  private renderRow(item: AchievementItem, index: number) {
    const template = this.rowTemplate;
    if (!template) {
      warn("AchievementSceneView: achievement row template is missing.");
      return;
    }

    const targetY = ROW_TOP_Y - index * ROW_GAP;
    const deltaY = targetY - template.baseY;
    const rowNodes: Partial<Record<RowPart, Node>> = {};

    if (template.mode === "group") {
      const source = template.nodes.row;
      if (!source) {
        return;
      }

      const row = instantiate(source);
      row.name = `成就条-${item.id}`;
      row.parent = this.node;
      row.active = true;
      row.setPosition(new Vec3(source.position.x, targetY, source.position.z));
      rowNodes.row = row;
      this.renderedNodes.push(row);

      for (const part of Object.keys(PART_PREFIX) as RowPart[]) {
        if (part === "row") {
          continue;
        }

        const node = this.findNode(PART_PREFIX[part], row);
        if (node) {
          rowNodes[part] = node;
        }
      }
    } else {
      for (const part of Object.keys(template.nodes) as RowPart[]) {
        const source = template.nodes[part];
        if (!source) {
          continue;
        }

        const node = instantiate(source);
        node.name = `${PART_PREFIX[part]}-${item.id}`;
        node.parent = this.node;
        node.active = true;
        node.setPosition(new Vec3(source.position.x, source.position.y + deltaY, source.position.z));
        rowNodes[part] = node;
        this.renderedNodes.push(node);
      }
    }

    this.setLabel(rowNodes.title, item.title);
    this.setLabel(rowNodes.description, item.description);
    this.setLabel(rowNodes.rewardAmount, `+${item.rewardAmount}`);
    this.setSprite(rowNodes.icon, item.icon);
    this.setSprite(rowNodes.reward, item.rewardKind === "gem" ? "reward-gem" : "reward-coin");
    this.setSprite(rowNodes.status, item.unlocked ? "status-check" : "status-lock");

    const showProgress = item.showProgress && rowNodes.progressTrack && rowNodes.progressFill;
    rowNodes.progressTrack && (rowNodes.progressTrack.active = Boolean(showProgress));
    rowNodes.progressFill && (rowNodes.progressFill.active = Boolean(showProgress));
    rowNodes.progressText && (rowNodes.progressText.active = Boolean(showProgress));

    if (showProgress) {
      this.setLabel(rowNodes.progressText, item.progressText);
      this.setFillWidth(rowNodes.progressTrack, rowNodes.progressFill, item.target > 0 ? item.current / item.target : 0);
    }
  }

  private clearRenderedRows() {
    for (const node of this.renderedNodes) {
      if (node.isValid) {
        node.destroy();
      }
    }
    this.renderedNodes = [];
  }

  private updateTabSelectedState() {
    const selected = this.findNode("分类选中");
    const activeNode = this.findNode(CATEGORY_NODE_NAMES[this.activeCategory]);
    if (selected && activeNode) {
      selected.setPosition(new Vec3(activeNode.position.x, selected.position.y, selected.position.z));
    }
  }

  private updateProgressSummary() {
    const total = Math.max(1, this.achievements.length);
    const unlocked = this.achievements.filter((item) => item.unlocked).length;
    const progress = unlocked / total;

    this.setLabel(this.findNode("已完成数量"), `${unlocked}`);
    this.setLabel(this.findNode("总数量"), `/${total}`);
    this.setLabel(this.findNode("总进度百分比"), `${Math.round(progress * 100)}%`);
    this.setFillWidth(this.findNode("总进度槽"), this.findNode("总进度填充"), progress, this.originalTotalFillWidth);
  }

  private setLabel(node: Node | null | undefined, text: string) {
    const label = node?.getComponent(Label);
    if (label) {
      label.string = text;
    }
  }

  private setSprite(node: Node | null | undefined, frameName: string) {
    const sprite = node?.getComponent(Sprite);
    const frame = this.frames.get(frameName);
    if (sprite && frame) {
      sprite.spriteFrame = frame;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }
  }

  private setFillWidth(
    trackNode: Node | null | undefined,
    fillNode: Node | null | undefined,
    progress: number,
    fallbackFullWidth = 0,
  ) {
    const trackTransform = trackNode?.getComponent(UITransform);
    const fillTransform = fillNode?.getComponent(UITransform);
    if (!trackNode || !fillNode || !trackTransform || !fillTransform) {
      return;
    }

    const safeProgress = Math.max(0, Math.min(1, progress));
    const fullWidth = trackTransform.width || fallbackFullWidth || fillTransform.width;
    const width = Math.max(1, fullWidth * safeProgress);
    fillTransform.setContentSize(width, fillTransform.height);
    fillNode.setPosition(
      new Vec3(
        trackNode.position.x - fullWidth * 0.5 + width * 0.5,
        fillNode.position.y,
        fillNode.position.z,
      ),
    );
  }

  private loadCachedAchievements() {
    if (!this.useLocalCache) {
      return false;
    }

    const userId = sys.localStorage.getItem("brain_twist_user_id");
    const cache = this.readCache();
    if (!userId || !this.isCacheForCurrentContext(cache, userId)) {
      return false;
    }

    this.achievements = cache.achievements.map((item) => this.normalizeAchievement(item));
    return true;
  }

  private shouldLoadRemoteAchievements() {
    if (!this.autoLoadRemoteAchievements) {
      return false;
    }

    const userId = sys.localStorage.getItem("brain_twist_user_id");
    if (!userId) {
      return false;
    }

    if (!this.useLocalCache) {
      return true;
    }

    const cache = this.readCache();
    if (!this.isCacheForCurrentContext(cache, userId)) {
      return true;
    }

    if (sys.localStorage.getItem(ACHIEVEMENT_CACHE_DIRTY_KEY) === "1") {
      return true;
    }

    const ttlMs = Math.max(0, this.cacheTtlSeconds) * 1000;
    return ttlMs > 0 && Date.now() - cache.savedAt >= ttlMs;
  }

  private readCache(): AchievementCache | null {
    try {
      const rawCache = sys.localStorage.getItem(ACHIEVEMENT_CACHE_KEY);
      if (!rawCache) {
        return null;
      }

      const cache = JSON.parse(rawCache) as AchievementCache;
      if (!Array.isArray(cache.achievements)) {
        return null;
      }

      return cache;
    } catch (error) {
      warn(`AchievementSceneView: read achievement cache failed, ${String(error)}.`);
      return null;
    }
  }

  private isCacheForCurrentContext(cache: AchievementCache | null, userId: string) {
    return Boolean(
      cache &&
        cache.userId === userId &&
        cache.gameKey === this.gameKey &&
        cache.gameMode === this.gameMode,
    );
  }

  private saveCache(achievements: AchievementItem[]) {
    if (!this.useLocalCache) {
      return;
    }

    const userId = sys.localStorage.getItem("brain_twist_user_id");
    if (!userId) {
      return;
    }

    const cache: AchievementCache = {
      userId,
      gameKey: this.gameKey,
      gameMode: this.gameMode,
      savedAt: Date.now(),
      achievements,
    };

    sys.localStorage.setItem(ACHIEVEMENT_CACHE_KEY, JSON.stringify(cache));
    sys.localStorage.removeItem(ACHIEVEMENT_CACHE_DIRTY_KEY);
  }

  private async loadRemoteAchievements() {
    const userId = sys.localStorage.getItem("brain_twist_user_id");
    if (!userId) {
      warn("AchievementSceneView: userId is missing, use local default achievements.");
      this.handleLoadFailure();
      return;
    }

    try {
      const response = await fetch(this.createAchievementListUrl(userId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        warn(`AchievementSceneView: achievement list request failed, status ${response.status}.`);
        this.handleLoadFailure();
        return;
      }

      const result = (await response.json()) as AchievementListResponse;
      if (result.code !== 0 || !result.data) {
        warn(`AchievementSceneView: achievement list request failed, ${result.message ?? "unknown error"}.`);
        this.handleLoadFailure();
        return;
      }

      const remoteItems = this.extractResponseItems(result);
      if (remoteItems.length <= 0) {
        return;
      }

      this.achievements = remoteItems.map((item) => this.normalizeAchievement(item));
      this.saveCache(this.achievements);
      this.render();
    } catch (error) {
      warn(`AchievementSceneView: achievement list request failed, ${String(error)}.`);
      this.handleLoadFailure();
    }
  }

  private handleLoadFailure() {
    if (!this.useDefaultWhenRequestFailed) {
      this.achievements = [];
      this.render();
    }
  }

  private extractResponseItems(result: AchievementListResponse) {
    if (Array.isArray(result.data)) {
      return result.data;
    }

    return result.data.achievements ?? result.data.items ?? [];
  }

  private normalizeAchievement(item: AchievementApiItem): AchievementItem {
    const current = this.toNumber(item.current, 0);
    const target = Math.max(1, this.toNumber(item.target, 1));
    const unlocked = Boolean(item.unlocked);
    const rewardKind = item.rewardKind ?? item.rewardType;

    return {
      id: item.id ?? item.achievementId ?? `achievement-${Date.now()}`,
      category: this.normalizeCategory(item.category),
      title: item.title ?? "未命名成就",
      description: item.description ?? "",
      icon: item.icon ?? "face-pink-wink",
      rewardKind: rewardKind === "gem" ? "gem" : "coin",
      rewardAmount: Math.max(0, this.toNumber(item.rewardAmount, 0)),
      current,
      target,
      progressText: item.progressText ?? `${current}/${target}`,
      unlocked,
      showProgress: item.showProgress ?? !unlocked,
    };
  }

  private normalizeCategory(category: AchievementApiItem["category"]): AchievementCategory {
    switch (category) {
      case "growth":
      case "challenge":
      case "reaction":
      case "collect":
      case "hidden":
      case "all":
        return category;
      default:
        return "growth";
    }
  }

  private toNumber(value: unknown, fallback: number) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  private createAchievementListUrl(userId: string) {
    const baseUrl = this.backendBaseUrl.replace(/\/+$/, "");
    const path = this.achievementListApiPath.startsWith("/")
      ? this.achievementListApiPath
      : `/${this.achievementListApiPath}`;
    const query = [
      `userId=${encodeURIComponent(userId)}`,
      `gameKey=${encodeURIComponent(this.gameKey)}`,
      `gameMode=${encodeURIComponent(this.gameMode)}`,
    ].join("&");
    return `${baseUrl}${path}?${query}`;
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
}
