import { _decorator, Button, Component, Enum } from "cc";
import { ButtonPressAnimator } from "./ButtonPressAnimator";
import { Direction } from "./Direction";
import { GameController } from "./GameController";

const { ccclass, property } = _decorator;

@ccclass("DirectionButton")
export class DirectionButton extends Component {
  @property({ type: Enum(Direction) })
  public direction = Direction.Up;

  @property(GameController)
  public gameController: GameController | null = null;

  @property(ButtonPressAnimator)
  public pressAnimator: ButtonPressAnimator | null = null;

  start() {
    this.node.on(Button.EventType.CLICK, this.onClick, this);
    this.pressAnimator = this.pressAnimator ?? this.findPressAnimator();
  }

  onDestroy() {
    this.node.off(Button.EventType.CLICK, this.onClick, this);
  }

  private onClick() {
    this.pressAnimator?.play();
    const controller = this.gameController ?? this.findGameController();
    controller?.handleDirectionClick(this.direction);
  }

  private findGameController() {
    let node = this.node.parent;
    while (node) {
      const controller = node.getComponent(GameController);
      if (controller) {
        return controller;
      }
      node = node.parent;
    }
    return null;
  }

  private findPressAnimator() {
    const selfAnimator = this.node.getComponent(ButtonPressAnimator);
    if (selfAnimator) {
      return selfAnimator;
    }

    const children = this.node.children;
    for (const child of children) {
      const animator = child.getComponent(ButtonPressAnimator);
      if (animator) {
        return animator;
      }
    }

    return null;
  }
}
