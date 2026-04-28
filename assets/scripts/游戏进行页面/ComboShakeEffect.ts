import { _decorator, Component, tween, Vec3 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("ComboShakeEffect")
export class ComboShakeEffect extends Component {
  @property({ displayName: "震动距离" })
  public shakeDistance = 8;

  @property({ displayName: "单段震动时间" })
  public stepDuration = 0.035;

  @property({ displayName: "放大倍率" })
  public scaleUp = 1.08;

  private originPosition = new Vec3();
  private originScale = new Vec3();

  onLoad() {
    this.recordOrigin();
  }

  public play() {
    this.recordOrigin();
    tween(this.node).stop();

    const left = new Vec3(
      this.originPosition.x - this.shakeDistance,
      this.originPosition.y,
      this.originPosition.z,
    );
    const right = new Vec3(
      this.originPosition.x + this.shakeDistance,
      this.originPosition.y,
      this.originPosition.z,
    );
    const up = new Vec3(
      this.originPosition.x,
      this.originPosition.y + this.shakeDistance * 0.5,
      this.originPosition.z,
    );
    const popScale = new Vec3(
      this.originScale.x * this.scaleUp,
      this.originScale.y * this.scaleUp,
      this.originScale.z,
    );

    tween(this.node)
      .parallel(
        tween()
          .to(this.stepDuration, { scale: popScale })
          .to(this.stepDuration * 2, { scale: this.originScale }),
        tween()
          .to(this.stepDuration, { position: left })
          .to(this.stepDuration, { position: right })
          .to(this.stepDuration, { position: up })
          .to(this.stepDuration, { position: this.originPosition }),
      )
      .call(() => {
        this.node.setPosition(this.originPosition);
        this.node.setScale(this.originScale);
      })
      .start();
  }

  private recordOrigin() {
    this.originPosition.set(this.node.position);
    this.originScale.set(this.node.scale);
  }
}
