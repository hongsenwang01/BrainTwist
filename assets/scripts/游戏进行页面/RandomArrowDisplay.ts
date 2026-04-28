import {
  _decorator,
  Component,
  Enum,
  Sprite,
  SpriteFrame,
  tween,
  UITransform,
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

type ArrowOption = {
  direction: ArrowDirection;
  frames: SpriteFrame[];
};

@ccclass("RandomArrowDisplay")
export class RandomArrowDisplay extends Component {
  @property({ type: Sprite, displayName: "目标箭头图片" })
  public targetSprite: Sprite | null = null;

  @property({ type: [SpriteFrame], displayName: "上箭头图片列表" })
  public upArrows: SpriteFrame[] = [];

  @property({ type: [SpriteFrame], displayName: "下箭头图片列表" })
  public downArrows: SpriteFrame[] = [];

  @property({ type: [SpriteFrame], displayName: "左箭头图片列表" })
  public leftArrows: SpriteFrame[] = [];

  @property({ type: [SpriteFrame], displayName: "右箭头图片列表" })
  public rightArrows: SpriteFrame[] = [];

  @property({ displayName: "开始时随机显示" })
  public autoShowOnStart = true;

  @property({ displayName: "按方向自动设置尺寸" })
  public autoSizeByDirection = true;

  @property({ displayName: "左右箭头宽度" })
  public horizontalArrowWidth = 510;

  @property({ displayName: "左右箭头高度" })
  public horizontalArrowHeight = 510;

  @property({ displayName: "上下箭头宽度" })
  public verticalArrowWidth = 510;

  @property({ displayName: "上下箭头高度" })
  public verticalArrowHeight = 510;

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
    this.targetSprite = this.targetSprite ?? this.node.getComponent(Sprite);
    this.originPosition.set(this.node.position);
  }

  start() {
    if (this.autoShowOnStart) {
      this.showRandomArrow();
    }
  }

  public showRandomArrow(avoidCurrentDirection = false, animated = this.animateSwitch) {
    if (this.isAnimating) {
      return;
    }

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
    const spriteFrame = this.getRandomFrame(option.frames);
    if (!spriteFrame) {
      warn("RandomArrowDisplay: selected direction has no SpriteFrame.");
      return;
    }

    this.showArrow(option.direction, animated, spriteFrame);
  }

  public showArrow(
    direction: ArrowDirection,
    animated = false,
    spriteFrame = this.getRandomFrame(this.getSpriteFrames(direction)),
  ) {
    if (!this.targetSprite || !spriteFrame) {
      warn("RandomArrowDisplay: targetSprite or arrow SpriteFrame is missing.");
      return;
    }

    if (animated) {
      this.playSwitchAnimation(direction, spriteFrame);
      return;
    }

    this.currentDirection = direction;
    this.targetSprite.spriteFrame = spriteFrame;
    this.applyDirectionSize(direction);
    this.node.setPosition(this.originPosition);
  }

  public getCurrentDirection() {
    return this.currentDirection;
  }

  private getAvailableOptions(): ArrowOption[] {
    return [
      { direction: ArrowDirection.Up, frames: this.upArrows },
      { direction: ArrowDirection.Down, frames: this.downArrows },
      { direction: ArrowDirection.Left, frames: this.leftArrows },
      { direction: ArrowDirection.Right, frames: this.rightArrows },
    ].filter((option) => option.frames.length > 0);
  }

  private getSpriteFrames(direction: ArrowDirection) {
    switch (direction) {
      case ArrowDirection.Up:
        return this.upArrows;
      case ArrowDirection.Down:
        return this.downArrows;
      case ArrowDirection.Left:
        return this.leftArrows;
      case ArrowDirection.Right:
        return this.rightArrows;
      default:
        return [];
    }
  }

  private playSwitchAnimation(direction: ArrowDirection, spriteFrame: SpriteFrame) {
    if (!this.targetSprite) {
      return;
    }

    this.isAnimating = true;
    tween(this.node).stop();

    const slideOutPosition = this.getSlideOutPosition(this.currentDirection);
    const slideInStartPosition = this.getSlideInStartPosition(direction);

    tween(this.node)
      .to(this.slideOutDuration, { position: slideOutPosition })
      .call(() => {
        if (this.targetSprite) {
          this.targetSprite.spriteFrame = spriteFrame;
        }
        this.currentDirection = direction;
        this.applyDirectionSize(direction);
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

  private applyDirectionSize(direction: ArrowDirection) {
    if (!this.autoSizeByDirection) {
      return;
    }

    const transform = this.node.getComponent(UITransform);
    if (!transform) {
      return;
    }

    if (direction === ArrowDirection.Left || direction === ArrowDirection.Right) {
      transform.setContentSize(this.horizontalArrowWidth, this.horizontalArrowHeight);
      return;
    }

    transform.setContentSize(this.verticalArrowWidth, this.verticalArrowHeight);
  }

  private getRandomFrame(frames: SpriteFrame[]) {
    if (frames.length === 0) {
      return null;
    }

    return frames[Math.floor(Math.random() * frames.length)];
  }
}
