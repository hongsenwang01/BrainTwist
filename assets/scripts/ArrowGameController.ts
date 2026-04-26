import {
  _decorator,
  AudioClip,
  AudioSource,
  Component,
  director,
  Label,
  Node,
  warn,
} from "cc";
import {
  ArrowDirection,
  getOppositeArrowDirection,
  RandomArrowDisplay,
} from "./RandomArrowDisplay";
import { ComboShakeEffect } from "./ComboShakeEffect";
import { GameTimerLabel } from "./GameTimerLabel";
import { LifeDisplay } from "./LifeDisplay";
import { PauseOverlay } from "./PauseOverlay";

const { ccclass, property } = _decorator;

@ccclass("ArrowGameController")
export class ArrowGameController extends Component {
  @property({ type: RandomArrowDisplay, displayName: "箭头显示组件" })
  public arrowDisplay: RandomArrowDisplay | null = null;

  @property({ type: Label, displayName: "连击数字文本" })
  public comboLabel: Label | null = null;

  @property({ type: Label, displayName: "分数文本" })
  public scoreLabel: Label | null = null;

  @property({ type: ComboShakeEffect, displayName: "连击震动效果" })
  public comboShakeEffect: ComboShakeEffect | null = null;

  @property({ type: LifeDisplay, displayName: "生命显示组件" })
  public lifeDisplay: LifeDisplay | null = null;

  @property({ type: GameTimerLabel, displayName: "计时器组件" })
  public gameTimer: GameTimerLabel | null = null;

  @property({ type: PauseOverlay, displayName: "暂停弹窗" })
  public pauseOverlay: PauseOverlay | null = null;

  @property({ type: AudioClip, displayName: "错误点击音效" })
  public wrongClickSound: AudioClip | null = null;

  @property({ type: AudioClip, displayName: "正确点击音效" })
  public correctClickSound: AudioClip | null = null;

  @property({ displayName: "错误音效音量" })
  public wrongClickVolume = 1;

  @property({ displayName: "正确音效音量" })
  public correctClickVolume = 1;

  @property({ displayName: "自动查找箭头组件" })
  public autoFindArrowDisplay = true;

  @property({ displayName: "点对后刷新箭头" })
  public refreshOnCorrectClick = true;

  @property({ displayName: "开始时暂停" })
  public startPaused = false;

  @property({ displayName: "首页场景名" })
  public homeSceneName = "游戏首页";

  private comboCount = 0;
  private score = 0;
  private isPaused = false;
  private audioSource: AudioSource | null = null;

  onLoad() {
    this.isPaused = this.startPaused;
    this.audioSource = this.getOrCreateAudioSource();
    this.setupArrowDisplay();
    this.updateComboLabel();
    this.updateScoreLabel();
  }

  start() {
    this.setupArrowDisplay();
    this.updateComboLabel();
    this.updateScoreLabel();
  }

  public clickUp() {
    this.handleDirectionClick(ArrowDirection.Up);
  }

  public clickDown() {
    this.handleDirectionClick(ArrowDirection.Down);
  }

  public clickLeft() {
    this.handleDirectionClick(ArrowDirection.Left);
  }

  public clickRight() {
    this.handleDirectionClick(ArrowDirection.Right);
  }

  public pauseGame() {
    this.isPaused = true;
    this.gameTimer?.pauseTimer();
    this.pauseOverlay?.show();
  }

  public resumeGame() {
    this.isPaused = false;
    this.gameTimer?.startTimer();
    this.pauseOverlay?.hide();
  }

  public togglePause() {
    if (this.isPaused) {
      this.resumeGame();
      return;
    }

    this.pauseGame();
  }

  public restartGame() {
    this.comboCount = 0;
    this.score = 0;
    this.updateComboLabel();
    this.updateScoreLabel();
    this.lifeDisplay?.resetLives();
    this.arrowDisplay?.showRandomArrow(false, false);
    this.resumeGame();
    this.gameTimer?.restartTimer();
  }

  public backToHome() {
    if (!this.homeSceneName) {
      warn("ArrowGameController: homeSceneName is empty.");
      return;
    }

    director.loadScene(this.homeSceneName);
  }

  public handleDirectionClick(clickedDirection: ArrowDirection) {
    if (this.isPaused) {
      return;
    }

    this.setupArrowDisplay();

    if (!this.arrowDisplay) {
      warn("ArrowGameController: arrowDisplay is missing.");
      return;
    }

    const currentDirection = this.arrowDisplay.getCurrentDirection();
    const correctDirection = getOppositeArrowDirection(currentDirection);

    if (clickedDirection === correctDirection) {
      this.handleCorrectClick();
      return;
    }

    this.handleWrongClick(clickedDirection, correctDirection);
  }

  private handleCorrectClick() {
    this.comboCount += 1;
    this.score += this.getScoreIncrement(this.comboCount);
    this.updateComboLabel();
    this.updateScoreLabel();
    this.comboShakeEffect?.play();
    this.playCorrectClickSound();

    if (this.refreshOnCorrectClick) {
      this.arrowDisplay?.showRandomArrow(true);
    }
  }

  private handleWrongClick(
    clickedDirection: ArrowDirection,
    correctDirection: ArrowDirection,
  ) {
    this.comboCount = 0;
    this.updateComboLabel();
    this.lifeDisplay?.loseLife();
    this.playWrongClickSound();

    warn(
      `ArrowGameController: wrong direction ${ArrowDirection[clickedDirection]}, expected ${ArrowDirection[correctDirection]}.`,
    );
  }

  private updateComboLabel() {
    if (this.comboLabel) {
      this.comboLabel.string = `${this.comboCount}`;
    }
  }

  private updateScoreLabel() {
    if (this.scoreLabel) {
      this.scoreLabel.string = this.formatScore(this.score);
    }
  }

  private getScoreIncrement(comboCount: number) {
    if (comboCount >= 50) {
      return 5;
    }

    if (comboCount >= 20) {
      return 3;
    }

    if (comboCount >= 10) {
      return 2;
    }

    return 1;
  }

  private formatScore(score: number) {
    return Math.max(0, Math.floor(score))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  private setupArrowDisplay() {
    if (this.arrowDisplay || !this.autoFindArrowDisplay) {
      return;
    }

    this.arrowDisplay = this.findArrowDisplayInChildren(this.node);
  }

  private findArrowDisplayInChildren(node: Node): RandomArrowDisplay | null {
    const arrowDisplay = node.getComponent(RandomArrowDisplay);
    if (arrowDisplay) {
      return arrowDisplay;
    }

    for (const child of node.children) {
      const childArrowDisplay = this.findArrowDisplayInChildren(child);
      if (childArrowDisplay) {
        return childArrowDisplay;
      }
    }

    return null;
  }

  private playWrongClickSound() {
    this.playOneShot(this.wrongClickSound, this.wrongClickVolume);
  }

  private playCorrectClickSound() {
    this.playOneShot(this.correctClickSound, this.correctClickVolume);
  }

  private playOneShot(clip: AudioClip | null, volume: number) {
    if (!clip) {
      return;
    }

    this.getOrCreateAudioSource().playOneShot(clip, volume);
  }

  private getOrCreateAudioSource() {
    let audioSource = this.node.getComponent(AudioSource);
    if (!audioSource) {
      audioSource = this.node.addComponent(AudioSource);
    }
    return audioSource;
  }
}
