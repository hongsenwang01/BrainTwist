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
import { ComboMotivationPrompt } from "./ComboMotivationPrompt";
import { GameTimerLabel } from "./GameTimerLabel";
import { LifeDisplay } from "./LifeDisplay";
import { PauseOverlay } from "./PauseOverlay";
import { BottomGlowParticleEmitter } from "./BottomGlowParticleEmitter";
import { GameResultStore } from "../工具/GameResultStore";

const { ccclass, property } = _decorator;

enum ArrowClickRule {
  Normal = 0,
  Reverse = 1,
}

@ccclass("ArrowGameController")
export class ArrowGameController extends Component {
  @property({ type: RandomArrowDisplay, displayName: "箭头显示组件" })
  public arrowDisplay: RandomArrowDisplay | null = null;

  @property({ type: Label, displayName: "连击数字文本" })
  public comboLabel: Label | null = null;

  @property({ type: Label, displayName: "分数文本" })
  public scoreLabel: Label | null = null;

  @property({ type: Label, displayName: "属性提示文本" })
  public ruleLabel: Label | null = null;

  @property({ displayName: "正常提示文字" })
  public normalRuleText = "正常";

  @property({ displayName: "异常提示文字" })
  public reverseRuleText = "异常";

  @property({ type: ComboShakeEffect, displayName: "连击震动效果" })
  public comboShakeEffect: ComboShakeEffect | null = null;

  @property({ type: ComboMotivationPrompt, displayName: "连击激励提示" })
  public comboMotivationPrompt: ComboMotivationPrompt | null = null;

  @property({ type: BottomGlowParticleEmitter, displayName: "底部发光粒子" })
  public bottomGlowParticleEmitter: BottomGlowParticleEmitter | null = null;

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

  @property({ displayName: "游戏总结场景名" })
  public gameSummarySceneName = "游戏总结";

  @property({ displayName: "结束后切到总结页" })
  public loadSummarySceneOnEnd = true;

  private comboCount = 0;
  private score = 0;
  private isPaused = false;
  private isGameEnded = false;
  private audioSource: AudioSource | null = null;
  private currentRule = ArrowClickRule.Reverse;
  private correctCount = 0;
  private totalClickCount = 0;
  private wrongCount = 0;
  private maxCombo = 0;
  private fastestReaction = Number.POSITIVE_INFINITY;
  private questionStartedAt = 0;

  onLoad() {
    this.isPaused = this.startPaused;
    this.audioSource = this.getOrCreateAudioSource();
    this.setupArrowDisplay();
    this.updateComboLabel();
    this.updateScoreLabel();
    this.refreshRule();
    this.questionStartedAt = Date.now();
  }

  start() {
    this.setupArrowDisplay();
    this.updateComboLabel();
    this.updateScoreLabel();
    this.updateRuleLabel();
    this.gameTimer?.setCompleteCallback(() => this.endGame());
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
    this.scheduleOnce(() => this.pauseOverlay?.show(), 0);
  }

  public resumeGame() {
    this.isPaused = false;
    this.gameTimer?.startTimer();
    this.pauseOverlay?.hide();
  }

  public togglePause() {
    if (this.pauseOverlay?.isShowing()) {
      this.resumeGame();
      return;
    }

    this.pauseGame();
  }

  public restartGame() {
    this.isGameEnded = false;
    this.comboCount = 0;
    this.score = 0;
    this.correctCount = 0;
    this.totalClickCount = 0;
    this.wrongCount = 0;
    this.maxCombo = 0;
    this.fastestReaction = Number.POSITIVE_INFINITY;
    this.isGameEnded = false;
    this.updateComboLabel();
    this.updateScoreLabel();
    this.lifeDisplay?.resetLives();
    this.comboMotivationPrompt?.resetTriggers();
    this.refreshQuestion(false);
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
    if (this.isPaused || this.isGameEnded) {
      return;
    }

    this.totalClickCount += 1;
    this.setupArrowDisplay();

    if (!this.arrowDisplay) {
      warn("ArrowGameController: arrowDisplay is missing.");
      return;
    }

    const currentDirection = this.arrowDisplay.getCurrentDirection();
    const correctDirection = this.getCorrectDirection(currentDirection);

    if (clickedDirection === correctDirection) {
      this.handleCorrectClick();
      return;
    }

    this.handleWrongClick(clickedDirection, correctDirection);
  }

