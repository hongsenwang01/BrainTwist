import { _decorator, Component, Node, tween, UIOpacity, Vec3 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("StaggerEnterAnimation")
export class StaggerEnterAnimation extends Component {
  @property({ type: [Node], displayName: "目标节点列表" })
  public targetNodes: Node[] = [];

  @property({ displayName: "使用子节点作为目标" })
  public useChildrenWhenEmpty = true;

  @property({ displayName: "进入场景自动播放" })
  public autoPlayOnStart = true;

  @property({ displayName: "整体开始延迟" })
  public startDelay = 0;

  @property({ displayName: "单个节点间隔" })
  public itemDelay = 0.12;

  @property({ displayName: "单个动画时长" })
  public duration = 0.35;

  @property({ displayName: "初始缩放" })
  public startScale = 0.86;

  @property({ displayName: "回弹缩放" })
  public overshootScale = 1.08;

  @property({ displayName: "起始偏移Y" })
  public startOffsetY = -24;

  @property({ displayName: "淡入" })
  public fadeIn = true;

  @property({ displayName: "播放前激活节点" })
  public activateBeforePlay = true;

  start() {
    if (this.autoPlayOnStart) {
      this.play();
    }
  }

  public play() {
    const targets = this.getTargets();

    targets.forEach((target, index) => {
      if (!target) {
        return;
      }

      if (this.activateBeforePlay) {
        target.active = true;
      }

      const originPosition = target.position.clone();
      const originScale = target.scale.clone();
      const startPosition = new Vec3(
        originPosition.x,
        originPosition.y + this.startOffsetY,
        originPosition.z,
      );
      const startScale = this.createScaledVec(originScale, this.startScale);
      const peakScale = this.createScaledVec(originScale, this.overshootScale);
      const delay = Math.max(0, this.startDelay + index * this.itemDelay);

      tween(target).stop();
      target.setPosition(startPosition);
      target.setScale(startScale);

      const opacity = this.fadeIn ? this.getOrCreateOpacity(target) : null;
      if (opacity) {
        tween(opacity).stop();
        opacity.opacity = 0;
      }

      const moveTween = tween()
        .to(this.duration, { position: originPosition }, { easing: "backOut" });
      const scaleTween = tween()
        .to(this.duration * 0.65, { scale: peakScale }, { easing: "backOut" })
        .to(this.duration * 0.35, { scale: originScale }, { easing: "sineOut" });

      tween(target)
        .delay(delay)
        .parallel(moveTween, scaleTween)
        .call(() => {
          target.setPosition(originPosition);
          target.setScale(originScale);
        })
        .start();

      if (opacity) {
        tween(opacity).delay(delay).to(this.duration, { opacity: 255 }).start();
      }
    });
  }

  public stop(restoreOpacity = true) {
    this.getTargets().forEach((target) => {
      tween(target).stop();
      const opacity = target.getComponent(UIOpacity);
      if (opacity) {
        tween(opacity).stop();
        if (restoreOpacity) {
          opacity.opacity = 255;
        }
      }
    });
  }

  private getTargets() {
    if (this.targetNodes.length > 0) {
      return this.targetNodes;
    }

    if (this.useChildrenWhenEmpty) {
      return this.node.children;
    }

    return [];
  }

  private getOrCreateOpacity(target: Node) {
    let opacity = target.getComponent(UIOpacity);
    if (!opacity) {
      opacity = target.addComponent(UIOpacity);
    }
    return opacity;
  }

  private createScaledVec(scale: Vec3, multiplier: number) {
    return new Vec3(scale.x * multiplier, scale.y * multiplier, scale.z);
  }
}
