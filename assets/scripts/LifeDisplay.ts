import { _decorator, Component, Sprite, SpriteFrame, tween, Vec3 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("LifeDisplay")
export class LifeDisplay extends Component {
  @property({ type: [Sprite], displayName: "心形图标列表" })
  public heartSprites: Sprite[] = [];

  @property({ type: SpriteFrame, displayName: "红色心形图" })
  public fullHeart: SpriteFrame | null = null;

  @property({ type: SpriteFrame, displayName: "灰色占位心形图" })
  public emptyHeart: SpriteFrame | null = null;

  @property({ displayName: "最大生命数" })
  public maxLives = 3;

  @property({ displayName: "加载时播放出场动效" })
  public playIntroOnLoad = true;

  @property({ displayName: "心形出现间隔" })
  public introDelay = 0.12;

  @property({ displayName: "弹出放大倍率" })
  public popScale = 1.25;

  @property({ displayName: "弹出时间" })
  public popInDuration = 0.12;

  @property({ displayName: "回弹时间" })
  public settleDuration = 0.1;

  private currentLives = 3;
  private originalScales: Vec3[] = [];

  onLoad() {
    this.recordOriginalScales();
    this.resetLives();

    if (this.playIntroOnLoad) {
      this.playIntro();
    }
  }

  public resetLives(lives = this.maxLives) {
    this.currentLives = this.clampLives(lives);
    this.refresh();
  }

  public loseLife(amount = 1) {
    this.currentLives = this.clampLives(this.currentLives - amount);
    this.refresh();
    return this.currentLives;
  }

  public getCurrentLives() {
    return this.currentLives;
  }

  public playIntro() {
    this.recordOriginalScales();

    for (let index = 0; index < this.heartSprites.length; index += 1) {
      const sprite = this.heartSprites[index];
      if (!sprite) {
        continue;
      }

      const node = sprite.node;
      const originalScale = this.originalScales[index] ?? Vec3.ONE;
      const popScale = new Vec3(
        originalScale.x * this.popScale,
        originalScale.y * this.popScale,
        originalScale.z,
      );

      tween(node).stop();
      node.setScale(0, 0, originalScale.z);

      tween(node)
        .delay(index * this.introDelay)
        .to(this.popInDuration, { scale: popScale })
        .to(this.settleDuration, { scale: originalScale })
        .start();
    }
  }

  private refresh() {
    for (let index = 0; index < this.heartSprites.length; index += 1) {
      const sprite = this.heartSprites[index];
      if (!sprite) {
        continue;
      }

      sprite.spriteFrame = index < this.currentLives ? this.fullHeart : this.emptyHeart;
    }
  }

  private clampLives(lives: number) {
    return Math.max(0, Math.min(this.maxLives, Math.floor(lives)));
  }

  private recordOriginalScales() {
    this.originalScales = this.heartSprites.map((sprite) => {
      const scale = sprite?.node.scale ?? Vec3.ONE;
      return new Vec3(scale.x || 1, scale.y || 1, scale.z || 1);
    });
  }
}
