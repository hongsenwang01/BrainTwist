import { _decorator, Component, EventTouch, Node, Vec2, warn } from "cc";
import { ArrowDirection } from "./RandomArrowDisplay";
import { ArrowGameController } from "./ArrowGameController";

const { ccclass, property } = _decorator;

@ccclass("SwipeDirectionInput")
export class SwipeDirectionInput extends Component {
  @property({ type: ArrowGameController, displayName: "游戏控制器" })
  public gameController: ArrowGameController | null = null;

  @property({ displayName: "进入场景自动绑定" })
  public autoBindOnStart = true;

  @property({ displayName: "最小滑动距离" })
  public minSwipeDistance = 50;

  @property({ displayName: "方向判定比例" })
  public directionRatio = 1.25;

  @property({ displayName: "识别后阻止事件继续传递" })
  public stopPropagationOnSwipe = true;

  @property({ displayName: "自动查找游戏控制器" })
  public autoFindGameController = true;

  private touchStart = new Vec2();
  private isBound = false;

  start() {
    if (this.autoBindOnStart) {
      this.bind();
    }
  }

  onDestroy() {
    this.unbind();
  }

  public bind() {
    if (this.isBound) {
      return;
    }

    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    this.isBound = true;
  }

  public unbind() {
    if (!this.isBound) {
      return;
    }

    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    this.isBound = false;
  }

  private onTouchStart(event: EventTouch) {
    this.touchStart.set(event.getUILocation());
  }

  private onTouchEnd(event: EventTouch) {
    const endPosition = event.getUILocation();
    const deltaX = endPosition.x - this.touchStart.x;
    const deltaY = endPosition.y - this.touchStart.y;
    const direction = this.getSwipeDirection(deltaX, deltaY);

    if (direction === null) {
      return;
    }

    if (this.stopPropagationOnSwipe) {
      event.propagationStopped = true;
    }

    this.dispatchDirection(direction);
  }

  private getSwipeDirection(deltaX: number, deltaY: number) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < this.minSwipeDistance) {
      return null;
    }

    if (absX > absY * this.directionRatio) {
      return deltaX > 0 ? ArrowDirection.Right : ArrowDirection.Left;
    }

    if (absY > absX * this.directionRatio) {
      return deltaY > 0 ? ArrowDirection.Up : ArrowDirection.Down;
    }

    return null;
  }

  private dispatchDirection(direction: ArrowDirection) {
    const controller = this.gameController ?? this.findGameController();
    if (!controller) {
      warn("SwipeDirectionInput: gameController is missing.");
      return;
    }

    controller.handleSwipeDirection(direction);
  }

  private findGameController() {
    if (!this.autoFindGameController) {
      return null;
    }

    let node: Node | null = this.node;
    while (node) {
      const controller = node.getComponent(ArrowGameController);
      if (controller) {
        this.gameController = controller;
        return controller;
      }
      node = node.parent;
    }

    return null;
  }
}
