import {
  _decorator,
  AudioClip,
  AudioSource,
  BlockInputEvents,
  Button,
  Color,
  Component,
  director,
  Graphics,
  Label,
  Node,
  resources,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
  warn,
} from "cc";
import { GameTimerLabel } from "../游戏进行页面/GameTimerLabel";
import { PauseOverlay } from "../游戏进行页面/PauseOverlay";
import { GameResultStore } from "../工具/GameResultStore";
import { GameSettings } from "../设置/GameSettings";

const { ccclass, property } = _decorator;

type NumberCell = {
  node: Node;
  value: number;
  button: Button;
  background: Graphics;
  opacity: UIOpacity;
};

const CELL_BACKGROUND_COLORS = [
  new Color(246, 82, 125, 255),
  new Color(255, 154, 24, 255),
  new Color(84, 194, 232, 255),
  new Color(245, 245, 241, 255),
  new Color(87, 211, 148, 255),
];

const TEXT_COLORS = [
  new Color(255, 255, 255, 255),
  new Color(21, 140, 66, 255),
  new Color(255, 247, 232, 255),
  new Color(34, 54, 68, 255),
];

@ccclass("NumberHuntController")
export class NumberHuntController extends Component {
  @property({ displayName: "游戏总时长秒" })
  public totalGameSeconds = 60;

  @property({ displayName: "首页场景名" })
  public homeSceneName = "游戏首页";

  @property({ displayName: "游戏总结场景名" })
  public gameSummarySceneName = "游戏总结";

  @property({ displayName: "结束后切到总结页" })
  public loadSummarySceneOnEnd = true;

  @property({ type: GameTimerLabel, displayName: "计时器组件" })
  public gameTimer: GameTimerLabel | null = null;

  @property({ type: PauseOverlay, displayName: "暂停弹窗" })
  public pauseOverlay: PauseOverlay | null = null;

  private uiRoot: Node | null = null;
  private timerLabel: Label | null = null;
  private targetLabel: Label | null = null;
  private progressLabel: Label | null = null;
  private gridNode: Node | null = null;
  private pauseLayerNode: Node | null = null;
  private pausePopupNode: Node | null = null;
  private correctSound: AudioClip | null = null;
  private wrongSound: AudioClip | null = null;
  private cells: NumberCell[] = [];
  private currentTarget = 1;
  private correctCount = 0;
  private wrongInputCount = 0;
  private comboCount = 0;
  private maxCombo = 0;
  private fastestReaction = Number.POSITIVE_INFINITY;
  private gameStartedAt = 0;
  private targetStartedAt = 0;
  private isPaused = false;
  private isGameEnded = false;

  onLoad() {
    this.setupScene();
    this.loadSounds();
  }

  start() {
    this.restartGame();
  }

  public pauseGame() {
    if (this.isGameEnded || this.isPaused) {
      return;
    }

    this.isPaused = true;
    this.gameTimer?.pauseTimer();
    this.showPauseLayer();
  }

  public resumeGame() {
    if (this.isGameEnded) {
      return;
    }

    this.isPaused = false;
    this.hidePauseLayer();
    this.gameTimer?.startTimer();
  }

  public togglePause() {
    if (this.isPaused) {
      this.resumeGame();
      return;
    }

    this.pauseGame();
  }

  public restartGame() {
    this.isPaused = false;
    this.isGameEnded = false;
    this.currentTarget = 1;
    this.correctCount = 0;
    this.wrongInputCount = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
    this.fastestReaction = Number.POSITIVE_INFINITY;
    this.gameStartedAt = Date.now();
    this.targetStartedAt = this.gameStartedAt;

    this.hidePauseLayer();
    this.buildNumberGrid();
    this.refreshHeaderLabels();
    this.gameTimer?.setCompleteCallback(() => this.endGame(false));
    this.gameTimer?.restartTimer(this.totalGameSeconds);
  }

  public backToHome() {
    if (!this.homeSceneName) {
      warn("NumberHuntController: homeSceneName is empty.");
      return;
    }

    director.loadScene(this.homeSceneName);
  }

  private setupScene() {
    this.setupCanvas();
    this.uiRoot = this.findChildByName(this.node, "游戏背景") ?? this.node;
    this.createHeader();
    this.createGridRoot();
    this.setupCopiedPauseOverlay();
    this.setupTimer();
  }

