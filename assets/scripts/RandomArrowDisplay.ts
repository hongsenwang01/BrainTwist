import { _decorator, Component, Enum, log, Sprite, SpriteFrame, warn } from "cc";

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

type ArrowOption = {
  direction: ArrowDirection;
  frame: SpriteFrame | null;
};

@ccclass("RandomArrowDisplay")
export class RandomArrowDisplay extends Component {
  @property(Sprite)
  public targetSprite: Sprite | null = null;

  @property(SpriteFrame)
  public upArrow: SpriteFrame | null = null;

  @property(SpriteFrame)
  public downArrow: SpriteFrame | null = null;

  @property(SpriteFrame)
  public leftArrow: SpriteFrame | null = null;

  @property(SpriteFrame)
  public rightArrow: SpriteFrame | null = null;

  @property
  public autoShowOnStart = true;

  private currentDirection = ArrowDirection.Right;

  onLoad() {
    this.targetSprite = this.targetSprite ?? this.node.getComponent(Sprite);
  }

  start() {
    if (this.autoShowOnStart) {
      this.showRandomArrow();
    }
  }

  public showRandomArrow(avoidCurrentDirection = false) {
    const options = this.getAvailableOptions();
    if (options.length === 0) {
      warn("RandomArrowDisplay: no arrow SpriteFrame is assigned.");
      return;
    }

    const randomOptions =
      avoidCurrentDirection && options.length > 1
        ? options.filter((option) => option.direction !== this.currentDirection)
        : options;

    const option = randomOptions[Math.floor(Math.random() * randomOptions.length)];
    this.showArrow(option.direction);
  }

  public showArrow(direction: ArrowDirection) {
    const spriteFrame = this.getSpriteFrame(direction);
    if (!this.targetSprite || !spriteFrame) {
      warn("RandomArrowDisplay: targetSprite or arrow SpriteFrame is missing.");
      return;
    }

    this.currentDirection = direction;
    this.targetSprite.spriteFrame = spriteFrame;
    log(`RandomArrowDisplay: show ${ArrowDirection[direction]}.`);
  }

  public getCurrentDirection() {
    return this.currentDirection;
  }

  private getAvailableOptions(): ArrowOption[] {
    return [
      { direction: ArrowDirection.Up, frame: this.upArrow },
      { direction: ArrowDirection.Down, frame: this.downArrow },
      { direction: ArrowDirection.Left, frame: this.leftArrow },
      { direction: ArrowDirection.Right, frame: this.rightArrow },
    ].filter((option) => option.frame);
  }

  private getSpriteFrame(direction: ArrowDirection) {
    switch (direction) {
      case ArrowDirection.Up:
        return this.upArrow;
      case ArrowDirection.Down:
        return this.downArrow;
      case ArrowDirection.Left:
        return this.leftArrow;
      case ArrowDirection.Right:
        return this.rightArrow;
      default:
        return null;
    }
  }
}
