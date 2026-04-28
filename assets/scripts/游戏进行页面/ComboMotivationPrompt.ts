import {
  _decorator,
  Component,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("ComboMotivationPromptItem")
export class ComboMotivationPromptItem {
  @property({ displayName: "触发连击数" })
  public comboCount = 5;

  @property({ type: SpriteFrame, displayName: "提示图片" })
  public spriteFrame: SpriteFrame | null = null;

  @property({ displayName: "宽度" })
  public width = 260;

  @property({ displayName: "高度" })
  public height = 90;
}

@ccclass("ComboMotivationPrompt")
export class ComboMotivationPrompt extends Component {
  @property({ type: [ComboMotivationPromptItem], displayName: "提示配置列表" })
  public promptItems: ComboMotivationPromptItem[] = [];

  @property({ type: Node, displayName: "显示父节点" })
  public displayParent: Node | null = null;

  @property({ displayName: "起始偏移X" })
  public startOffsetX = 0;

  @property({ displayName: "起始偏移Y" })
  public startOffsetY = 0;

  @property({ displayName: "上升距离" })
  public riseDistance = 70;

  @property({ displayName: "淡入时间" })
  public fadeInDuration = 0.16;

  @property({ displayName: "停留时间" })
  public stayDuration = 0.45;

  @property({ displayName: "淡出上升时间" })
  public fadeOutDuration = 0.36;

  @property({ displayName: "起始缩放" })
  public startScale = 0.85;

  @property({ displayName: "出现缩放" })
  public showScale = 1.08;

  @property({ displayName: "停留缩放" })
  public settleScale = 1;

  @property({ displayName: "消失缩放" })
  public endScale = 1.08;

  @property({ displayName: "每个提示本局只触发一次" })
  public triggerOncePerGame = true;

  @property({ displayName: "连续触发时排队播放" })
  public queuePrompts = true;

  @property({ displayName: "队列间隔" })
  public queueInterval = 0.08;

  private triggeredKeys = new Set<string>();
  private pendingItems: ComboMotivationPromptItem[] = [];
  private isPlayingQueue = false;

  public playForCombo(comboCount: number) {
    const items = this.getItemsForCombo(comboCount);
    if (items.length === 0) {
      return;
    }

    if (!this.queuePrompts) {
      items.forEach((item) => this.playItem(item));
      return;
    }

    this.pendingItems.push(...items);
    this.playNextQueuedItem();
  }

  public resetTriggers() {
    this.triggeredKeys.clear();
    this.pendingItems = [];
    this.isPlayingQueue = false;
  }

  private getItemsForCombo(comboCount: number) {
    const sortedItems = this.promptItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.spriteFrame && item.comboCount > 0)
      .sort((a, b) => a.comboCount - b.comboCount);
    const result: ComboMotivationPromptItem[] = [];

    for (const { item, index } of sortedItems) {
      if (comboCount < item.comboCount) {
        continue;
      }

      const triggerKey = `${item.comboCount}:${index}`;
      if (this.triggerOncePerGame && this.triggeredKeys.has(triggerKey)) {
        continue;
      }

      this.triggeredKeys.add(triggerKey);
      result.push(item);
    }

    return result;
  }

  private playNextQueuedItem() {
    if (this.isPlayingQueue) {
      return;
    }

    const item = this.pendingItems.shift();
    if (!item) {
      return;
    }

    this.isPlayingQueue = true;
    this.playItem(item, () => {
      this.scheduleOnce(() => {
        this.isPlayingQueue = false;
        this.playNextQueuedItem();
      }, this.queueInterval);
    });
  }

  private playItem(item: ComboMotivationPromptItem, onComplete?: () => void) {
    if (!item.spriteFrame) {
      onComplete?.();
      return;
    }

    const promptNode = this.createPromptNode(item);
    const opacity = promptNode.getComponent(UIOpacity)!;
    const startPosition = new Vec3(this.startOffsetX, this.startOffsetY, 0);
    const endPosition = new Vec3(
      this.startOffsetX,
      this.startOffsetY + this.riseDistance,
      0,
    );

    promptNode.setPosition(startPosition);
    promptNode.setScale(this.startScale, this.startScale, 1);
    opacity.opacity = 0;

    tween(opacity)
      .to(this.fadeInDuration, { opacity: 255 })
      .delay(this.stayDuration)
      .to(this.fadeOutDuration, { opacity: 0 })
      .start();

    tween(promptNode)
      .to(
        this.fadeInDuration,
        { scale: new Vec3(this.showScale, this.showScale, 1) },
        { easing: "backOut" },
      )
      .to(
        0.08,
        { scale: new Vec3(this.settleScale, this.settleScale, 1) },
        { easing: "sineOut" },
      )
      .delay(this.stayDuration)
      .to(
        this.fadeOutDuration,
        {
          position: endPosition,
          scale: new Vec3(this.endScale, this.endScale, 1),
        },
        { easing: "sineIn" },
      )
      .call(() => {
        promptNode.destroy();
        onComplete?.();
      })
      .start();
  }

  private createPromptNode(item: ComboMotivationPromptItem) {
    const promptNode = new Node("连击激励提示");
    promptNode.parent = this.displayParent ?? this.node;

    const transform = promptNode.addComponent(UITransform);
    const sprite = promptNode.addComponent(Sprite);
    sprite.spriteFrame = item.spriteFrame;
    sprite.type = Sprite.Type.SIMPLE;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    transform.setContentSize(Math.max(1, item.width), Math.max(1, item.height));

    promptNode.addComponent(UIOpacity);
    return promptNode;
  }
}