  private setupCanvas() {
    let transform = this.node.getComponent(UITransform);
    if (!transform) {
      transform = this.node.addComponent(UITransform);
    }

    transform.setContentSize(750, 1334);
  }

  private createHeader() {
    const parent = this.uiRoot ?? this.node;

    const timer = this.createLabelNode("倒计时", parent, 170, 64, -238, 552, 46);
    this.timerLabel = timer.getComponent(Label);
    this.setLabel(this.timerLabel, "60", new Color(255, 255, 255, 255));

    const second = this.createLabelNode("秒", parent, 60, 44, -132, 548, 24);
    this.setLabel(second.getComponent(Label), "秒", new Color(202, 218, 225, 255));

    const target = this.createLabelNode("当前目标", parent, 360, 70, 0, 438, 38);
    this.targetLabel = target.getComponent(Label);

    const progress = this.createLabelNode("进度", parent, 300, 48, 0, 384, 24);
    this.progressLabel = progress.getComponent(Label);
  }

  private createGridRoot() {
    this.gridNode = this.createNode("数字网格", this.uiRoot ?? this.node, 650, 650, 0, -36);
  }

  private setupTimer() {
    this.gameTimer = this.gameTimer ?? this.node.getComponent(GameTimerLabel);
    if (!this.gameTimer) {
      this.gameTimer = this.node.addComponent(GameTimerLabel);
    }

    this.gameTimer.targetLabel = this.timerLabel;
    this.gameTimer.autoStart = false;
    this.gameTimer.startSeconds = this.totalGameSeconds;
    this.gameTimer.countdownMode = true;
    this.gameTimer.minDigits = 2;
  }

  private setupCopiedPauseOverlay() {
    const pauseLayer = this.findChildByName(this.node, "暂停层");
    const pausePopup = pauseLayer
      ? this.findChildByName(pauseLayer, "暂停页面")
      : null;

    this.pauseLayerNode = pauseLayer;
    this.pausePopupNode = pausePopup;

    if (pauseLayer) {
      let pauseOverlay = pauseLayer.getComponent(PauseOverlay);
      if (!pauseOverlay) {
        pauseOverlay = pauseLayer.addComponent(PauseOverlay);
      }

      pauseOverlay.popupNode = pausePopup;
      pauseOverlay.hideOnLoad = false;
      pauseOverlay.maskOpacity = 210;
      this.pauseOverlay = pauseOverlay;
      if (!pauseLayer.getComponent(BlockInputEvents)) {
        pauseLayer.addComponent(BlockInputEvents);
      }
      pauseLayer.setSiblingIndex(pauseLayer.parent ? pauseLayer.parent.children.length - 1 : 0);
      pauseLayer.active = false;
    }

    this.bindButtonByName("暂停按钮", this.togglePause);
    this.bindButtonByName("继续游戏", this.resumeGame);
    this.bindButtonByName("重新开始", this.restartGame);
    this.bindButtonByName("返回首页", this.backToHome);
    this.bindButtonByName("设置", this.resumeGame);
  }

  private showPauseLayer() {
    const pauseLayer = this.pauseLayerNode ?? this.pauseOverlay?.node ?? null;
    if (!pauseLayer) {
      return;
    }

    pauseLayer.active = true;
    pauseLayer.setSiblingIndex(pauseLayer.parent ? pauseLayer.parent.children.length - 1 : 0);
    if (!pauseLayer.getComponent(BlockInputEvents)) {
      pauseLayer.addComponent(BlockInputEvents);
    }

    const layerOpacity = pauseLayer.getComponent(UIOpacity);
    if (layerOpacity) {
      layerOpacity.opacity = 255;
    }

    const pausePopup = this.pausePopupNode ?? this.pauseOverlay?.popupNode ?? null;
    if (pausePopup) {
      pausePopup.active = true;
      pausePopup.setScale(1, 1, 1);
      const popupOpacity = pausePopup.getComponent(UIOpacity);
      if (popupOpacity) {
        popupOpacity.opacity = 255;
      }
    }
  }

  private hidePauseLayer() {
    const pauseLayer = this.pauseLayerNode ?? this.pauseOverlay?.node ?? null;
    if (pauseLayer) {
      pauseLayer.active = false;
    }
  }

