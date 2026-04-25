import { _decorator, Component, Enum, EventTouch, log, Node, warn } from "cc";
import { ArrowDirection } from "./RandomArrowDisplay";
import { ArrowGameController } from "./ArrowGameController";

const { ccclass, property } = _decorator;

@ccclass("ArrowDirectionButton")
export class ArrowDirectionButton extends Component {
  @property({ type: Enum(ArrowDirection) })
  public direction = ArrowDirection.Up;

  @property(ArrowGameController)
  public gameController: ArrowGameController | null = null;

  @property
  public autoBindTouch = false;

  start() {
    if (this.autoBindTouch) {
      this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }
    log(`ArrowDirectionButton: ${this.node.name} bind ${ArrowDirection[this.direction]}.`);
  }

  onDestroy() {
    if (this.autoBindTouch) {
      this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }
  }

  private onTouchEnd(event: EventTouch) {
    event.propagationStopped = true;
    this.handleClick("touch-end");
  }

  private handleClick(source: string) {
    log(
      `ArrowDirectionButton: ${source} ${this.node.name} ${ArrowDirection[this.direction]}.`,
    );

    const controller = this.gameController ?? this.findGameController();
    if (!controller) {
      warn("ArrowDirectionButton: gameController is missing.");
      return;
    }

    controller.handleDirectionClick(this.direction);
  }

  private findGameController() {
    let node = this.node.parent;
    while (node) {
      const controller = node.getComponent(ArrowGameController);
      if (controller) {
        return controller;
      }
      node = node.parent;
    }
    return null;
  }
}
