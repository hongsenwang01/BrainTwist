import {
  _decorator,
  Component,
  Enum,
  Node,
  tween,
  Vec3,
  warn,
} from "cc";

const { ccclass, property } = _decorator;

export enum ArrowDirection {
  Up = 0,
  Down = 1,
  Left = 2,
  Right = 3,
}

Enum(ArrowDirection);

export function getOppositeArrowDirection(direction: ArrowDirection) {
  switch (direction) {
    case ArrowDirection.Up:
      return ArrowDirection.Down;
    case ArrowDirection.Down:
      return ArrowDirection.Up;
    case ArrowDirection.Left:
      return ArrowDirection.Right;
    case ArrowDirection.Right:
      return ArrowDirection.Left;
    default:
      return ArrowDirection.Down;
  }
}

type ArrowNodeOption = {
  direction: ArrowDirection;
  node: Node;
};

@ccclass("RandomArrowDisplay")
export class RandomArrowDisplay extends Component {
  @property({ type: Node, displayName: "正常上箭头节点" })
  public normalUpArrowNode: Node | null = null;

  @property({ type: Node, displayName: "正常下箭头节点" })
  public normalDownArrowNode: Node | null = null;

  @property({ type: Node, displayName: "正常左箭头节点" })
  public normalLeftArrowNode: Node | null = null;

  @property({ type: Node, displayName: "正常右箭头节点" })
  public normalRightArrowNode: Node | null = null;

  @property({ type: Node, displayName: "异常/错误上箭头节点" })
  public reverseUpArrowNode: Node | null = null;

  @property({ type: Node, displayName: "异常/错误下箭头节点" })
  public reverseDownArrowNode: Node | null = null;

  @property({ type: Node, displayName: "异常/错误左箭头节点" })
  public reverseLeftArrowNode: Node | null = null;

  @property({ type: Node, displayName: "异常/错误右箭头节点" })
  public reverseRightArrowNode: Node | null = null;

  @property({ displayName: "开始时随机显示" })
  public autoShowOnStart = true;

  @property({ displayName: "切换时播放滑动动画" })
  public animateSwitch = true;

  @property({ displayName: "滑动距离" })
  public slideDistance = 520;

  @property({ displayName: "滑出时间" })
  public slideOutDuration = 0.16;

  @property({ displayName: "滑入时间" })
  public slideInDuration = 0.18;

  private currentDirection = ArrowDirection.Right;
  private originPosition = new Vec3();
  private isAnimating = false;

  onLoad() {
    this.originPosition.set(this.node.position);
    this.hideAllArrowNodes();
  }

  start() {
    if (this.autoShowOnStart) {
      this.showRandomArrow();
    }
  }

  public showRandomArrow(
    avoidCurrentDirection = false,
    animated = this.animateSwitch,
    useReverseArrowNodes = false,
  ) {
    if (this.isAnimating) {
      return;
    }

    const options = this.getAvailableOptions(useReverseArrowNodes);
    if (options.length === 0) {
      warn("RandomArrowDisplay: no arrow Node is assigned.");
      return;
    }

    const randomOptions =
      avoidCurrentDirection && options.length > 1
        ? options.filter((option) => option.direction !== this.currentDirection)
        : options;

    const option = randomOptions[Math.floor(Math.random() * randomOptions.length)];
    this.showArrow(option.direction, animated, useReverseArrowNodes);
  }

  public showArrow(
    direction: ArrowDirection,
    animated = false,
    useReverseArrowNodes = false,
  ) {
    const arrowNode = this.getArrowNode(direction, useReverseArrowNodes);
    if (!arrowNode) {
      warn("RandomArrowDisplay: target arrow Node is missing.");
      return;
    }

    if (animated) {
      this.playSwitchAnimation(direction, arrowNode);
      return;
    }

    this.currentDirection = direction;
    this.showOnlyArrowNode(arrowNode);
    this.node.setPosition(this.originPosition);
  }

  public refreshCurrentArrow(useReverseArrowNodes = false) {
    this.showOnlyArrowNode(
      this.getArrowNode(this.currentDirection, useReverseArrowNodes),
    );
  }

  public getCurrentDirection() {
    return this.currentDirection;
  }

