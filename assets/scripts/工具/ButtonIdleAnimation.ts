import { _decorator, Component, Enum, tween, Vec3 } from "cc";

const { ccclass, property } = _decorator;

export enum ButtonIdleAnimationMode {
  Breath = 0,
  Float = 1,
  Pop = 2,
  Wiggle = 3,
}

Enum(ButtonIdleAnimationMode);

@ccclass("ButtonIdleAnimation")
export class ButtonIdleAnimation extends Component {
  @property({ type: Enum(ButtonIdleAnimationMode), displayName: "动画类型" })
  public mode = ButtonIdleAnimationMode.Breath;

  @property({ displayName: "进入场景自动播放" })
  public autoPlayOnStart = true;

  @property({ displayName: "开始延迟" })
  public startDelay = 0;

  @property({ displayName: "动画时长" })
  public duration = 0.9;

  @property({ displayName: "是否循环" })
  public loop = true;

  @property({ displayName: "循环间隔" })
  public loopInterval = 0.15;

  @property({ displayName: "缩放倍率" })
  public scaleMultiplier = 1.06;

  @property({ displayName: "弹出初始缩放" })
  public popStartScale = 0.82;

  @property({ displayName: "浮动距离" })
  public floatDistance = 10;

  @property({ displayName: "摇摆角度" })
  public wiggleAngle = 4;

  @property({ displayName: "停止时还原" })
  public restoreOnStop = true;

  private originPosition = new Vec3();
  private originScale = new Vec3();
  private originEuler = new Vec3();
  private angleState = { value: 0 };
  private delayedPlayCallback: (() => void) | null = null;

  onLoad() {
    this.recordOrigin();
  }

  start() {
    if (this.autoPlayOnStart) {
      this.play();
    }
  }

  onDisable() {
    this.stop(false);
  }

  public play() {
    this.stop(false);
    this.recordOrigin();

    if (this.startDelay > 0) {
      this.delayedPlayCallback = () => this.startAnimation();
      this.scheduleOnce(this.delayedPlayCallback, this.startDelay);
      return;
    }

    this.startAnimation();
  }

  public stop(restore = this.restoreOnStop) {
    if (this.delayedPlayCallback) {
      this.unschedule(this.delayedPlayCallback);
      this.delayedPlayCallback = null;
    }

    tween(this.node).stop();
    tween(this.angleState).stop();

    if (restore) {
      this.restoreOrigin();
    }
  }

  private startAnimation() {
    this.delayedPlayCallback = null;

    switch (this.mode) {
      case ButtonIdleAnimationMode.Float:
        this.playFloat();
        return;
      case ButtonIdleAnimationMode.Pop:
        this.playPop();
        return;
      case ButtonIdleAnimationMode.Wiggle:
        this.playWiggle();
        return;
      case ButtonIdleAnimationMode.Breath:
      default:
        this.playBreath();
    }
  }

  private playBreath() {
    const halfDuration = this.getHalfDuration();
    const targetScale = this.createScaledVec(this.originScale, this.scaleMultiplier);

    const sequence = tween()
      .to(halfDuration, { scale: targetScale }, { easing: "sineInOut" })
      .to(halfDuration, { scale: this.originScale }, { easing: "sineInOut" })
      .delay(this.loopInterval);

    if (this.loop) {
      tween(this.node).repeatForever(sequence).start();
      return;
    }

    tween(this.node)
      .to(halfDuration, { scale: targetScale }, { easing: "sineInOut" })
      .to(halfDuration, { scale: this.originScale }, { easing: "sineInOut" })
      .start();
  }

  private playFloat() {
    const halfDuration = this.getHalfDuration();
    const floatPosition = new Vec3(
      this.originPosition.x,
      this.originPosition.y + this.floatDistance,
      this.originPosition.z,
    );

    const sequence = tween()
      .to(halfDuration, { position: floatPosition }, { easing: "sineInOut" })
      .to(halfDuration, { position: this.originPosition }, { easing: "sineInOut" })
      .delay(this.loopInterval);

    if (this.loop) {
      tween(this.node).repeatForever(sequence).start();
      return;
    }

    tween(this.node)
      .to(halfDuration, { position: floatPosition }, { easing: "sineInOut" })
      .to(halfDuration, { position: this.originPosition }, { easing: "sineInOut" })
      .start();
  }

  private playPop() {
    const firstDuration = Math.max(0.01, this.duration * 0.55);
    const secondDuration = Math.max(0.01, this.duration * 0.45);
    const startScale = this.createScaledVec(this.originScale, this.popStartScale);
    const peakScale = this.createScaledVec(this.originScale, this.scaleMultiplier);

    const sequence = tween()
      .call(() => this.node.setScale(startScale))
      .to(firstDuration, { scale: peakScale }, { easing: "backOut" })
      .to(secondDuration, { scale: this.originScale }, { easing: "sineOut" })
      .delay(this.loopInterval);

    if (this.loop) {
      tween(this.node).repeatForever(sequence).start();
      return;
    }

    this.node.setScale(startScale);
    tween(this.node)
      .to(firstDuration, { scale: peakScale }, { easing: "backOut" })
      .to(secondDuration, { scale: this.originScale }, { easing: "sineOut" })
      .start();
  }

  private playWiggle() {
    const stepDuration = Math.max(0.01, this.duration / 4);
    this.angleState.value = this.originEuler.z;

    const sequence = tween()
      .to(
        stepDuration,
        { value: this.originEuler.z + this.wiggleAngle },
        { easing: "sineInOut", onUpdate: () => this.applyAngle() },
      )
      .to(
        stepDuration * 2,
        { value: this.originEuler.z - this.wiggleAngle },
        { easing: "sineInOut", onUpdate: () => this.applyAngle() },
      )
      .to(
        stepDuration,
        { value: this.originEuler.z },
        { easing: "sineInOut", onUpdate: () => this.applyAngle() },
      )
      .delay(this.loopInterval);

    if (this.loop) {
      tween(this.angleState).repeatForever(sequence).start();
      return;
    }

    tween(this.angleState)
      .to(
        stepDuration,
        { value: this.originEuler.z + this.wiggleAngle },
        { easing: "sineInOut", onUpdate: () => this.applyAngle() },
      )
      .to(
        stepDuration * 2,
        { value: this.originEuler.z - this.wiggleAngle },
        { easing: "sineInOut", onUpdate: () => this.applyAngle() },
      )
      .to(
        stepDuration,
        { value: this.originEuler.z },
        { easing: "sineInOut", onUpdate: () => this.applyAngle() },
      )
      .start();
  }

  private recordOrigin() {
    this.originPosition.set(this.node.position);
    this.originScale.set(this.node.scale);
    this.originEuler.set(this.node.eulerAngles);
    this.angleState.value = this.originEuler.z;
  }

  private restoreOrigin() {
    this.node.setPosition(this.originPosition);
    this.node.setScale(this.originScale);
    this.node.setRotationFromEuler(
      this.originEuler.x,
      this.originEuler.y,
      this.originEuler.z,
    );
    this.angleState.value = this.originEuler.z;
  }

  private applyAngle() {
    this.node.setRotationFromEuler(
      this.originEuler.x,
      this.originEuler.y,
      this.angleState.value,
    );
  }

  private createScaledVec(scale: Vec3, multiplier: number) {
    return new Vec3(scale.x * multiplier, scale.y * multiplier, scale.z);
  }

  private getHalfDuration() {
    return Math.max(0.01, this.duration * 0.5);
  }
}
