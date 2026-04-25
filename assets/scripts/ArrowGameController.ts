import { _decorator, Component, Label, Node, warn } from "cc";
import {
  ArrowDirection,
  getOppositeArrowDirection,
  RandomArrowDisplay,
} from "./RandomArrowDisplay";
import { ComboShakeEffect } from "./ComboShakeEffect";

const { ccclass, property } = _decorator;

@ccclass("ArrowGameController")
export class ArrowGameController extends Component {
  @property(RandomArrowDisplay)
  public arrowDisplay: RandomArrowDisplay | null = null;

  @property(Label)
  public comboLabel: Label | null = null;

  @property(Label)
  public scoreLabel: Label | null = null;

  @property(ComboShakeEffect)
  public comboShakeEffect: ComboShakeEffect | null = null;

  @property
  public autoFindArrowDisplay = true;

  @property
  public refreshOnCorrectClick = true;

  private comboCount = 0;
  private score = 0;

  onLoad() {
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

  public handleDirectionClick(clickedDirection: ArrowDirection) {
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
}