  private buildNumberGrid() {
    if (!this.gridNode) {
      return;
    }

    this.gridNode.destroyAllChildren();
    this.cells = [];

    const values = this.shuffle(Array.from({ length: 25 }, (_, index) => index + 1));
    const cellSize = 118;
    const gap = 10;
    const step = cellSize + gap;
    const startX = -step * 2;
    const startY = step * 2;

    values.forEach((value, index) => {
      const row = Math.floor(index / 5);
      const col = index % 5;
      const x = startX + col * step;
      const y = startY - row * step;
      this.createNumberCell(value, x, y, cellSize);
    });
  }

  private createNumberCell(value: number, x: number, y: number, size: number) {
    if (!this.gridNode) {
      return;
    }

    const node = this.createNode(`数字-${value}`, this.gridNode, size, size, x, y);
    const background = node.addComponent(Graphics);
    const backgroundColor = this.randomItem(CELL_BACKGROUND_COLORS);
    this.drawRect(background, size, size, backgroundColor);

    const opacity = node.addComponent(UIOpacity);
    const button = node.addComponent(Button);
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.92;
    button.duration = 0.08;

    const label = this.createLabelNode("数字", node, size, size, 0, 0, 48);
    const textColor = this.pickTextColor(backgroundColor);
    this.setLabel(label.getComponent(Label), `${value}`, textColor);

    const cell: NumberCell = {
      node,
      value,
      button,
      background,
      opacity,
    };
    this.cells.push(cell);
    node.on(Button.EventType.CLICK, () => this.handleNumberClick(cell), this);
  }

  private handleNumberClick(cell: NumberCell) {
    if (this.isPaused || this.isGameEnded || !cell.button.interactable) {
      return;
    }

    if (cell.value !== this.currentTarget) {
      this.recordWrongClick(cell);
      return;
    }

    this.recordCorrectClick(cell);
  }

  private recordCorrectClick(cell: NumberCell) {
    const now = Date.now();
    const reactionSeconds = Math.max(0, (now - this.targetStartedAt) / 1000);
    if (reactionSeconds > 0) {
      this.fastestReaction = Math.min(this.fastestReaction, reactionSeconds);
    }

    this.correctCount += 1;
    this.comboCount += 1;
    this.maxCombo = Math.max(this.maxCombo, this.comboCount);
    this.currentTarget += 1;
    this.targetStartedAt = now;
    this.playSound(this.correctSound, 1);
    this.markCellComplete(cell);
    this.refreshHeaderLabels();

    if (this.correctCount >= 25) {
      this.endGame(true);
    }
  }

