import {
  _decorator,
  Component,
  Enum,
  Label,
  Node,
  ResolutionPolicy,
  UITransform,
  view,
} from "cc";
import {
  Direction,
  directionToText,
  oppositeOf,
  randomDirection,
} from "./Direction";
import { LottieArrowRenderer } from "./LottieArrowRenderer";

const { ccclass, property } = _decorator;

export enum ClickRule {
  AvoidSameDirection = 0,
  StrictOpposite = 1,
}

Enum(ClickRule);

@ccclass("GameController")
export class GameController extends Component {
  @property(Node)
  public arrowNode: Node | null = null;

  @property(Label)
  public scoreLabel: Label | null = null;

  @property(Label)
  public statusLabel: Label | null = null;

  @property({ type: Enum(ClickRule) })
  public clickRule = ClickRule.AvoidSameDirection;

  @property
  public designWidth = 750;

  @property
  public designHeight = 1334;

  private renderer: LottieArrowRenderer | null = null;
  private currentDirection = Direction.Right;
  private hasCurrentDirection = false;
  private score = 0;
  private isGameOver = false;
  private isAnimating = false;

  start() {
    this.setupMobileCanvas();
    this.setupArrowRenderer();
    this.restartGame();
  }

  public restartGame() {
    this.score = 0;
    this.isGameOver = false;
    this.isAnimating = false;
    this.hasCurrentDirection = false;
    this.updateScore();
    this.setStatus("Tap any direction except the arrow direction");
    this.nextArrow();
  }

  public handleDirectionClick(clickedDirection: Direction) {
    if (this.isGameOver || this.isAnimating) {
      return;
    }

    this.isAnimating = true;
    const isCorrect = this.isCorrectClick(clickedDirection);
    const finishClick = () => {
      if (isCorrect) {
        this.score += 1;
        this.updateScore();
        this.setStatus(`OK: ${directionToText(clickedDirection)}`);
        this.nextArrow();
      } else {
        this.endGame(clickedDirection);
      }
      this.isAnimating = false;
    };

    if (this.renderer) {
      this.renderer.playClickAnimation(this.currentDirection, finishClick);
      return;
    }

    finishClick();
  }

  private setupMobileCanvas() {
    view.setDesignResolutionSize(
      this.designWidth,
      this.designHeight,
      ResolutionPolicy.FIXED_WIDTH,
    );

    const transform = this.node.getComponent(UITransform);
    transform?.setContentSize(this.designWidth, this.designHeight);
    this.node.setPosition(this.designWidth / 2, this.designHeight / 2, 0);
  }

  private setupArrowRenderer() {
    if (!this.arrowNode) {
      this.arrowNode = this.node.getChildByName("ArrowDisplay");
    }

    if (!this.arrowNode) {
      this.arrowNode = new Node("ArrowDisplay");
      this.arrowNode.parent = this.node;
      this.arrowNode.setPosition(0, 180, 0);
    }

    this.renderer = this.arrowNode.getComponent(LottieArrowRenderer);
    if (!this.renderer) {
      this.renderer = this.arrowNode.addComponent(LottieArrowRenderer);
    }
    this.renderer.preload();
  }

  private nextArrow() {
    this.currentDirection = randomDirection(
      this.hasCurrentDirection ? this.currentDirection : undefined,
    );
    this.hasCurrentDirection = true;
    this.renderer?.showDirection(this.currentDirection);
  }

  private isCorrectClick(clickedDirection: Direction) {
    if (this.clickRule === ClickRule.StrictOpposite) {
      return clickedDirection === oppositeOf(this.currentDirection);
    }
    return clickedDirection !== this.currentDirection;
  }

  private endGame(clickedDirection: Direction) {
    this.isGameOver = true;
    this.setStatus(
      `Game Over: arrow ${directionToText(this.currentDirection)}, tapped ${directionToText(clickedDirection)}`,
    );
  }

  private updateScore() {
    if (this.scoreLabel) {
      this.scoreLabel.string = `${this.score}`;
    }
  }

  private setStatus(text: string) {
    if (this.statusLabel) {
      this.statusLabel.string = text;
    }
  }
}
