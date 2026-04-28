import { _decorator, Color, Component, Graphics, Vec2 } from "cc";

const { ccclass, property, executeInEditMode } = _decorator;

@ccclass("GraphicsDot")
@executeInEditMode(true)
export class GraphicsDot extends Component {
  @property({ displayName: "圆点半径" })
  public radius = 6;

  @property({ displayName: "圆点位置 X" })
  public offsetX = 0;

  @property({ displayName: "圆点位置 Y" })
  public offsetY = 0;

  @property({ displayName: "圆点颜色" })
  public color = new Color(255, 255, 255, 255);

  private lastRadius = Number.NaN;
  private lastOffset = new Vec2(Number.NaN, Number.NaN);
  private lastColor = new Color();

  onLoad() {
    this.draw();
  }

  start() {
    this.draw();
  }

  update() {
    if (this.hasChanged()) {
      this.draw();
    }
  }

  public draw() {
    const graphics = this.getOrCreateGraphics();
    graphics.clear();
    graphics.fillColor = this.color;
    graphics.circle(this.offsetX, this.offsetY, Math.max(0, this.radius));
    graphics.fill();

    this.lastRadius = this.radius;
    this.lastOffset.set(this.offsetX, this.offsetY);
    this.lastColor.set(this.color);
  }

  private getOrCreateGraphics() {
    let graphics = this.node.getComponent(Graphics);
    if (!graphics) {
      graphics = this.node.addComponent(Graphics);
    }
    return graphics;
  }

  private hasChanged() {
    return (
      this.radius !== this.lastRadius ||
      this.offsetX !== this.lastOffset.x ||
      this.offsetY !== this.lastOffset.y ||
      !this.lastColor.equals(this.color)
    );
  }
}
