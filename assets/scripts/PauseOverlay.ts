import {
  _decorator,
  BlockInputEvents,
  Color,
  Component,
  Graphics,
  Node,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("PauseOverlay")
export class PauseOverlay extends Component {
  @property({ type: Node, displayName: "背景遮罩节点" })
  public maskNode: Node | null = null;

  @property({ type: Node, displayName: "弹窗内容节点" })
  public popupNode: Node | null = null;

  @property({ displayName: "开始时隐藏" })
  public hideOnLoad = true;

  @property({ displayName: "显示时淡入" })
  public fadeInDuration = 0.15;

  @property({ displayName: "隐藏时淡出" })
  public fadeOutDuration = 0.12;

  @property({ displayName: "遮罩透明度" })
  public maskOpacity = 170;

  @property({ displayName: "弹窗透明度" })
  public popupOpacity = 255;

  @property({ displayName: "弹窗初始缩放" })
  public popupStartScale = 0.92;

  @property({ displayName: "弹窗显示缩放" })
  public popupShowScale = 1;

  private opacity: UIOpacity | null = null;
  private popupOpacityComponent: UIOpacity | null = null;
  private maskGraphics: Graphics | null = null;
  private maskAlphaState = { value: 0 };

  onLoad() {
    this.setup();

    if (this.hideOnLoad) {
      this.node.active = false;
    }
  }

  public show() {
    this.setup();
    this.node.active = true;

    if (this.opacity) {
      tween(this.opacity).stop();
      this.opacity.opacity = 255;
    }

    if (this.popupNode) {
      tween(this.popupNode).stop();
      if (this.popupOpacityComponent) {
        tween(this.popupOpacityComponent).stop();
        this.popupOpacityComponent.opacity = 0;
        tween(this.popupOpacityComponent)
          .to(this.fadeInDuration, { opacity: this.popupOpacity })
          .start();
      }
      this.popupNode.setScale(this.popupStartScale, this.popupStartScale, 1);
      tween(this.popupNode)
        .to(this.fadeInDuration, {
          scale: new Vec3(this.popupShowScale, this.popupShowScale, 1),
        })
        .start();
    }

    if (this.maskGraphics) {
      tween(this.maskAlphaState).stop();
      this.maskAlphaState.value = 0;
      this.drawMask(0);
      tween(this.maskAlphaState)
        .to(
          this.fadeInDuration,
          { value: this.maskOpacity },
          {
            onUpdate: () => this.drawMask(this.maskAlphaState.value),
          },
        )
        .start();
    }
  }

  public hide() {
    this.setup();

    if (this.opacity) {
      tween(this.opacity).stop();
      this.opacity.opacity = 255;
    }

    if (this.maskGraphics) {
      tween(this.maskAlphaState).stop();
      tween(this.maskAlphaState)
        .to(
          this.fadeOutDuration,
          { value: 0 },
          {
            onUpdate: () => this.drawMask(this.maskAlphaState.value),
          },
        )
        .start();
    }

    if (this.popupOpacityComponent) {
      tween(this.popupOpacityComponent).stop();
      tween(this.popupOpacityComponent)
        .to(this.fadeOutDuration, { opacity: 0 })
        .call(() => {
          this.node.active = false;
        })
        .start();
      return;
    }

    this.node.active = false;
  }

  private setup() {
    if (!this.opacity) {
      this.opacity = this.node.getComponent(UIOpacity);
      if (!this.opacity) {
        this.opacity = this.node.addComponent(UIOpacity);
      }
    }

    if (!this.node.getComponent(BlockInputEvents)) {
      this.node.addComponent(BlockInputEvents);
    }

    if (!this.maskNode) {
      this.maskNode = this.createDefaultMaskNode();
    }

    if (this.maskNode && !this.maskGraphics) {
      this.maskGraphics = this.maskNode.getComponent(Graphics);
      if (!this.maskGraphics) {
        this.maskGraphics = this.maskNode.addComponent(Graphics);
      }
      this.drawMask(0);
    }

    if (this.popupNode && !this.popupOpacityComponent) {
      this.popupOpacityComponent = this.popupNode.getComponent(UIOpacity);
      if (!this.popupOpacityComponent) {
        this.popupOpacityComponent = this.popupNode.addComponent(UIOpacity);
      }
    }
  }

  private createDefaultMaskNode() {
    const mask = new Node("背景遮罩");
    mask.parent = this.node;
    mask.setSiblingIndex(0);

    const parentTransform = this.node.getComponent(UITransform);
    const width = parentTransform?.width || 750;
    const height = parentTransform?.height || 1334;

    const transform = mask.addComponent(UITransform);
    transform.setContentSize(width, height);
    mask.setPosition(0, 0, 0);

    const graphics = mask.addComponent(Graphics);
    this.maskGraphics = graphics;
    this.drawMask(0);

    return mask;
  }

  private drawMask(alpha: number) {
    if (!this.maskGraphics || !this.maskNode) {
      return;
    }

    const transform = this.maskNode.getComponent(UITransform);
    const width = transform?.width || 750;
    const height = transform?.height || 1334;

    this.maskGraphics.clear();
    this.maskGraphics.fillColor = new Color(0, 0, 0, Math.max(0, Math.min(255, alpha)));
    this.maskGraphics.rect(-width * 0.5, -height * 0.5, width, height);
    this.maskGraphics.fill();
  }
}