  private recordWrongClick(cell: NumberCell) {
    this.wrongInputCount += 1;
    this.comboCount = 0;
    this.playSound(this.wrongSound, 1);
    this.refreshHeaderLabels();
    tween(cell.node)
      .stop()
      .to(0.05, { scale: new Vec3(0.92, 0.92, 1) })
      .to(0.1, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  private markCellComplete(cell: NumberCell) {
    cell.button.interactable = false;
    cell.opacity.opacity = 105;
    this.drawRect(cell.background, 118, 118, new Color(38, 48, 57, 255));
    tween(cell.node)
      .stop()
      .to(0.08, { scale: new Vec3(0.9, 0.9, 1) })
      .to(0.12, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  private endGame(completed: boolean) {
    if (this.isGameEnded) {
      return;
    }

    this.isGameEnded = true;
    this.isPaused = true;
    this.gameTimer?.pauseTimer();
    this.saveGameResult(completed);

    if (this.loadSummarySceneOnEnd) {
      director.loadScene(this.gameSummarySceneName);
    }
  }

  private saveGameResult(completed: boolean) {
    const endedAt = Date.now();
    const elapsedSeconds = this.gameTimer
      ? this.gameTimer.getElapsedSecondsPrecise()
      : Math.max(0, (endedAt - this.gameStartedAt) / 1000);
    const durationMs = Math.max(0, Math.floor(elapsedSeconds * 1000));
    const remainingSeconds = this.gameTimer?.getRemainingSeconds() ?? 0;
    const score = completed
      ? 2500 + remainingSeconds * 50 - this.wrongInputCount * 10
      : this.correctCount * 80 - this.wrongInputCount * 10;
    const totalAttempts = this.correctCount + this.wrongInputCount;
    const accuracy = totalAttempts > 0 ? (this.correctCount / totalAttempts) * 100 : 0;

    GameResultStore.setResult({
      score: Math.max(0, Math.floor(score)),
      historyBestScore: 0,
      correctCount: this.correctCount,
      accuracy,
      fastestReaction: Number.isFinite(this.fastestReaction)
        ? this.fastestReaction
        : 0,
      maxCombo: this.maxCombo,
      durationSeconds: Math.floor(durationMs / 1000),
      durationMs,
      wrongCount: this.wrongInputCount,
      wrongInputCount: this.wrongInputCount,
      missedCount: completed ? 0 : 25 - this.correctCount,
      totalQuestions: 25,
      remainingLives: 0,
      startedAt: this.gameStartedAt > 0 ? new Date(this.gameStartedAt).toISOString() : "",
      endedAt: new Date(endedAt).toISOString(),
    });
  }

  private refreshHeaderLabels() {
    this.setLabel(
      this.targetLabel,
      this.currentTarget <= 25 ? `目标 ${this.currentTarget}` : "完成",
      new Color(255, 255, 255, 255),
    );
    this.setLabel(
      this.progressLabel,
      `已完成 ${this.correctCount}/25  失误 ${this.wrongInputCount}`,
      new Color(202, 218, 225, 255),
    );
  }

  private createLabelNode(
    name: string,
    parent: Node,
    width: number,
    height: number,
    x: number,
    y: number,
    fontSize: number,
  ) {
    const node = this.createNode(name, parent, width, height, x, y);
    const label = node.addComponent(Label);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.fontSize = fontSize;
    label.lineHeight = Math.ceil(fontSize * 1.25);
    label.isBold = true;
    label.overflow = Label.Overflow.SHRINK;
    return node;
  }

  private createNode(
    name: string,
    parent: Node,
    width: number,
    height: number,
    x: number,
    y: number,
  ) {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.parent = parent;
    node.setPosition(x, y, 0);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    return node;
  }

  private findChildByName(root: Node, name: string): Node | null {
    if (root.name === name) {
      return root;
    }

    for (const child of root.children) {
      const match = this.findChildByName(child, name);
      if (match) {
        return match;
      }
    }

    return null;
  }

  private bindButtonByName(name: string, handler: () => void) {
    const node = this.findChildByName(this.node, name);
    if (!node) {
      return;
    }

    const button = node.getComponent(Button);
    if (button) {
      button.clickEvents = [];
    }

    node.off(Button.EventType.CLICK, handler, this);
    node.on(Button.EventType.CLICK, handler, this);
  }

  private drawRect(graphics: Graphics, width: number, height: number, color: Color) {
    graphics.clear();
    graphics.fillColor = color;
    graphics.rect(-width * 0.5, -height * 0.5, width, height);
    graphics.fill();
  }

  private setLabel(label: Label | null, text: string, color: Color) {
    if (!label) {
      return;
    }

    label.string = text;
    label.color = color;
  }

  private shuffle(values: number[]) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }

  private randomItem<T>(items: T[]) {
    return items[Math.floor(Math.random() * items.length)];
  }

  private pickTextColor(background: Color) {
    const luminance = background.r * 0.299 + background.g * 0.587 + background.b * 0.114;
    if (luminance > 200) {
      return new Color(21, 140, 66, 255);
    }

    return this.randomItem(TEXT_COLORS);
  }

  private loadSounds() {
    resources.load("音频/点击音效/正确提示音效", AudioClip, (_error, clip) => {
      this.correctSound = clip ?? null;
    });
    resources.load("音频/点击音效/错误提示音效", AudioClip, (_error, clip) => {
      this.wrongSound = clip ?? null;
    });
  }

  private playSound(clip: AudioClip | null, volume: number) {
    if (!clip) {
      return;
    }

    const effectiveVolume = GameSettings.getEffectiveEffectsVolume(volume);
    if (effectiveVolume <= 0) {
      return;
    }

    let audioSource = this.node.getComponent(AudioSource);
    if (!audioSource) {
      audioSource = this.node.addComponent(AudioSource);
    }
    audioSource.playOneShot(clip, effectiveVolume);
  }
}
