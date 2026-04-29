import {
  _decorator,
  Color,
  Component,
  Label,
  Node,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("ScoreGainPopup")
export class ScoreGainPopup extends Component {
  @property({ type: Node, displayName: "显示父节点" })
  public displayParent: Node | null = null;

  @property({ displayName: "起始偏移X" })
  public startOffsetX = 0;

  @property({ displayName: "起始偏移Y" })
  public startOffsetY = 0;

  @property({ displayName: "上升距离" })
  public riseDistance = 48;

  @property({ displayName: "淡入时间" })
  public fadeInDuration = 0.08;

  @property({ displayName: "停留时间" })
  public stayDuration = 0.18;

  @property({ displayName: "淡出上升时间" })
  public fadeOutDuration = 0.32;

  @property({ displayName: "起始缩放" })
  public startScale = 0.82;

  @property({ displayName: "出现缩放" })
  public showScale = 1.18;

  @property({ displayName: "停留缩放" })
  public settleScale = 1;

  @property({ displayName: "字体大小" })
  public fontSize = 48;

  @property({ displayName: "行高" })
  public lineHeight = 54;

  @property({ displayName: "字体颜色" })
  public fontColor = new Color(255, 226, 84, 255);

  @property({ displayName: "加分前缀" })
  public prefix = "+";

  @property({ displayName: "加分后缀" })
  public suffix = "";

  public play(scoreGain: number) {
    const safeScoreGain = Math.max(0, Math.floor(scoreGain));
    if (safeScoreGain <= 0) {
      return;
    }

    const popupNode = this.createPopupNode(`${this.prefix}${safeScoreGain}${this.suffix}`);
    const opacity = popupNode.getComponent(UIOpacity)!;
    const startPosition = new Vec3(this.startOffsetX, this.startOffsetY, 0);
    const endPosition = new Vec3(
      this.startOffsetX,
      this.startOffsetY + this.riseDistance,
      0,
    );

    popupNode.setPosition(startPosition);
    popupNode.setScale(this.startScale, this.startScale, 1);
    opacity.opacity = 0;

    tween(opacity)
      .to(this.fadeInDuration, { opacity: 255 })
      .delay(this.stayDuration)
      .to(this.fadeOutDuration, { opacity: 0 })
      .start();

    tween(popupNode)
      .to(
        this.fadeInDuration,
        { scale: new Vec3(this.showScale, this.showScale, 1) },
        { easing: "backOut" },
      )
      .to(
        0.08,
        { scale: new Vec3(this.settleScale, this.settleScale, 1) },
        { easing: "sineOut" },
      )
      .delay(this.stayDuration)
      .to(
        this.fadeOutDuration,
        {
          position: endPosition,
          scale: new Vec3(this.settleScale, this.settleScale, 1),
        },
        { easing: "sineIn" },
      )
      .call(() => popupNode.destroy())
      .start();
  }

  private createPopupNode(text: string) {
    const popupNode = new Node("加分提示");
    popupNode.parent = this.displayParent ?? this.node;
    popupNode.setSiblingIndex(popupNode.parent.children.length - 1);

    const transform = popupNode.addComponent(UITransform);
    transform.setContentSize(160, this.lineHeight);

    const label = popupNode.addComponent(Label);
    label.string = text;
    label.fontSize = this.fontSize;
    label.lineHeight = this.lineHeight;
    label.color = new Color(
      this.fontColor.r,
      this.fontColor.g,
      this.fontColor.b,
      this.fontColor.a,
    );
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = true;
    label.enableWrapText = false;

    popupNode.addComponent(UIOpacity);
    return popupNode;
  }
}
