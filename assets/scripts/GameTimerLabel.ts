import { _decorator, Component, Label } from "cc";

const { ccclass, property } = _decorator;

@ccclass("GameTimerLabel")
export class GameTimerLabel extends Component {
  @property({ type: Label, displayName: "目标文本" })
  public targetLabel: Label | null = null;

  @property({ displayName: "自动开始计时" })
  public autoStart = true;

  @property({ displayName: "倒计时秒数" })
  public startSeconds = 120;

  @property({ displayName: "倒计时模式" })
  public countdownMode = true;

  @property({ displayName: "最少显示位数" })
  public minDigits = 1;

  private elapsedSeconds = 0;
  private isRunning = false;
  private lastDisplaySeconds = -1;
  private onCompleteCallback: (() => void) | null = null;

  onLoad() {
    this.targetLabel = this.targetLabel ?? this.node.getComponent(Label);
    this.resetTimer(this.startSeconds);
  }

  start() {
    if (this.autoStart) {
      this.startTimer();
    }
  }

  update(deltaTime: number) {
    if (!this.isRunning) {
      return;
    }

    this.elapsedSeconds += deltaTime;
    this.refreshLabel();

    if (this.countdownMode && this.getRemainingSeconds() <= 0) {
      this.isRunning = false;
      this.onCompleteCallback?.();
    }
  }

  public startTimer() {
    this.isRunning = true;
  }

  public pauseTimer() {
    this.isRunning = false;
  }

  public resetTimer(seconds = this.startSeconds) {
    if (this.countdownMode) {
      this.startSeconds = this.normalizeCountdownSeconds(seconds);
      this.elapsedSeconds = 0;
    } else {
      this.elapsedSeconds = Math.max(0, seconds);
    }

    this.lastDisplaySeconds = -1;
    this.refreshLabel();
  }

  public restartTimer(seconds = this.startSeconds) {
    this.resetTimer(seconds);
    this.startTimer();
  }

  public getElapsedSeconds() {
    return Math.floor(this.elapsedSeconds);
  }

  public getRemainingSeconds() {
    return Math.max(0, Math.ceil(this.startSeconds - this.elapsedSeconds));
  }

  public setCompleteCallback(callback: (() => void) | null) {
    this.onCompleteCallback = callback;
  }

  private refreshLabel() {
    const displaySeconds = this.countdownMode
      ? this.getRemainingSeconds()
      : Math.floor(this.elapsedSeconds);
    if (displaySeconds === this.lastDisplaySeconds) {
      return;
    }

    this.lastDisplaySeconds = displaySeconds;

    if (this.targetLabel) {
      this.targetLabel.string = displaySeconds
        .toString()
        .padStart(Math.max(1, this.minDigits), "0");
    }
  }

  private normalizeCountdownSeconds(seconds: number) {
    return seconds > 0 ? seconds : 120;
  }
}
