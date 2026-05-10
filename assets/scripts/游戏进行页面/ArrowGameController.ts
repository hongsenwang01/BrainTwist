import {
  _decorator,
  AudioClip,
  AudioSource,
  Button,
  Color,
  Component,
  director,
  isValid,
  Label,
  Node,
  Sprite,
  SpriteFrame,
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
import { GameSettings } from "../设置/GameSettings";

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

  @property({ displayName: "最短箭头刷新间隔" })
  public minimumArrowRefreshInterval = 0.8;

  @property({ displayName: "达到最短间隔的剩余秒数" })
  public reachMinimumIntervalRemainingSeconds = 15;

  @property({ displayName: "游戏总时长秒" })
  public totalGameSeconds = 90;

  @property({ type: Node, displayName: "时间沙漏道具节点" })
  public timeSlowPowerUpNode: Node | null = null;

  @property({ type: Sprite, displayName: "时间沙漏数量图片" })
  public timeSlowCountSprite: Sprite | null = null;

  @property({ type: Node, displayName: "复活之心道具节点" })
  public reviveHeartPowerUpNode: Node | null = null;

  @property({ type: Sprite, displayName: "复活之心数量图片" })
  public reviveHeartCountSprite: Sprite | null = null;

  @property({ type: Node, displayName: "正向罗盘道具节点" })
  public normalCompassPowerUpNode: Node | null = null;

  @property({ type: Sprite, displayName: "正向罗盘数量图片" })
  public normalCompassCountSprite: Sprite | null = null;

  @property({ type: [SpriteFrame], displayName: "道具数量数字图" })
  public powerUpCountSpriteFrames: SpriteFrame[] = [];

  @property({ displayName: "自动查找时间沙漏道具" })
  public autoFindTimeSlowPowerUp = true;

  @property({ displayName: "自动查找复活之心道具" })
  public autoFindReviveHeartPowerUp = true;

  @property({ displayName: "自动查找正向罗盘道具" })
  public autoFindNormalCompassPowerUp = true;

  @property({ displayName: "复活之心初始数量" })
  public initialReviveHeartPowerUpCount = 0;

  @property({ displayName: "正向罗盘初始数量" })
  public initialNormalCompassPowerUpCount = 0;

  @property({ displayName: "正向罗盘生效箭头数" })
  public normalCompassForcedArrowCount = 10;

  @property({ displayName: "时间沙漏持续秒数" })
  public timeSlowDuration = 5;

  @property({ displayName: "时间沙漏放缓倍率" })
  public timeSlowIntervalMultiplier = 1.6;

  @property({ type: Node, displayName: "复活保护提示父节点" })
  public reviveProtectPromptParent: Node | null = null;

  @property({ displayName: "复活保护提示文字" })
  public reviveProtectMessage = "保护生效";

  @property({ displayName: "复活保护提示X" })
  public reviveProtectPromptX = 0;

  @property({ displayName: "复活保护提示Y" })
  public reviveProtectPromptY = 150;

  @property({ displayName: "复活保护提示字号" })
  public reviveProtectFontSize = 48;

  @property({ displayName: "复活保护提示行高" })
  public reviveProtectLineHeight = 58;

  @property({ type: Color, displayName: "复活保护提示颜色" })
  public reviveProtectMessageColor = new Color(255, 98, 185, 255);

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
  private isArrowRefreshLoopRunning = false;
  private autoRefreshElapsedSeconds = 0;
  private timeSlowPowerUpCount = 0;
  private timeSlowRemainingSeconds = 0;
  private reviveHeartPowerUpCount = 0;
  private reviveProtectPromptNode: Node | null = null;
  private normalCompassPowerUpCount = 0;
  private normalCompassRemainingArrows = 0;

  onLoad() {
    this.isPaused = this.startPaused;
    this.audioSource = this.getOrCreateAudioSource();
    this.currentArrowRefreshInterval = this.getBaseArrowRefreshInterval();
    this.cacheScoreLabelOriginScale();
    this.setupArrowDisplay();
    this.setupTimeSlowPowerUp();
    this.setupReviveHeartPowerUp();
    this.setupNormalCompassPowerUp();
    this.reviveHeartPowerUpCount = this.clampPowerUpCount(
      this.initialReviveHeartPowerUpCount,
    );
    this.normalCompassPowerUpCount = this.clampPowerUpCount(
      this.initialNormalCompassPowerUpCount,
    );
    this.updateTimeSlowPowerUpCountView();
    this.updateReviveHeartPowerUpCountView();
    this.updateNormalCompassPowerUpCountView();
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
    this.unbindTimeSlowPowerUp();
    this.unbindReviveHeartPowerUp();
    this.unbindNormalCompassPowerUp();
    this.stopArrowRefreshLoop();
    this.stopRunningFeedbackTweens();
  }

  onDestroy() {
    this.unbindTimeSlowPowerUp();
    this.unbindReviveHeartPowerUp();
    this.unbindNormalCompassPowerUp();
    this.stopArrowRefreshLoop();
    this.stopRunningFeedbackTweens();
  }

  update(deltaTime: number) {
    this.updateTimeSlowPowerUp(deltaTime);
    this.updateSmoothArrowRefresh(deltaTime);
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
    this.timeSlowRemainingSeconds = 0;
    this.normalCompassRemainingArrows = 0;
    this.isGameEnded = false;
    this.updateComboLabel();
    this.updateReviveHeartPowerUpCountView();
    this.updateNormalCompassPowerUpCountView();
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
    this.stopRunningFeedbackTweens();
    this.saveGameResult();

    if (this.loadSummarySceneOnEnd) {
      this.loadGameSummaryScene();
    }
  }

  public addReviveHeartPowerUp(amount = 1) {
    this.reviveHeartPowerUpCount = this.clampPowerUpCount(
      this.reviveHeartPowerUpCount + amount,
    );
    this.updateReviveHeartPowerUpCountView();
  }

  public setReviveHeartPowerUpCount(count: number) {
    this.reviveHeartPowerUpCount = this.clampPowerUpCount(count);
    this.updateReviveHeartPowerUpCountView();
  }

  public addNormalCompassPowerUp(amount = 1) {
    this.normalCompassPowerUpCount = this.clampPowerUpCount(
      this.normalCompassPowerUpCount + amount,
    );
    this.updateNormalCompassPowerUpCountView();
  }

  public setNormalCompassPowerUpCount(count: number) {
    this.normalCompassPowerUpCount = this.clampPowerUpCount(count);
    this.updateNormalCompassPowerUpCountView();
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
      if (this.tryConsumeReviveHeartProtection()) {
        if (!this.autoRefreshArrow && this.refreshOnCorrectClick) {
          this.refreshQuestion(true);
        }
        return;
      }

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
      if (this.tryConsumeReviveHeartProtection()) {
        return;
      }

      this.endGame();
    }
  }

  private recordWrongAnswer() {
    this.comboCount = 0;
    this.wrongCount += 1;
    this.wrongInputCount += 1;
    this.updateComboLabel();

    if (this.tryConsumeReviveHeartProtectionBeforeLifeLoss()) {
      this.playWrongClickSound();
      return this.lifeDisplay?.getCurrentLives();
    }

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

    if (this.tryConsumeReviveHeartProtectionBeforeLifeLoss()) {
      this.playWrongClickSound();
      return this.lifeDisplay?.getCurrentLives();
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
    this.stopReviveProtectionPrompt();
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

    this.currentArrowRefreshInterval = this.getCurrentSmoothArrowRefreshInterval();
    this.autoRefreshElapsedSeconds = 0;
    this.isArrowRefreshLoopRunning = true;
  }

  private stopArrowRefreshLoop() {
    this.isArrowRefreshLoopRunning = false;
    this.autoRefreshElapsedSeconds = 0;
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

  private updateSmoothArrowRefresh(deltaTime: number) {
    if (
      !this.isArrowRefreshLoopRunning ||
      !this.autoRefreshArrow ||
      this.isPaused ||
      this.isGameEnded
    ) {
      return;
    }

    this.currentArrowRefreshInterval = this.getCurrentSmoothArrowRefreshInterval();
    this.autoRefreshElapsedSeconds += deltaTime;

    if (this.autoRefreshElapsedSeconds < this.currentArrowRefreshInterval) {
      return;
    }

    this.autoRefreshElapsedSeconds = Math.max(
      0,
      this.autoRefreshElapsedSeconds - this.currentArrowRefreshInterval,
    );
    this.advanceQuestionByTimer();
  }

  private resetSpeedUpState() {
    this.currentArrowRefreshInterval = this.getBaseArrowRefreshInterval();
    this.autoRefreshElapsedSeconds = 0;
  }

  private getBaseArrowRefreshInterval() {
    return Math.max(0.1, this.arrowRefreshInterval);
  }

  private getGameElapsedSeconds() {
    return this.gameTimer
      ? this.gameTimer.getElapsedSecondsPrecise()
      : Math.max(0, (Date.now() - this.gameStartedAt) / 1000);
  }

  private getCurrentSmoothArrowRefreshInterval() {
    const startInterval = this.getBaseArrowRefreshInterval();
    const minimumInterval = Math.max(
      0.1,
      Math.min(startInterval, this.minimumArrowRefreshInterval),
    );
    const totalSeconds = Math.max(0.1, this.totalGameSeconds);
    const reachMinimumAtElapsed = Math.max(
      0.1,
      totalSeconds - Math.max(0, this.reachMinimumIntervalRemainingSeconds),
    );
    const progress = this.clamp01(this.getGameElapsedSeconds() / reachMinimumAtElapsed);

    const interval = startInterval + (minimumInterval - startInterval) * progress;
    if (this.timeSlowRemainingSeconds <= 0) {
      return interval;
    }

    return Math.min(
      startInterval,
      interval * Math.max(1, this.timeSlowIntervalMultiplier),
    );
  }

  private clamp01(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(1, value));
  }

  private clampPowerUpCount(count: number) {
    if (!Number.isFinite(count)) {
      return 0;
    }

    const maxCount =
      this.powerUpCountSpriteFrames.length > 0
        ? Math.max(0, this.powerUpCountSpriteFrames.length - 1)
        : 99;
    return Math.max(0, Math.min(maxCount, Math.floor(count)));
  }

  private setupTimeSlowPowerUp() {
    if (!this.timeSlowPowerUpNode && this.autoFindTimeSlowPowerUp) {
      this.timeSlowPowerUpNode = this.findNodeInChildren(this.node, "时间沙漏");
    }

    if (!this.timeSlowCountSprite && this.timeSlowPowerUpNode) {
      this.timeSlowCountSprite = this
        .findNodeInChildren(this.timeSlowPowerUpNode, "数量")
        ?.getComponent(Sprite) ?? null;
    }

    if (!this.timeSlowPowerUpNode) {
      return;
    }

    let button = this.timeSlowPowerUpNode.getComponent(Button);
    if (!button) {
      button = this.timeSlowPowerUpNode.addComponent(Button);
      button.transition = Button.Transition.NONE;
    }

    this.timeSlowPowerUpNode.off(
      Button.EventType.CLICK,
      this.onTimeSlowPowerUpClicked,
      this,
    );
    this.timeSlowPowerUpNode.on(
      Button.EventType.CLICK,
      this.onTimeSlowPowerUpClicked,
      this,
    );
  }

  private unbindTimeSlowPowerUp() {
    if (!this.timeSlowPowerUpNode || !isValid(this.timeSlowPowerUpNode)) {
      return;
    }

    this.timeSlowPowerUpNode.off(
      Button.EventType.CLICK,
      this.onTimeSlowPowerUpClicked,
      this,
    );
  }

  private setupReviveHeartPowerUp() {
    if (!this.reviveHeartPowerUpNode && this.autoFindReviveHeartPowerUp) {
      this.reviveHeartPowerUpNode = this.findNodeInChildren(
        this.node,
        "\u590d\u6d3b\u4e4b\u5fc3",
      );
    }

    if (!this.reviveHeartCountSprite && this.reviveHeartPowerUpNode) {
      this.reviveHeartCountSprite = this
        .findNodeInChildren(this.reviveHeartPowerUpNode, "\u6570\u91cf")
        ?.getComponent(Sprite) ?? null;
    }

    if (!this.reviveHeartPowerUpNode) {
      return;
    }

    let button = this.reviveHeartPowerUpNode.getComponent(Button);
    if (!button) {
      button = this.reviveHeartPowerUpNode.addComponent(Button);
      button.transition = Button.Transition.NONE;
    }

    this.reviveHeartPowerUpNode.off(
      Button.EventType.CLICK,
      this.onReviveHeartPowerUpClicked,
      this,
    );
    this.reviveHeartPowerUpNode.on(
      Button.EventType.CLICK,
      this.onReviveHeartPowerUpClicked,
      this,
    );
  }

  private unbindReviveHeartPowerUp() {
    if (!this.reviveHeartPowerUpNode || !isValid(this.reviveHeartPowerUpNode)) {
      return;
    }

    this.reviveHeartPowerUpNode.off(
      Button.EventType.CLICK,
      this.onReviveHeartPowerUpClicked,
      this,
    );
  }

  private setupNormalCompassPowerUp() {
    if (!this.normalCompassPowerUpNode && this.autoFindNormalCompassPowerUp) {
      this.normalCompassPowerUpNode = this.findNodeInChildren(
        this.node,
        "\u6b63\u5411\u7f57\u76d8",
      );
    }

    if (!this.normalCompassCountSprite && this.normalCompassPowerUpNode) {
      this.normalCompassCountSprite = this
        .findNodeInChildren(this.normalCompassPowerUpNode, "\u6570\u91cf")
        ?.getComponent(Sprite) ?? null;
    }

    if (!this.normalCompassPowerUpNode) {
      return;
    }

    let button = this.normalCompassPowerUpNode.getComponent(Button);
    if (!button) {
      button = this.normalCompassPowerUpNode.addComponent(Button);
      button.transition = Button.Transition.NONE;
    }

    this.normalCompassPowerUpNode.off(
      Button.EventType.CLICK,
      this.onNormalCompassPowerUpClicked,
      this,
    );
    this.normalCompassPowerUpNode.on(
      Button.EventType.CLICK,
      this.onNormalCompassPowerUpClicked,
      this,
    );
  }

  private unbindNormalCompassPowerUp() {
    if (!this.normalCompassPowerUpNode || !isValid(this.normalCompassPowerUpNode)) {
      return;
    }

    this.normalCompassPowerUpNode.off(
      Button.EventType.CLICK,
      this.onNormalCompassPowerUpClicked,
      this,
    );
  }

  private onTimeSlowPowerUpClicked() {
    if (this.isPaused || this.isGameEnded) {
      return;
    }

    if (this.timeSlowPowerUpCount <= 0) {
      this.obtainTimeSlowPowerUp();
      return;
    }

    this.useTimeSlowPowerUp();
  }

  private onReviveHeartPowerUpClicked() {
    if (this.isPaused || this.isGameEnded) {
      return;
    }

    if (this.reviveHeartPowerUpCount <= 0) {
      this.obtainReviveHeartPowerUp();
      return;
    }

    this.playReviveProtectionPrompt("死亡时自动保护");
  }

  private onNormalCompassPowerUpClicked() {
    if (this.isPaused || this.isGameEnded) {
      return;
    }

    if (this.normalCompassPowerUpCount <= 0) {
      this.obtainNormalCompassPowerUp();
      return;
    }

    this.useNormalCompassPowerUp();
  }

  private obtainTimeSlowPowerUp() {
    this.timeSlowPowerUpCount = 1;
    this.updateTimeSlowPowerUpCountView();
  }

  private obtainReviveHeartPowerUp() {
    this.addReviveHeartPowerUp(1);
  }

  private obtainNormalCompassPowerUp() {
    this.addNormalCompassPowerUp(1);
  }

  private useTimeSlowPowerUp() {
    this.timeSlowPowerUpCount = Math.max(0, this.timeSlowPowerUpCount - 1);
    this.timeSlowRemainingSeconds = Math.max(0.1, this.timeSlowDuration);
    this.autoRefreshElapsedSeconds = Math.min(
      this.autoRefreshElapsedSeconds,
      this.getCurrentSmoothArrowRefreshInterval(),
    );
    this.updateTimeSlowPowerUpCountView();
  }

  private useNormalCompassPowerUp() {
    this.normalCompassPowerUpCount = Math.max(
      0,
      this.normalCompassPowerUpCount - 1,
    );
    this.normalCompassRemainingArrows = Math.max(
      1,
      Math.floor(this.normalCompassForcedArrowCount),
    );
    this.updateNormalCompassPowerUpCountView();
    this.applyNormalCompassToCurrentQuestion();
  }

  private tryConsumeReviveHeartProtectionBeforeLifeLoss() {
    if (!this.lifeDisplay || this.lifeDisplay.getCurrentLives() > 1) {
      return false;
    }

    return this.tryConsumeReviveHeartProtection(false);
  }

  private tryConsumeReviveHeartProtection(restoreLife = true) {
    if (this.reviveHeartPowerUpCount <= 0 || !this.lifeDisplay) {
      return false;
    }

    this.reviveHeartPowerUpCount = Math.max(0, this.reviveHeartPowerUpCount - 1);
    this.updateReviveHeartPowerUpCountView();
    if (restoreLife || this.lifeDisplay.getCurrentLives() <= 0) {
      this.lifeDisplay.restoreLife(1);
    }
    this.playReviveProtectionPrompt(this.reviveProtectMessage);
    this.bottomGlowParticleEmitter?.playBurst(1.2);
    return true;
  }

  private updateTimeSlowPowerUp(deltaTime: number) {
    if (this.isPaused || this.isGameEnded || this.timeSlowRemainingSeconds <= 0) {
      return;
    }

    this.timeSlowRemainingSeconds = Math.max(
      0,
      this.timeSlowRemainingSeconds - deltaTime,
    );
  }

  private updateTimeSlowPowerUpCountView() {
    if (!this.timeSlowCountSprite || this.powerUpCountSpriteFrames.length === 0) {
      return;
    }

    const frameIndex = Math.max(
      0,
      Math.min(this.timeSlowPowerUpCount, this.powerUpCountSpriteFrames.length - 1),
    );
    const spriteFrame = this.powerUpCountSpriteFrames[frameIndex];
    if (spriteFrame) {
      this.timeSlowCountSprite.spriteFrame = spriteFrame;
    }
  }

  private updateReviveHeartPowerUpCountView() {
    if (!this.reviveHeartCountSprite || this.powerUpCountSpriteFrames.length === 0) {
      return;
    }

    const frameIndex = Math.max(
      0,
      Math.min(this.reviveHeartPowerUpCount, this.powerUpCountSpriteFrames.length - 1),
    );
    const spriteFrame = this.powerUpCountSpriteFrames[frameIndex];
    if (spriteFrame) {
      this.reviveHeartCountSprite.spriteFrame = spriteFrame;
    }
  }

  private updateNormalCompassPowerUpCountView() {
    if (!this.normalCompassCountSprite || this.powerUpCountSpriteFrames.length === 0) {
      return;
    }

    const frameIndex = Math.max(
      0,
      Math.min(
        this.normalCompassPowerUpCount,
        this.powerUpCountSpriteFrames.length - 1,
      ),
    );
    const spriteFrame = this.powerUpCountSpriteFrames[frameIndex];
    if (spriteFrame) {
      this.normalCompassCountSprite.spriteFrame = spriteFrame;
    }
  }

  private applyNormalCompassToCurrentQuestion() {
    if (this.questionAnswered || this.normalCompassRemainingArrows <= 0) {
      return;
    }

    this.currentRule = ArrowClickRule.Normal;
    this.normalCompassRemainingArrows = Math.max(
      0,
      this.normalCompassRemainingArrows - 1,
    );
    this.updateRuleLabel();
  }

  private playReviveProtectionPrompt(message = this.reviveProtectMessage) {
    this.stopReviveProtectionPrompt();

    const promptNode = new Node("复活保护提示");
    promptNode.parent = this.reviveProtectPromptParent ?? this.node;
    promptNode.setPosition(this.reviveProtectPromptX, this.reviveProtectPromptY, 0);
    promptNode.setScale(0.82, 0.82, 1);
    promptNode.setSiblingIndex(promptNode.parent.children.length - 1);

    const transform = promptNode.addComponent(UITransform);
    transform.setContentSize(320, this.reviveProtectLineHeight);

    const label = promptNode.addComponent(Label);
    label.string = message || "保护生效";
    label.fontSize = this.reviveProtectFontSize;
    label.lineHeight = this.reviveProtectLineHeight;
    label.color = new Color(
      this.reviveProtectMessageColor.r,
      this.reviveProtectMessageColor.g,
      this.reviveProtectMessageColor.b,
      this.reviveProtectMessageColor.a,
    );
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = true;
    label.enableWrapText = false;

    const opacity = promptNode.addComponent(UIOpacity);
    opacity.opacity = 0;
    this.reviveProtectPromptNode = promptNode;

    tween(opacity)
      .to(0.12, { opacity: 255 }, { easing: "sineOut" })
      .delay(0.72)
      .to(0.28, { opacity: 0 }, { easing: "sineIn" })
      .start();

    tween(promptNode)
      .to(0.12, { scale: new Vec3(1.18, 1.18, 1) }, { easing: "backOut" })
      .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: "sineOut" })
      .delay(0.62)
      .to(
        0.28,
        {
          position: new Vec3(
            this.reviveProtectPromptX,
            this.reviveProtectPromptY + 44,
            0,
          ),
        },
        { easing: "sineIn" },
      )
      .call(() => this.stopReviveProtectionPrompt())
      .start();
  }

  private stopReviveProtectionPrompt() {
    const promptNode = this.reviveProtectPromptNode;
    if (!promptNode || !isValid(promptNode, true)) {
      this.reviveProtectPromptNode = null;
      return;
    }

    const opacity = promptNode.getComponent(UIOpacity);
    if (opacity) {
      Tween.stopAllByTarget(opacity);
    }
    Tween.stopAllByTarget(promptNode);
    promptNode.destroy();
    this.reviveProtectPromptNode = null;
  }

  private findNodeInChildren(node: Node, nodeName: string): Node | null {
    if (node.name === nodeName) {
      return node;
    }

    for (const child of node.children) {
      const result = this.findNodeInChildren(child, nodeName);
      if (result) {
        return result;
      }
    }

    return null;
  }

  private refreshRule() {
    if (this.normalCompassRemainingArrows > 0) {
      this.currentRule = ArrowClickRule.Normal;
      this.normalCompassRemainingArrows = Math.max(
        0,
        this.normalCompassRemainingArrows - 1,
      );
      this.updateRuleLabel();
      return;
    }

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

    const effectiveVolume = GameSettings.getEffectiveEffectsVolume(volume);
    if (effectiveVolume <= 0) {
      return;
    }

    this.getOrCreateAudioSource().playOneShot(clip, effectiveVolume);
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
