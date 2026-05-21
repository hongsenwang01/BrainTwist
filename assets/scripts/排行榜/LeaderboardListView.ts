import {
  _decorator,
  Component,
  instantiate,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;

export type LeaderboardRowData = {
  rank: number;
  nickname: string;
  score: number;
  avatarIndex?: number;
};

const RANK_LABEL_KEYS = ["排名", "名次", "rank"];
const NAME_LABEL_KEYS = ["昵称", "名字", "玩家", "name", "nickname"];
const SCORE_LABEL_KEYS = ["分数", "得分", "score"];
const AVATAR_NODE_KEYS = ["头像", "avatar", "head"];

@ccclass("LeaderboardListView")
export class LeaderboardListView extends Component {
  @property({ type: Node, displayName: "4-10名胶囊模板" })
  public rowTemplate: Node | null = null;

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

  @property({ displayName: "头像宽高" })
  public avatarSize = 42;

  private rows: Node[] = [];
  private rowData: LeaderboardRowData[] = [];

  start() {
    if (this.buildOnStart) {
      this.build();
    }
  }

  public setRows(rows: LeaderboardRowData[]) {
    this.rowData = rows.map((row) => ({
      rank: Math.max(1, Math.floor(row.rank)),
      nickname: row.nickname || "游客",
      score: Math.max(0, Math.floor(row.score)),
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
        label.string = `${data.score}`;
      }
    }

    const avatarFrame = this.getAvatarFrame(data);
    if (!avatarFrame) {
      return;
    }

    for (const sprite of row.getComponentsInChildren(Sprite)) {
      const nodeName = sprite.node.name.toLowerCase();
      if (this.includesAny(nodeName, AVATAR_NODE_KEYS)) {
        sprite.spriteFrame = avatarFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.resizeAvatar(sprite.node);
      }
    }
  }

  private resizeAvatar(node: Node) {
    const size = Math.max(1, this.avatarSize);
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(size, size);
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
}
