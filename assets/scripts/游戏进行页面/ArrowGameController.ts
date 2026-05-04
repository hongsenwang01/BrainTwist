import {
  _decorator,
  AudioClip,
  AudioSource,
  Component,
  director,
  Label,
  Node,
  Tween,
  tween,
  Vec2,
  Vec3,
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
import { ScoreGainPopup } from "./ScoreGainPopup";
import { GameResultStore } from "../工具/GameResultStore";
import { TextLetterSpacing } from "../工具/TextLetterSpacing";

const { ccclass, property } = _decorator;

enum ArrowClickRule {
  Normal = 0,
  Reverse = 1,
}

type DirectionInputSource = "button" | "swipe";

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

  @property({ type: ScoreGainPopup, displayName: "加分提示" })
  public scoreGainPopup: ScoreGainPopup | null = null;

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

  @property({ displayName: "自动刷新箭头" })
  public autoRefreshArrow = true;

  @property({ displayName: "箭头刷新间隔" })
  public arrowRefreshInterval = 2;

  @property({ displayName: "未操作扣生命" })
  public loseLifeOnMiss = true;

  @property({ displayName: "开始时暂停" })
  public startPaused = false;

  @property({ displayName: "首页场景名" })
  public homeSceneName = "游戏首页";

  @property({ displayName: "游戏总结场景名" })
  public gameSummarySceneName = "游戏总结";

  @property({ displayName: "结束后切到总结页" })
  public loadSummarySceneOnEnd = true;

  @property({ displayName: "分数滚动时长" })
  public scoreRollDuration = 0.28;

  @property({ displayName: "分数弹出缩放" })
  public scorePopScale = 1.16;

  @property({ displayName: "分数弹出时间" })
  public scorePopInDuration = 0.08;

  @property({ displayName: "分数回缩时间" })
  public scorePopOutDuration = 0.12;

  private comboCount = 0;
  private score = 0;
  private displayedScore = 0;
  private isPaused = false;
  private isGameEnded = false;
  private audioSource: AudioSource | null = null;
  private currentRule = ArrowClickRule.Reverse;
  private correctCount = 0;
  private totalClickCount = 0;
  private wrongCount = 0;
  private wrongInputCount = 0;
  private missedCount = 0;
  private maxCombo = 0;
  private fastestReaction = Number.POSITIVE_INFINITY;
  private questionStartedAt = 0;
  private gameStartedAt = 0;
  private questionAnswered = false;
  private scoreTweenState = { value: 0 };
  private scoreLabelOriginScale = new Vec3(1, 1, 1);

  onLoad() {
    this.isPaused = this.startPaused;
    this.audioSource = this.getOrCreateAudioSource();
    this.cacheScoreLabelOriginScale();
    this.setupArrowDisplay();
    this.updateComboLabel();
    this.updateScoreLabel();
    this.refreshRule();
    this.startRoundClock();
  }

  start() {
    this.setupArrowDisplay();
    this.updateComboLabel();
    this.updateScoreLabel();
    this.updateRuleLabel();
    this.gameTimer?.setCompleteCallback(() => this.endGame());
    this.startArrowRefreshLoop();
  }

  onDisable() {
    this.stopArrowRefreshLoop();
    this.stopRunningFeedbackTweens();
  }

  onDestroy() {
    this.stopArrowRefreshLoop();
    this.stopRunningFeedbackTweens();
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

  public handleSwipeDirection(clickedDirection: ArrowDirection) {
    this.handleDirectionClick(clickedDirection, "swipe");
  }

  public pauseGame() {
    this.isPaused = true;
    this.stopArrowRefreshLoop();
    this.gameTimer?.pauseTimer();
    this.scheduleOnce(() => this.pauseOverlay?.show(), 0);
  }

  public resumeGame() {
    this.isPaused = false;
    this.startArrowRefreshLoop();
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
    this.displayedScore = 0;
    this.scoreTweenState.value = 0;
    this.correctCount = 0;
    this.totalClickCount = 0;
    this.wrongCount = 0;
    this.wrongInputCount = 0;
    this.missedCount = 0;
    this.maxCombo = 0;
    this.fastestReaction = Number.POSITIVE_INFINITY;
    this.isGameEnded = false;
    this.updateComboLabel();
    this.stopScoreTweens();
    this.updateScoreLabel(0);
    this.lifeDisplay?.resetLives();
    this.comboMotivationPrompt?.resetTriggers();
    this.refreshQuestion(false);
    this.startRoundClock();
    this.resumeGame();
    this.gameTimer?.restartTimer();
    this.startArrowRefreshLoop();
  }

  public backToHome() {
    if (!this.homeSceneName) {
      warn("ArrowGameController: homeSceneName is empty.");
      return;
    }

    director.loadScene(this.homeSceneName);
  }

  public handleDirectionClick(
    clickedDirection: ArrowDirection,
    inputSource: DirectionInputSource = "button",
  ) {
    if (this.isPaused || this.isGameEnded || this.questionAnswered) {
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
    const isCorrect = clickedDirection === correctDirection;

    if (inputSource === "swipe") {
      this.playSwipeParticleBurst(clickedDirection, isCorrect);
    }

    if (isCorrect) {
      this.handleCorrectClick(inputSource);
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
    this.stopArrowRefreshLoop();
    this.stopRunningFeedbackTweens();
    this.saveGameResult();

    if (this.loadSummarySceneOnEnd) {
      this.loadGameSummaryScene();
    }
  }

  private handleCorrectClick(inputSource: DirectionInputSource = "button") {
    this.questionAnswered = true;
    this.comboCount += 1;
    this.correctCount += 1;
    this.maxCombo = Math.max(this.maxCombo, this.comboCount);
    this.updateFastestReaction();
    const scoreIncrement = this.getScoreIncrement(this.comboCount);
    this.score += scoreIncrement;
    const targetScore = this.score;
    this.updateComboLabel();
    this.comboShakeEffect?.play();
    this.comboMotivationPrompt?.playForCombo(this.comboCount);
    const playScoreFeedback = () => this.playScoreIncreaseFeedback(targetScore);
    if (this.scoreGainPopup) {
      this.scoreGainPopup.play(scoreIncrement, playScoreFeedback);
    } else {
      playScoreFeedback();
    }
    if (inputSource !== "swipe") {
      this.bottomGlowParticleEmitter?.playBurst(
        Math.min(1.8, 0.45 + this.comboCount * 0.04),
      );
    }
    this.playCorrectClickSound();

    if (!this.autoRefreshArrow && this.refreshOnCorrectClick) {
      this.refreshQuestion(true);
    }
  }

  private handleWrongClick(
    clickedDirection: ArrowDirection,
    correctDirection: ArrowDirection,
  ) {
    this.questionAnswered = true;
    const remainingLives = this.recordWrongAnswer();

    if (remainingLives === 0) {
      this.endGame();
      warn(
        `ArrowGameController: wrong direction ${ArrowDirection[clickedDirection]}, expected ${ArrowDirection[correctDirection]}.`,
      );
      return;
    }

    if (!this.autoRefreshArrow && this.refreshOnCorrectClick) {
      this.refreshQuestion(true);
    }

    warn(
      `ArrowGameController: wrong direction ${ArrowDirection[clickedDirection]}, expected ${ArrowDirection[correctDirection]}.`,
    );
  }

  private handleMissedQuestion() {
    if (this.questionAnswered) {
      return;
    }

    this.totalClickCount += 1;
    this.questionAnswered = true;
    const remainingLives = this.recordMissedAnswer();

    if (remainingLives === 0) {
      this.endGame();
    }
  }

  private recordWrongAnswer() {
    this.comboCount = 0;
    this.wrongCount += 1;
    this.wrongInputCount += 1;
    this.updateComboLabel();
    const remainingLives = this.lifeDisplay?.loseLife();
    this.playWrongClickSound();
    return remainingLives;
  }

  private recordMissedAnswer() {
    this.comboCount = 0;
    this.wrongCount += 1;
    this.missedCount += 1;
    this.updateComboLabel();

    if (!this.loseLifeOnMiss) {
      return undefined;
    }

    const remainingLives = this.lifeDisplay?.loseLife();
    this.playWrongClickSound();
    return remainingLives;
  }

  private playSwipeParticleBurst(direction: ArrowDirection, isCorrect: boolean) {
    const comboForFeedback = isCorrect ? this.comboCount + 1 : 0;
    const multiplier = isCorrect
      ? Math.min(1.8, 0.45 + comboForFeedback * 0.04)
      : 0.52;

    this.bottomGlowParticleEmitter?.playDirectionalBurst(
      this.getSwipeParticleDirection(direction),
      multiplier,
    );
  }

  private getSwipeParticleDirection(direction: ArrowDirection) {
    switch (direction) {
      case ArrowDirection.Up:
        return new Vec2(0, 1);
      case ArrowDirection.Down:
        return new Vec2(0, -1);
      case ArrowDirection.Left:
        return new Vec2(-1, 0);
      case ArrowDirection.Right:
        return new Vec2(1, 0);
      default:
        return new Vec2(0, 1);
    }
  }

  private updateComboLabel() {
    if (this.comboLabel) {
      this.comboLabel.string = `${this.comboCount}`;
    }
  }

  private updateScoreLabel(score = this.score) {
    if (this.scoreLabel) {
      this.scoreLabel.string = this.formatScore(score);
      this.scoreLabel.node.getComponent(TextLetterSpacing)?.refresh();
    }
  }

  private playScoreIncreaseFeedback(targetScore: number) {
    if (!this.scoreLabel) {
      this.displayedScore = targetScore;
      return;
    }

    const scoreNode = this.scoreLabel.node;
    this.stopScoreTweens();
    const originScale = this.scoreLabelOriginScale.clone();
    const peakScale = new Vec3(
      originScale.x * this.scorePopScale,
      originScale.y * this.scorePopScale,
      originScale.z,
    );
    const fromScore = this.displayedScore;
    const toScore = Math.max(fromScore, targetScore);

    scoreNode.setScale(originScale);
    this.scoreTweenState.value = fromScore;

    tween(scoreNode)
      .to(this.scorePopInDuration, { scale: peakScale }, { easing: "sineOut" })
      .delay(this.scoreRollDuration)
      .to(this.scorePopOutDuration, { scale: originScale }, { easing: "sineInOut" })
      .call(() => scoreNode.setScale(originScale))
      .start();

    tween(this.scoreTweenState)
      .delay(this.scorePopInDuration)
      .to(
        this.scoreRollDuration,
        { value: toScore },
        {
          easing: "sineOut",
          onUpdate: () => {
            this.displayedScore = Math.floor(this.scoreTweenState.value);
            this.updateScoreLabel(this.displayedScore);
          },
        },
      )
      .call(() => {
        this.displayedScore = toScore;
        this.updateScoreLabel(this.displayedScore);
      })
      .start();
  }

  private stopScoreTweens() {
    Tween.stopAllByTarget(this.scoreTweenState);

    if (this.scoreLabel) {
      Tween.stopAllByTarget(this.scoreLabel.node);
    }
  }

  private stopRunningFeedbackTweens() {
    this.stopScoreTweens();
    this.scoreGainPopup?.stopAll();
  }

  private cacheScoreLabelOriginScale() {
    if (this.scoreLabel) {
      this.scoreLabelOriginScale = this.scoreLabel.node.scale.clone();
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
    this.questionAnswered = false;
  }

  private startArrowRefreshLoop() {
    this.stopArrowRefreshLoop();

    if (!this.autoRefreshArrow) {
      return;
    }

    const interval = Math.max(0.1, this.arrowRefreshInterval);
    this.schedule(this.advanceQuestionByTimer, interval);
  }

  private stopArrowRefreshLoop() {
    this.unschedule(this.advanceQuestionByTimer);
  }

  private advanceQuestionByTimer() {
    if (this.isPaused || this.isGameEnded) {
      return;
    }

    this.handleMissedQuestion();

    if (!this.isGameEnded) {
      this.refreshQuestion(true);
    }
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
    const endedAt = Date.now();
    const totalQuestions = this.correctCount + this.wrongInputCount + this.missedCount;
    const accuracy =
      totalQuestions > 0
        ? (this.correctCount / totalQuestions) * 100
        : 0;
    const durationMs = this.gameTimer
      ? this.gameTimer.getElapsedSeconds() * 1000
      : Math.max(0, endedAt - this.gameStartedAt);

    GameResultStore.setResult({
      score: this.score,
      historyBestScore: 0,
      correctCount: this.correctCount,
      accuracy,
      fastestReaction: Number.isFinite(this.fastestReaction)
        ? this.fastestReaction
        : 0,
      maxCombo: this.maxCombo,
      durationSeconds: Math.floor(durationMs / 1000),
      durationMs,
      wrongCount: this.wrongCount,
      wrongInputCount: this.wrongInputCount,
      missedCount: this.missedCount,
      totalQuestions,
      remainingLives: this.lifeDisplay?.getCurrentLives() ?? 0,
      startedAt: this.gameStartedAt > 0 ? new Date(this.gameStartedAt).toISOString() : "",
      endedAt: new Date(endedAt).toISOString(),
    });
  }

  private startRoundClock() {
    const now = Date.now();
    this.gameStartedAt = now;
    this.questionStartedAt = now;
  }

  private loadGameSummaryScene() {
    if (!this.gameSummarySceneName) {
      warn("ArrowGameController: gameSummarySceneName is empty.");
      return;
    }

    director.loadScene(this.gameSummarySceneName);
  }
}