  public hideArrows() {
    tween(this.node).stop();
    this.isAnimating = false;
    this.node.setPosition(this.originPosition);
    this.hideAllArrowNodes();
  }

  private getAvailableOptions(useReverseArrowNodes = false): ArrowNodeOption[] {
    return [
      ArrowDirection.Up,
      ArrowDirection.Down,
      ArrowDirection.Left,
      ArrowDirection.Right,
    ]
      .map((direction) => ({
        direction,
        node: this.getArrowNode(direction, useReverseArrowNodes),
      }))
      .filter((option): option is ArrowNodeOption => Boolean(option.node));
  }

  private getArrowNode(direction: ArrowDirection, useReverseArrowNodes = false) {
    const reverseNode = this.getReverseArrowNode(direction);
    if (useReverseArrowNodes && reverseNode) {
      return reverseNode;
    }

    return this.getNormalArrowNode(direction) ?? reverseNode;
  }

  private getNormalArrowNode(direction: ArrowDirection) {
    switch (direction) {
      case ArrowDirection.Up:
        return this.normalUpArrowNode;
      case ArrowDirection.Down:
        return this.normalDownArrowNode;
      case ArrowDirection.Left:
        return this.normalLeftArrowNode;
      case ArrowDirection.Right:
        return this.normalRightArrowNode;
      default:
        return null;
    }
  }

  private getReverseArrowNode(direction: ArrowDirection) {
    switch (direction) {
      case ArrowDirection.Up:
        return this.reverseUpArrowNode;
      case ArrowDirection.Down:
        return this.reverseDownArrowNode;
      case ArrowDirection.Left:
        return this.reverseLeftArrowNode;
      case ArrowDirection.Right:
        return this.reverseRightArrowNode;
      default:
        return null;
    }
  }

  private showOnlyArrowNode(visibleNode: Node | null) {
    for (const arrowNode of this.getAllArrowNodes()) {
      if (arrowNode) {
        arrowNode.active = arrowNode === visibleNode;
      }
    }
  }

  private hideAllArrowNodes() {
    this.showOnlyArrowNode(null);
  }

  private getAllArrowNodes() {
    return [
      this.normalUpArrowNode,
      this.normalDownArrowNode,
      this.normalLeftArrowNode,
      this.normalRightArrowNode,
      this.reverseUpArrowNode,
      this.reverseDownArrowNode,
      this.reverseLeftArrowNode,
      this.reverseRightArrowNode,
    ];
  }

  private playSwitchAnimation(direction: ArrowDirection, arrowNode: Node) {
    this.isAnimating = true;
    tween(this.node).stop();

    const slideOutPosition = this.getSlideOutPosition(this.currentDirection);
    const slideInStartPosition = this.getSlideInStartPosition(direction);

    tween(this.node)
      .to(this.slideOutDuration, { position: slideOutPosition })
      .call(() => {
        this.currentDirection = direction;
        this.showOnlyArrowNode(arrowNode);
        this.node.setPosition(slideInStartPosition);
      })
      .to(this.slideInDuration, { position: this.originPosition })
      .call(() => {
        this.node.setPosition(this.originPosition);
        this.isAnimating = false;
      })
      .start();
  }

  private getSlideOutPosition(direction: ArrowDirection) {
    const offset = this.getDirectionOffset(direction);
    return new Vec3(
      this.originPosition.x + offset.x,
      this.originPosition.y + offset.y,
      this.originPosition.z,
    );
  }

  private getSlideInStartPosition(direction: ArrowDirection) {
    const offset = this.getDirectionOffset(getOppositeArrowDirection(direction));
    return new Vec3(
      this.originPosition.x + offset.x,
      this.originPosition.y + offset.y,
      this.originPosition.z,
    );
  }

  private getDirectionOffset(direction: ArrowDirection) {
    switch (direction) {
      case ArrowDirection.Up:
        return new Vec3(0, this.slideDistance, 0);
      case ArrowDirection.Down:
        return new Vec3(0, -this.slideDistance, 0);
      case ArrowDirection.Left:
        return new Vec3(-this.slideDistance, 0, 0);
      case ArrowDirection.Right:
        return new Vec3(this.slideDistance, 0, 0);
      default:
        return Vec3.ZERO;
    }
  }
}
