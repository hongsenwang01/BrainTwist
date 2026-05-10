import {
  _decorator,
  Component,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  UIOpacity,
  Vec3,
} from "cc";

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

  @property({ displayName: "扣血时播放掉落动效" })
  public playLoseLifeEffect = true;

  @property({ displayName: "扣血掉落距离" })
  public loseFallDistance = 45;

  @property({ displayName: "扣血动效时间" })
  public loseEffectDuration = 0.28;

  @property({ displayName: "扣血缩小倍率" })
  public loseShrinkScale = 0.35;

  private currentLives = 3;
  private originalScales: Vec3[] = [];
  private originalPositions: Vec3[] = [];

  onLoad() {
    this.recordOriginalScales();
    this.resetLives();

    if (this.playIntroOnLoad) {
      this.playIntro();
    }
  }

  public resetLives(lives = this.maxLives) {
    this.currentLives = this.clampLives(lives);
    this.resetHeartTransforms();
    this.refresh();
  }

  public loseLife(amount = 1) {
    const previousLives = this.currentLives;
    this.currentLives = this.clampLives(this.currentLives - amount);

    if (this.playLoseLifeEffect && previousLives > this.currentLives) {
      this.refresh(this.currentLives);
      this.playLoseHeartEffect(previousLives - 1);
    } else {
      this.refresh();
    }

    return this.currentLives;
  }

  public restoreLife(amount = 1) {
    const previousLives = this.currentLives;
    this.currentLives = this.clampLives(this.currentLives + amount);
    this.resetHeartTransforms();
    this.refresh();

    if (this.currentLives > previousLives) {
      this.playRestoreHeartEffect(this.currentLives - 1);
    }

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

  private refresh(skipIndex = -1) {
    for (let index = 0; index < this.heartSprites.length; index += 1) {
      const sprite = this.heartSprites[index];
      if (!sprite) {
        continue;
      }

      if (index === skipIndex) {
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
    this.originalPositions = this.heartSprites.map((sprite) => {
      const position = sprite?.node.position ?? Vec3.ZERO;
      return new Vec3(position.x, position.y, position.z);
    });
  }

  private playLoseHeartEffect(index: number) {
    const sprite = this.heartSprites[index];
    if (!sprite) {
      return;
    }

    const node = sprite.node;
    const opacity = this.getOrCreateOpacity(node);
    const originalPosition = this.originalPositions[index] ?? node.position.clone();
    const originalScale = this.originalScales[index] ?? node.scale.clone();
    const fallPosition = new Vec3(
      originalPosition.x,
      originalPosition.y - this.loseFallDistance,
      originalPosition.z,
    );
    const shrinkScale = new Vec3(
      originalScale.x * this.loseShrinkScale,
      originalScale.y * this.loseShrinkScale,
      originalScale.z,
    );

    tween(node).stop();
    tween(opacity).stop();

    sprite.spriteFrame = this.fullHeart;
    node.setPosition(originalPosition);
    node.setScale(originalScale);
    opacity.opacity = 255;

    tween(opacity).to(this.loseEffectDuration, { opacity: 0 }).start();

    tween(node)
      .to(this.loseEffectDuration, {
        position: fallPosition,
        scale: shrinkScale,
      })
      .call(() => {
        sprite.spriteFrame = this.emptyHeart;
        node.setPosition(originalPosition);
        node.setScale(originalScale);
        opacity.opacity = 255;
      })
      .start();
  }

  private playRestoreHeartEffect(index: number) {
    const sprite = this.heartSprites[index];
    if (!sprite) {
      return;
    }

    const node = sprite.node;
    const opacity = this.getOrCreateOpacity(node);
    const originalScale = this.originalScales[index] ?? node.scale.clone();
    const popScale = new Vec3(
      originalScale.x * this.popScale,
      originalScale.y * this.popScale,
      originalScale.z,
    );

    tween(node).stop();
    tween(opacity).stop();

    sprite.spriteFrame = this.fullHeart;
    node.setScale(
      originalScale.x * this.loseShrinkScale,
      originalScale.y * this.loseShrinkScale,
      originalScale.z,
    );
    opacity.opacity = 0;

    tween(opacity).to(this.popInDuration, { opacity: 255 }).start();

    tween(node)
      .to(this.popInDuration, { scale: popScale }, { easing: "backOut" })
      .to(this.settleDuration, { scale: originalScale }, { easing: "sineOut" })
      .call(() => {
        node.setScale(originalScale);
        opacity.opacity = 255;
      })
      .start();
  }

  private resetHeartTransforms() {
    this.recordOriginalScales();

    for (let index = 0; index < this.heartSprites.length; index += 1) {
      const sprite = this.heartSprites[index];
      if (!sprite) {
        continue;
      }

      const node = sprite.node;
      const opacity = this.getOrCreateOpacity(node);
      tween(node).stop();
      tween(opacity).stop();
      node.setPosition(this.originalPositions[index] ?? node.position);
      node.setScale(this.originalScales[index] ?? node.scale);
      opacity.opacity = 255;
    }
  }

  private getOrCreateOpacity(node: Node) {
    let opacity = node.getComponent(UIOpacity);
    if (!opacity) {
      opacity = node.addComponent(UIOpacity);
    }
    return opacity;
  }
}