  public endGame() {
    if (this.isGameEnded) {
      return;
    }

    this.isGameEnded = true;
    this.isPaused = true;
    this.gameTimer?.pauseTimer();
    this.saveGameResult();

    if (this.loadSummarySceneOnEnd) {
      this.loadGameSummaryScene();
    }
  }

  private handleCorrectClick() {
    this.comboCount += 1;
    this.correctCount += 1;
    this.maxCombo = Math.max(this.maxCombo, this.comboCount);
    this.updateFastestReaction();
    this.score += this.getScoreIncrement(this.comboCount);
    this.updateComboLabel();
    this.updateScoreLabel();
    this.comboShakeEffect?.play();
    this.comboMotivationPrompt?.playForCombo(this.comboCount);
    this.bottomGlowParticleEmitter?.playBurst(
      Math.min(1.8, 0.45 + this.comboCount * 0.04),
    );
    this.playCorrectClickSound();

    if (this.refreshOnCorrectClick) {
      this.refreshQuestion(true);
    }
  }

  private handleWrongClick(
    clickedDirection: ArrowDirection,
    correctDirection: ArrowDirection,
  ) {
    this.comboCount = 0;
    this.wrongCount += 1;
    this.updateComboLabel();
    const remainingLives = this.lifeDisplay?.loseLife();
    this.playWrongClickSound();

    if (remainingLives === 0) {
      this.endGame();
      warn(
        `ArrowGameController: wrong direction ${ArrowDirection[clickedDirection]}, expected ${ArrowDirection[correctDirection]}.`,
      );
      return;
    }

    if (this.refreshOnCorrectClick) {
      this.refreshQuestion(true);
    }

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

  private refreshQuestion(animated: boolean) {
    this.arrowDisplay?.showRandomArrow(true, animated);
    this.refreshRule();
    this.questionStartedAt = Date.now();
  }

  private refreshRule() {
    this.currentRule =
      Math.random() < 0.5 ? ArrowClickRule.Normal : ArrowClickRule.Reverse;
    this.updateRuleLabel();
  }

  private updateRuleLabel() {
    if (!this.ruleLabel) {
      return;
    }

    this.ruleLabel.string =
      this.currentRule === ArrowClickRule.Normal
        ? this.normalRuleText
        : this.reverseRuleText;
  }

  private getCorrectDirection(currentDirection: ArrowDirection) {
    if (this.currentRule === ArrowClickRule.Normal) {
      return currentDirection;
    }

    return getOppositeArrowDirection(currentDirection);
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

  private updateFastestReaction() {
    if (this.questionStartedAt <= 0) {
      return;
    }

    const reactionSeconds = (Date.now() - this.questionStartedAt) / 1000;
    if (reactionSeconds > 0) {
      this.fastestReaction = Math.min(this.fastestReaction, reactionSeconds);
    }
  }

  private saveGameResult() {
    const accuracy =
      this.totalClickCount > 0
        ? (this.correctCount / this.totalClickCount) * 100
        : 0;
    const historyBestScore = this.createMockHistoryBestScore(this.score);

    GameResultStore.setResult({
      score: this.score,
      historyBestScore,
      correctCount: this.correctCount,
      accuracy,
      fastestReaction: Number.isFinite(this.fastestReaction)
        ? this.fastestReaction
        : 0,
      maxCombo: this.maxCombo,
      durationSeconds: this.gameTimer?.getElapsedSeconds() ?? 0,
      wrongCount: this.wrongCount,
    });
  }

  private createMockHistoryBestScore(currentScore: number) {
    const mockBase = 12823;
    return Math.max(mockBase, currentScore);
  }

  private loadGameSummaryScene() {
    if (!this.gameSummarySceneName) {
      warn("ArrowGameController: gameSummarySceneName is empty.");
      return;
    }

    director.loadScene(this.gameSummarySceneName);
  }
}
