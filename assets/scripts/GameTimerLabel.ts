import { _decorator, Component, Label } from "cc";

const { ccclass, property } = _decorator;

@ccclass("GameTimerLabel")
export class GameTimerLabel extends Component {
  @property({ type: Label, displayName: "目标文本" })
  public targetLabel: Label | null = null;

  @property({ displayName: "自动开始计时" })
  public autoStart = true;

  @property({ displayName: "起始秒数" })
  public startSeconds = 0;

  @property({ displayName: "最少显示位数" })
  public minDigits = 1;

  private elapsedSeconds = 0;
  private isRunning = false;
  private lastDisplaySeconds = -1;

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
  }

  public startTimer() {
    this.isRunning = true;
  }

  public pauseTimer() {
    this.isRunning = false;
  }

  public resetTimer(seconds = this.startSeconds) {
    this.elapsedSeconds = Math.max(0, seconds);
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

  private refreshLabel() {
    const displaySeconds = Math.floor(this.elapsedSeconds);
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
}
