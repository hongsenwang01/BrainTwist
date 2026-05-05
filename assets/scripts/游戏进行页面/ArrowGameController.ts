import {
  _decorator,
  AudioClip,
  AudioSource,
  Color,
  Component,
  director,
  Label,
  Node,
  Tween,
  tween,
  UIOpacity,
  UITransform,
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

  @property({ displayName: "游戏总时长秒" })
  public totalGameSeconds = 90;

  @property({ type: Label, displayName: "加速提示文本" })
  public speedUpPromptLabel: Label | null = null;

  @property({ type: [Number], displayName: "加速触发秒数" })
  public speedUpElapsedSeconds: number[] = [25, 50, 70];

  @property({ type: [Number], displayName: "加速后刷新间隔" })
  public speedUpRefreshIntervals: number[] = [0.82, 0.65, 0.48];

  @property({ type: [String], displayName: "加速提示文案" })
  public speedUpPromptTexts: string[] = ["开始加速!", "再快一点!", "极速挑战!"];

  @property({ displayName: "加速提示显示时间" })
  public speedUpPromptDuration = 0.85;

  @property({ displayName: "加速提示Y坐标" })
  public speedUpPromptY = 180;

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
  private currentArrowRefreshInterval = 2;
  private speedUpStageIndex = 0;
  private speedUpPromptNode: Node | null = null;
  private speedUpPromptOpacity: UIOpacity | null = null;

  onLoad() {
    this.isPaused = this.startPaused;
    this.audioSource = this.getOrCreateAudioSource();
    this.currentArrowRefreshInterval = this.getBaseArrowRefreshInterval();
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
    this.gameTimer?.restartTimer(this.totalGameSeconds);
    if (this.startPaused) {
      this.gameTimer?.pauseTimer();
    }
    this.startArrowRefreshLoop();
  }

  onDisable() {
    this.stopArrowRefreshLoop();
    this.stopRunningFeedbackTweens();
    this.stopSpeedUpWatcher();
  }

  onDestroy() {
    this.stopArrowRefreshLoop();
    this.stopRunningFeedbackTweens();
    this.stopSpeedUpWatcher();
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
    this.resetSpeedUpState();
    this.isGameEnded = false;
    this.updateComboLabel();
    this.stopScoreTweens();
    this.updateScoreLabel(0);
    this.lifeDisplay?.resetLives();
    this.comboMotivationPrompt?.resetTriggers();
    this.refreshQuestion(false);
    this.startRoundClock();
    this.gameTimer?.restartTimer(this.totalGameSeconds);
    this.resumeGame();
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
    this.stopSpeedUpWatcher();
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
    this.hideSpeedUpPrompt();
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
    this.stopSpeedUpWatcher();

    if (!this.autoRefreshArrow) {
      return;
    }

    const interval = Math.max(0.1, this.currentArrowRefreshInterval);
    this.schedule(this.advanceQuestionByTimer, interval);
    this.schedule(this.updateSpeedUpStage, 0.2);
  }

  private stopArrowRefreshLoop() {
    this.unschedule(this.advanceQuestionByTimer);
  }

  private stopSpeedUpWatcher() {
    this.unschedule(this.updateSpeedUpStage);
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

  private updateSpeedUpStage() {
    if (this.isPaused || this.isGameEnded) {
      return;
    }

    const nextTriggerSecond = this.getSpeedUpTriggerSecond(this.speedUpStageIndex);
    if (nextTriggerSecond === null || this.getGameElapsedSeconds() < nextTriggerSecond) {
      return;
    }

    const nextInterval = this.getSpeedUpRefreshInterval(this.speedUpStageIndex);
    if (nextInterval === null) {
      this.speedUpStageIndex += 1;
      return;
    }

    this.currentArrowRefreshInterval = nextInterval;
    this.speedUpStageIndex += 1;
    this.restartArrowRefreshLoopWithCurrentInterval();
    this.playSpeedUpPrompt(this.getSpeedUpPromptText(this.speedUpStageIndex - 1));
  }

  private restartArrowRefreshLoopWithCurrentInterval() {
    this.unschedule(this.advanceQuestionByTimer);
    this.schedule(
      this.advanceQuestionByTimer,
      Math.max(0.1, this.currentArrowRefreshInterval),
    );
  }

  private resetSpeedUpState() {
    this.speedUpStageIndex = 0;
    this.currentArrowRefreshInterval = this.getBaseArrowRefreshInterval();
    this.hideSpeedUpPrompt();
  }

  private getBaseArrowRefreshInterval() {
    return Math.max(0.1, this.arrowRefreshInterval);
  }

  private getGameElapsedSeconds() {
    return this.gameTimer
      ? this.gameTimer.getElapsedSeconds()
      : Math.max(0, (Date.now() - this.gameStartedAt) / 1000);
  }

  private getSpeedUpTriggerSecond(index: number) {
    const triggerSecond = this.speedUpElapsedSeconds[index];
    if (typeof triggerSecond !== "number" || triggerSecond < 0) {
      return null;
    }

    return triggerSecond;
  }

  private getSpeedUpRefreshInterval(index: number) {
    const interval = this.speedUpRefreshIntervals[index];
    if (typeof interval !== "number" || interval <= 0) {
      return null;
    }

    return Math.max(0.1, interval);
  }

  private getSpeedUpPromptText(index: number) {
    return this.speedUpPromptTexts[index] ?? "开始加速!";
  }

  private playSpeedUpPrompt(text: string) {
    const label = this.speedUpPromptLabel ?? this.getOrCreateSpeedUpPromptLabel();
    if (!label) {
      return;
    }

    const promptNode = label.node;
    const opacity = this.speedUpPromptOpacity ?? promptNode.getComponent(UIOpacity);
    if (!opacity) {
      return;
    }

    Tween.stopAllByTarget(promptNode);
    Tween.stopAllByTarget(opacity);
    label.string = text;
    promptNode.active = true;
    promptNode.setPosition(new Vec3(0, this.speedUpPromptY, 0));
    promptNode.setScale(0.72, 0.72, 1);
    opacity.opacity = 0;

    tween(opacity)
      .to(0.12, { opacity: 255 }, { easing: "sineOut" })
      .delay(Math.max(0.1, this.speedUpPromptDuration))
      .to(0.18, { opacity: 0 }, { easing: "sineIn" })
      .call(() => {
        promptNode.active = false;
      })
      .start();

    tween(promptNode)
      .to(0.14, { scale: new Vec3(1.18, 1.18, 1) }, { easing: "backOut" })
      .to(0.12, { scale: new Vec3(1, 1, 1) }, { easing: "sineOut" })
      .delay(Math.max(0.1, this.speedUpPromptDuration))
      .to(0.18, { position: new Vec3(0, this.speedUpPromptY + 34, 0) }, { easing: "sineIn" })
      .start();
  }

  private hideSpeedUpPrompt() {
    const label = this.speedUpPromptLabel;
    const promptNode = label?.node ?? this.speedUpPromptNode;
    if (!promptNode) {
      return;
    }

    Tween.stopAllByTarget(promptNode);
    const opacity = this.speedUpPromptOpacity ?? promptNode.getComponent(UIOpacity);
    if (opacity) {
      Tween.stopAllByTarget(opacity);
      opacity.opacity = 0;
    }
    promptNode.active = false;
  }

  private getOrCreateSpeedUpPromptLabel() {
    if (this.speedUpPromptLabel) {
      return this.speedUpPromptLabel;
    }

    const promptNode = new Node("Speed Up Prompt");
    promptNode.parent = this.node;
    promptNode.layer = this.node.layer;
    promptNode.setPosition(new Vec3(0, this.speedUpPromptY, 0));

    const transform = promptNode.addComponent(UITransform);
    transform.setContentSize(360, 84);

    const label = promptNode.addComponent(Label);
    label.fontSize = 46;
    label.lineHeight = 56;
    label.color = new Color(255, 232, 76, 255);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    const opacity = promptNode.addComponent(UIOpacity);
    opacity.opacity = 0;
    promptNode.active = false;

    this.speedUpPromptNode = promptNode;
    this.speedUpPromptLabel = label;
    this.speedUpPromptOpacity = opacity;
    return label;
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
