import {
  _decorator,
  Color,
  Component,
  isValid,
  Label,
  Node,
  Tween,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;
type FlyState = { progress: number };

@ccclass("ScoreGainPopup")
export class ScoreGainPopup extends Component {
  @property({ type: Node, displayName: "显示父节点" })
  public displayParent: Node | null = null;

  @property({ displayName: "起始偏移X" })
  public startOffsetX = 0;

  @property({ displayName: "起始偏移Y" })
  public startOffsetY = 0;

  @property({ type: [Node], displayName: "随机起点节点列表" })
  public startPointNodes: Node[] = [];

  @property({ displayName: "起点随机半径" })
  public startRandomRadius = 0;

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

  @property({ type: [Color], displayName: "随机字体颜色列表" })
  public randomFontColors: Color[] = [];

  @property({ displayName: "加分前缀" })
  public prefix = "+";

  @property({ displayName: "加分后缀" })
  public suffix = "";

  @property({ displayName: "飞向目标节点" })
  public flyToTarget = false;

  @property({ type: Node, displayName: "目标节点" })
  public targetNode: Node | null = null;

  @property({ displayName: "弧线高度" })
  public arcHeight = 140;

  @property({ displayName: "飞行时间" })
  public flyDuration = 0.45;

  @property({ displayName: "到达目标缩放" })
  public targetScale = 0.45;

  private activePopupNodes: Node[] = [];
  private activeOpacities: UIOpacity[] = [];
  private activeFlyStates: FlyState[] = [];

  onDisable() {
    this.stopAll();
  }

  onDestroy() {
    this.stopAll();
  }

  public stopAll() {
    const flyStates = this.getActiveFlyStates();
    const opacities = this.getActiveOpacities();
    const popupNodes = this.getActivePopupNodes();

    for (let i = 0; i < flyStates.length; i += 1) {
      const flyState = flyStates[i];
      Tween.stopAllByTarget(flyState);
    }

    for (let i = 0; i < opacities.length; i += 1) {
      const opacity = opacities[i];
      if (isValid(opacity, true)) {
        Tween.stopAllByTarget(opacity);
      }
    }

    for (let i = 0; i < popupNodes.length; i += 1) {
      const popupNode = popupNodes[i];
      if (isValid(popupNode, true)) {
        Tween.stopAllByTarget(popupNode);
        popupNode.destroy();
      }
    }

    this.activeFlyStates = [];
    this.activeOpacities = [];
    this.activePopupNodes = [];
  }

  public play(scoreGain: number, onComplete?: () => void) {
    const safeScoreGain = Math.max(0, Math.floor(scoreGain));
    if (safeScoreGain <= 0) {
      return;
    }

    const popupNode = this.createPopupNode(`${this.prefix}${safeScoreGain}${this.suffix}`);
    const opacity = popupNode.getComponent(UIOpacity)!;
    const startPosition = this.getStartLocalPosition(popupNode.parent!);

    this.trackPopup(popupNode, opacity);
    popupNode.setPosition(startPosition);
    popupNode.setScale(this.startScale, this.startScale, 1);
    opacity.opacity = 0;

    if (this.flyToTarget && this.targetNode) {
      this.playFlyToTarget(popupNode, opacity, startPosition, onComplete);
      return;
    }

    this.playFloatAndFade(popupNode, opacity, startPosition, onComplete);
  }

  private playFloatAndFade(
    popupNode: Node,
    opacity: UIOpacity,
    startPosition: Vec3,
    onComplete?: () => void,
  ) {
    const endPosition = new Vec3(
      startPosition.x,
      startPosition.y + this.riseDistance,
      startPosition.z,
    );

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
      .call(() => {
        this.finishPopup(popupNode, opacity);
        onComplete?.();
      })
      .start();
  }

  private playFlyToTarget(
    popupNode: Node,
    opacity: UIOpacity,
    startPosition: Vec3,
    onComplete?: () => void,
  ) {
    const settleDuration = 0.08;
    const targetPosition = this.getTargetLocalPosition(popupNode.parent!, this.targetNode!);
    const controlPosition = new Vec3(
      (startPosition.x + targetPosition.x) * 0.5,
      Math.max(startPosition.y, targetPosition.y) + this.arcHeight,
      startPosition.z,
    );
    const flyState = { progress: 0 };
    this.getActiveFlyStates().push(flyState);

    tween(opacity)
      .to(this.fadeInDuration, { opacity: 255 })
      .delay(settleDuration + this.stayDuration)
      .to(this.flyDuration, { opacity: 0 })
      .start();

    tween(popupNode)
      .to(
        this.fadeInDuration,
        { scale: new Vec3(this.showScale, this.showScale, 1) },
        { easing: "backOut" },
      )
      .to(
        settleDuration,
        { scale: new Vec3(this.settleScale, this.settleScale, 1) },
        { easing: "sineOut" },
      )
      .delay(this.stayDuration)
      .to(
        this.flyDuration,
        { scale: new Vec3(this.targetScale, this.targetScale, 1) },
        { easing: "sineIn" },
      )
      .start();

    tween(flyState)
      .delay(this.fadeInDuration + settleDuration + this.stayDuration)
      .to(
        this.flyDuration,
        { progress: 1 },
        {
          easing: "sineInOut",
          onUpdate: () => {
            if (!isValid(popupNode, true) || !popupNode.parent) {
              Tween.stopAllByTarget(flyState);
              return;
            }

            popupNode.setPosition(
              this.getQuadraticBezierPoint(
                startPosition,
                controlPosition,
                targetPosition,
                flyState.progress,
              ),
            );
          },
        },
      )
      .call(() => {
        this.untrackFlyState(flyState);
        this.finishPopup(popupNode, opacity);
        onComplete?.();
      })
      .start();
  }

  private trackPopup(popupNode: Node, opacity: UIOpacity) {
    this.getActivePopupNodes().push(popupNode);
    this.getActiveOpacities().push(opacity);
  }

  private finishPopup(popupNode: Node, opacity: UIOpacity) {
    this.untrackNode(popupNode);
    this.untrackOpacity(opacity);

    if (isValid(opacity, true)) {
      Tween.stopAllByTarget(opacity);
    }

    if (isValid(popupNode, true)) {
      Tween.stopAllByTarget(popupNode);
      popupNode.destroy();
    }
  }

  private untrackNode(node: Node) {
    const index = this.getActivePopupNodes().indexOf(node);
    if (index >= 0) {
      this.activePopupNodes.splice(index, 1);
    }
  }

  private untrackOpacity(opacity: UIOpacity) {
    const index = this.getActiveOpacities().indexOf(opacity);
    if (index >= 0) {
      this.activeOpacities.splice(index, 1);
    }
  }

  private untrackFlyState(flyState: FlyState) {
    const index = this.getActiveFlyStates().indexOf(flyState);
    if (index >= 0) {
      this.activeFlyStates.splice(index, 1);
    }
  }

  private getActivePopupNodes() {
    if (!Array.isArray(this.activePopupNodes)) {
      this.activePopupNodes = [];
    }

    return this.activePopupNodes;
  }

  private getActiveOpacities() {
    if (!Array.isArray(this.activeOpacities)) {
      this.activeOpacities = [];
    }

    return this.activeOpacities;
  }

  private getActiveFlyStates() {
    if (!Array.isArray(this.activeFlyStates)) {
      this.activeFlyStates = [];
    }

    return this.activeFlyStates;
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
    label.color = this.getRandomFontColor();
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = true;
    label.enableWrapText = false;

    popupNode.addComponent(UIOpacity);
    return popupNode;
  }

  private getTargetLocalPosition(parent: Node, target: Node) {
    const parentTransform = parent.getComponent(UITransform);
    if (parentTransform) {
      return parentTransform.convertToNodeSpaceAR(target.worldPosition);
    }

    return target.position.clone();
  }

  private getStartLocalPosition(parent: Node) {
    const validStartPoints = this.getValidStartPointNodes();
    const basePosition =
      validStartPoints.length > 0
        ? this.getTargetLocalPosition(
            parent,
            validStartPoints[Math.floor(Math.random() * validStartPoints.length)],
          )
        : new Vec3(this.startOffsetX, this.startOffsetY, 0);

    if (this.startRandomRadius <= 0) {
      return basePosition;
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * this.startRandomRadius;
    basePosition.x += Math.cos(angle) * distance;
    basePosition.y += Math.sin(angle) * distance;
    return basePosition;
  }

  private getValidStartPointNodes() {
    if (!Array.isArray(this.startPointNodes)) {
      this.startPointNodes = [];
    }

    return this.startPointNodes.filter((node) => isValid(node, true));
  }

  private getRandomFontColor() {
    const colors = this.getRandomFontColors();
    const sourceColor =
      colors.length > 0
        ? colors[Math.floor(Math.random() * colors.length)]
        : this.fontColor;

    return new Color(
      sourceColor.r,
      sourceColor.g,
      sourceColor.b,
      sourceColor.a,
    );
  }

  private getRandomFontColors() {
    if (!Array.isArray(this.randomFontColors)) {
      this.randomFontColors = [];
    }

    return this.randomFontColors;
  }

  private getQuadraticBezierPoint(
    start: Vec3,
    control: Vec3,
    end: Vec3,
    progress: number,
  ) {
    const t = Math.max(0, Math.min(1, progress));
    const oneMinusT = 1 - t;
    return new Vec3(
      oneMinusT * oneMinusT * start.x +
        2 * oneMinusT * t * control.x +
        t * t * end.x,
      oneMinusT * oneMinusT * start.y +
        2 * oneMinusT * t * control.y +
        t * t * end.y,
      start.z,
    );
  }
}
