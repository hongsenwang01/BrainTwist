import { _decorator, Component, Label, tween, Vec3 } from "cc";
import { TextLetterSpacing } from "../工具/TextLetterSpacing";

const { ccclass, property } = _decorator;

@ccclass("ScoreCountUpLabel")
export class ScoreCountUpLabel extends Component {
  @property({ type: Label, displayName: "目标文本" })
  public targetLabel: Label | null = null;

  @property({ displayName: "进入场景自动播放" })
  public autoPlayOnStart = false;

  @property({ displayName: "自动读取当前文本为目标" })
  public autoReadCurrentText = true;

  @property({ displayName: "起始数值" })
  public startValue = 0;

  @property({ displayName: "开始延迟" })
  public startDelay = 0;

  @property({ displayName: "增长时长" })
  public duration = 0.9;

  @property({ displayName: "刷新间隔" })
  public tickInterval = 0.025;

  @property({ displayName: "使用千分位逗号" })
  public useThousandsSeparator = true;

  @property({ displayName: "前缀" })
  public prefix = "";

  @property({ displayName: "后缀" })
  public suffix = "";

  @property({ displayName: "相同分数时轻弹" })
  public popWhenSameValue = true;

  @property({ displayName: "结束时弹一下" })
  public popOnComplete = true;

  @property({ displayName: "弹出缩放" })
  public popScale = 1.08;

  private originScale = new Vec3();
  private elapsed = 0;
  private nextTickAt = 0;
  private fromValue = 0;
  private toValue = 0;
  private isPlaying = false;
  private delayedPlayCallback: (() => void) | null = null;

  onLoad() {
    this.targetLabel = this.targetLabel ?? this.node.getComponent(Label);
    this.originScale.set(this.node.scale);
  }

  start() {
    if (!this.autoPlayOnStart) {
      return;
    }

    const targetText = this.autoReadCurrentText
      ? this.targetLabel?.string ?? `${this.startValue}`
      : `${this.startValue}`;
    this.playToText(targetText);
  }

  update(deltaTime: number) {
    if (!this.isPlaying) {
      return;
    }

    this.elapsed += deltaTime;
    const duration = Math.max(0.01, this.duration);
    const progress = Math.min(this.elapsed / duration, 1);

    if (this.elapsed >= this.nextTickAt || progress >= 1) {
      this.nextTickAt = this.elapsed + Math.max(0.01, this.tickInterval);
      this.setScore(this.interpolateScore(progress));
    }

    if (progress >= 1) {
      this.finish();
    }
  }

  public playToText(text: string) {
    this.playToScore(this.parseScore(text));
  }

  public playToScore(score: number) {
    this.stop(false);
    this.originScale.set(this.node.scale);

    this.fromValue = Math.max(0, Math.floor(this.startValue));
    this.toValue = Math.max(0, Math.floor(score));
    this.setScore(this.fromValue);

    if (this.fromValue === this.toValue) {
      this.playSameValue();
      return;
    }

    if (this.startDelay > 0) {
      this.delayedPlayCallback = () => this.startCounting();
      this.scheduleOnce(this.delayedPlayCallback, this.startDelay);
      return;
    }

    this.startCounting();
  }

  public stop(restore = true) {
    if (this.delayedPlayCallback) {
      this.unschedule(this.delayedPlayCallback);
      this.delayedPlayCallback = null;
    }

    this.isPlaying = false;
    tween(this.node).stop();

    if (restore) {
      this.node.setScale(this.originScale);
    }
  }

  private startCounting() {
    this.delayedPlayCallback = null;
    this.elapsed = 0;
    this.nextTickAt = 0;
    this.isPlaying = true;
  }

  private finish() {
    this.isPlaying = false;
    this.setScore(this.toValue);

    if (this.popOnComplete) {
      this.playPop();
    }
  }

  private playSameValue() {
    const play = () => {
      this.setScore(this.toValue);

      if (this.popWhenSameValue) {
        this.playPop();
      }
    };

    if (this.startDelay > 0) {
      this.delayedPlayCallback = play;
      this.scheduleOnce(this.delayedPlayCallback, this.startDelay);
      return;
    }

    play();
  }

  private interpolateScore(progress: number) {
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    return Math.floor(
      this.fromValue + (this.toValue - this.fromValue) * easedProgress,
    );
  }

  private setScore(score: number) {
    if (this.targetLabel) {
      this.targetLabel.string = this.formatScore(score);
    }

    this.node.getComponent(TextLetterSpacing)?.refresh();
  }

  private formatScore(score: number) {
    const safeScore = Math.max(0, Math.floor(score));
    const text = this.useThousandsSeparator
      ? safeScore.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
      : `${safeScore}`;
    return `${this.prefix}${text}${this.suffix}`;
  }

  private parseScore(text: string) {
    const match = `${text ?? ""}`.match(/[0-9,]+/);
    if (!match) {
      return 0;
    }

    return Number(match[0].replace(/,/g, "")) || 0;
  }

  private playPop() {
    const peakScale = new Vec3(
      this.originScale.x * this.popScale,
      this.originScale.y * this.popScale,
      this.originScale.z,
    );

    tween(this.node)
      .to(0.08, { scale: peakScale }, { easing: "sineOut" })
      .to(0.12, { scale: this.originScale }, { easing: "sineInOut" })
      .start();
  }
}
