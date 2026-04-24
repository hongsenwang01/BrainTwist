import {
  _decorator,
  Color,
  Component,
  Graphics,
  JsonAsset,
  Label,
  Node,
  ResolutionPolicy,
  UITransform,
  Vec2,
  Vec3,
  view,
  resources,
} from "cc";

const { ccclass } = _decorator;

type LottiePath = {
  c: boolean;
  v: number[][];
};

@ccclass("MobileArrowPreview")
export class MobileArrowPreview extends Component {
  private readonly designWidth = 750;
  private readonly designHeight = 1334;
  private readonly lottiePath = "animations/lottie/arrow-right-click";

  start() {
    this.setupMobileCanvas();
    this.loadArrowJson();
  }

  private setupMobileCanvas() {
    view.setDesignResolutionSize(
      this.designWidth,
      this.designHeight,
      ResolutionPolicy.FIXED_WIDTH,
    );

    const transform = this.node.getComponent(UITransform);
    transform?.setContentSize(this.designWidth, this.designHeight);
    this.node.setPosition(this.designWidth / 2, this.designHeight / 2, 0);
  }

  private loadArrowJson() {
    resources.load(this.lottiePath, JsonAsset, (error, asset) => {
      if (error || !asset) {
        this.showStatus("arrow-right-click.json load failed");
        console.error("[BrainTwist] Failed to load arrow JSON:", error);
        return;
      }

      this.drawArrow(asset.json as Record<string, unknown>);
      this.showStatus("arrow-right-click.json loaded");
    });
  }

  private drawArrow(data: Record<string, unknown>) {
    const preview = this.getOrCreateChild("ArrowJsonPreview");
    preview.setPosition(0, 150, 0);

    let transform = preview.getComponent(UITransform);
    if (!transform) {
      transform = preview.addComponent(UITransform);
    }
    transform.setContentSize(420, 420);

    let graphics = preview.getComponent(Graphics);
    if (!graphics) {
      graphics = preview.addComponent(Graphics);
    }

    const points = this.extractArrowPoints(data);
    graphics.clear();
    graphics.lineWidth = 14;
    graphics.strokeColor = Color.BLACK;
    graphics.fillColor = Color.WHITE;

    if (points.length === 0) {
      this.drawFallbackArrow(graphics);
      return;
    }

    const scale = 1.45;
    const offset = new Vec2(-10, 0);
    points.forEach((point, index) => {
      const x = point.x * scale + offset.x;
      const y = -point.y * scale + offset.y;

      if (index === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    });
    graphics.close();
    graphics.fill();
    graphics.stroke();
  }

  private extractArrowPoints(data: Record<string, unknown>): Vec2[] {
    const layers = data.layers;
    if (!Array.isArray(layers)) {
      return [];
    }

    const arrowLayer = layers.find((layer) => {
      if (!this.isRecord(layer)) {
        return false;
      }
      return String(layer.nm ?? "").includes("arrow body");
    });

    if (!this.isRecord(arrowLayer) || !Array.isArray(arrowLayer.shapes)) {
      return [];
    }

    const pathShape = arrowLayer.shapes.find((shape) => {
      return this.isRecord(shape) && shape.ty === "sh";
    });

    if (!this.isRecord(pathShape) || !this.isRecord(pathShape.ks)) {
      return [];
    }

    const path = pathShape.ks.k as LottiePath | undefined;
    if (!path || !Array.isArray(path.v)) {
      return [];
    }

    return path.v
      .filter((point) => Array.isArray(point) && point.length >= 2)
      .map((point) => new Vec2(Number(point[0]), Number(point[1])));
  }

  private drawFallbackArrow(graphics: Graphics) {
    const points = [
      new Vec2(-140, -45),
      new Vec2(40, -45),
      new Vec2(40, -90),
      new Vec2(150, 0),
      new Vec2(40, 90),
      new Vec2(40, 45),
      new Vec2(-140, 45),
    ];

    points.forEach((point, index) => {
      if (index === 0) {
        graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(point.x, point.y);
      }
    });
    graphics.close();
    graphics.fill();
    graphics.stroke();
  }

  private showStatus(text: string) {
    const status = this.getOrCreateChild("JsonLoadStatus");
    status.setPosition(0, -160, 0);

    let transform = status.getComponent(UITransform);
    if (!transform) {
      transform = status.addComponent(UITransform);
    }
    transform.setContentSize(520, 80);

    let label = status.getComponent(Label);
    if (!label) {
      label = status.addComponent(Label);
    }
    label.string = text;
    label.fontSize = 28;
    label.lineHeight = 34;
    label.color = Color.WHITE;
  }

  private getOrCreateChild(name: string) {
    const existing = this.node.getChildByName(name);
    if (existing) {
      return existing;
    }

    const child = new Node(name);
    child.setPosition(Vec3.ZERO);
    child.parent = this.node;
    return child;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
