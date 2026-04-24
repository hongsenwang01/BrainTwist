import {
  _decorator,
  Color,
  Component,
  Graphics,
  JsonAsset,
  UIOpacity,
  UITransform,
  Vec2,
  resources,
} from "cc";
import { Direction, directionToAngle } from "./Direction";

const { ccclass, property } = _decorator;

type LottieValue = number | number[] | LottiePath;

type LottieProperty = {
  a?: number;
  k?: LottieValue | LottieKeyframe[];
};

type LottieKeyframe = {
  t: number;
  s?: LottieValue;
  e?: LottieValue;
  h?: number;
};

type LottiePath = {
  c?: boolean;
  i?: number[][];
  o?: number[][];
  v?: number[][];
};

type LottieShape = {
  ty?: string;
  hd?: boolean;
  p?: LottieProperty;
  s?: LottieProperty;
  ks?: LottieProperty;
  c?: LottieProperty;
  o?: LottieProperty;
  w?: LottieProperty;
  r?: LottieProperty;
};

type LottieLayer = {
  nm?: string;
  hd?: boolean;
  ip?: number;
  op?: number;
  ks?: {
    a?: LottieProperty;
    p?: LottieProperty;
    s?: LottieProperty;
    r?: LottieProperty;
    o?: LottieProperty;
  };
  shapes?: LottieShape[];
};

type LottieData = {
  w?: number;
  h?: number;
  fr?: number;
  ip?: number;
  op?: number;
  layers?: LottieLayer[];
};

type LayerTransform = {
  position: number[];
  anchor: number[];
  scale: number[];
  rotation: number;
  opacity: number;
};

type DrawStyle = {
  color: Color;
  lineWidth?: number;
};

@ccclass("LottieArrowRenderer")
export class LottieArrowRenderer extends Component {
  @property
  public resourcePath = "animations/lottie/arrow-right-click";

  @property
  public arrowSize = 420;

  @property
  public lineWidth = 14;

  @property(Color)
  public fillColor = Color.WHITE;

  @property(Color)
  public strokeColor = Color.BLACK;

  @property
  public playFullJsonAnimation = true;

  @property
  public playbackSpeed = 1;

  private graphics: Graphics | null = null;
  private opacity: UIOpacity | null = null;
  private data: LottieData | null = null;
  private frameRate = 60;
  private inFrame = 0;
  private outFrame = 60;
  private currentFrame = 0;
  private isLoaded = false;
  private isPlaying = false;
  private onAnimationComplete: (() => void) | null = null;

  start() {
    this.prepareNode();
    this.loadJson();
  }

  update(deltaTime: number) {
    if (!this.isPlaying || !this.isLoaded) {
      return;
    }

    this.currentFrame += deltaTime * this.frameRate * this.playbackSpeed;
    if (this.currentFrame >= this.outFrame) {
      this.isPlaying = false;
      this.resetToStartFrame();

      const callback = this.onAnimationComplete;
      this.onAnimationComplete = null;
      callback?.();
      return;
    }

    this.drawFrame(this.currentFrame);
  }

  public preload(onComplete?: () => void) {
    if (this.isLoaded) {
      onComplete?.();
      return;
    }
    this.loadJson(onComplete);
  }

  public showDirection(direction: Direction) {
    this.prepareNode();
    this.node.setRotationFromEuler(0, 0, directionToAngle(direction));
    this.node.setScale(1, 1, 1);
    this.setOpacity(255);
    this.showStartFrame();
  }

  public showStartFrame() {
    this.prepareNode();
    this.setOpacity(255);
    this.currentFrame = this.inFrame;
    if (this.isLoaded) {
      this.drawFrame(this.currentFrame);
    } else {
      this.drawFallbackArrow();
    }
  }

  public playOnce(onComplete?: () => void) {
    this.preload(() => {
      if (!this.playFullJsonAnimation) {
        onComplete?.();
        return;
      }

      this.setOpacity(255);
      this.currentFrame = this.inFrame;
      this.isPlaying = true;
      this.onAnimationComplete = onComplete ?? null;
      this.drawFrame(this.currentFrame);
    });
  }

  public playClickAnimation(direction: Direction, onComplete?: () => void) {
    this.preload(() => {
      this.showDirection(direction);

      if (!this.playFullJsonAnimation) {
        onComplete?.();
        return;
      }

      this.currentFrame = this.inFrame;
      this.isPlaying = true;
      this.onAnimationComplete = onComplete ?? null;
      this.drawFrame(this.currentFrame);
    });
  }

  public getDurationSeconds() {
    return (this.outFrame - this.inFrame) / this.frameRate;
  }

  public resetToStartFrame() {
    this.currentFrame = this.inFrame;
    this.setOpacity(255);
    if (this.isLoaded) {
      this.drawFrame(this.currentFrame);
    }
  }

  private loadJson(onComplete?: () => void) {
    resources.load(this.resourcePath, JsonAsset, (error, asset) => {
      if (error || !asset) {
        console.error("[BrainTwist] Failed to load arrow JSON:", error);
        this.drawFallbackArrow();
        onComplete?.();
        return;
      }

      this.data = asset.json as LottieData;
      this.frameRate = Number(this.data.fr ?? 60);
      this.inFrame = Number(this.data.ip ?? 0);
      this.outFrame = Number(this.data.op ?? 60);
      this.currentFrame = this.inFrame;
      this.isLoaded = true;
      this.drawFrame(this.currentFrame);
      onComplete?.();
    });
  }

  private drawFrame(frame: number) {
    this.prepareNode();
    if (!this.graphics || !this.data) {
      return;
    }

    this.graphics.clear();

    const layers = this.data.layers ?? [];
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      this.drawLayer(layers[index], frame);
    }
  }

  private drawLayer(layer: LottieLayer, frame: number) {
    if (!this.graphics || layer.hd) {
      return;
    }

    const layerIn = Number(layer.ip ?? this.inFrame);
    const layerOut = Number(layer.op ?? this.outFrame);
    if (frame < layerIn || frame >= layerOut) {
      return;
    }

    const transform = this.getLayerTransform(layer, frame);
    if (transform.opacity <= 0) {
      return;
    }

    const shapes = (layer.shapes ?? []).filter((shape) => !shape.hd);
    const geometries = shapes.filter((shape) => {
      return shape.ty === "sh" || shape.ty === "el" || shape.ty === "rc";
    });
    const fillShape = shapes.find((shape) => shape.ty === "fl");
    const strokeShape = shapes.find((shape) => shape.ty === "st");

    const fillStyle = fillShape ? this.getFillStyle(fillShape, frame, transform.opacity) : null;
    const strokeStyle = strokeShape ? this.getStrokeStyle(strokeShape, frame, transform.opacity) : null;

    for (const shape of geometries) {
      if (fillStyle) {
        this.graphics.fillColor = fillStyle.color;
        this.buildShapePath(shape, frame, transform);
        this.graphics.fill();
      }

      if (strokeStyle) {
        this.graphics.strokeColor = strokeStyle.color;
        this.graphics.lineWidth = strokeStyle.lineWidth ?? this.lineWidth;
        this.buildShapePath(shape, frame, transform);
        this.graphics.stroke();
      }
    }
  }

  private buildShapePath(shape: LottieShape, frame: number, transform: LayerTransform) {
    if (!this.graphics) {
      return;
    }

    if (shape.ty === "el") {
      const center = this.getNumberArray(shape.p, frame, [0, 0]);
      const size = this.getNumberArray(shape.s, frame, [0, 0]);
      const point = this.transformPoint(center[0], center[1], transform);
      const layerScaleX = Math.abs(transform.scale[0] ?? 100) / 100;
      const layerScaleY = Math.abs(transform.scale[1] ?? 100) / 100;
      const scale = this.getRenderScale();

      this.graphics.ellipse(
        point.x,
        point.y,
        (Number(size[0] ?? 0) / 2) * layerScaleX * scale,
        (Number(size[1] ?? 0) / 2) * layerScaleY * scale,
      );
      return;
    }

    if (shape.ty === "rc") {
      const center = this.getNumberArray(shape.p, frame, [0, 0]);
      const size = this.getNumberArray(shape.s, frame, [0, 0]);
      const radius = this.getNumber(shape.r, frame, 0);
      const topLeft = this.transformPoint(
        center[0] - Number(size[0] ?? 0) / 2,
        center[1] - Number(size[1] ?? 0) / 2,
        transform,
      );
      const layerScaleX = Math.abs(transform.scale[0] ?? 100) / 100;
      const layerScaleY = Math.abs(transform.scale[1] ?? 100) / 100;
      const scale = this.getRenderScale();

      this.graphics.roundRect(
        topLeft.x,
        topLeft.y - Number(size[1] ?? 0) * layerScaleY * scale,
        Number(size[0] ?? 0) * layerScaleX * scale,
        Number(size[1] ?? 0) * layerScaleY * scale,
        radius * Math.max(layerScaleX, layerScaleY) * scale,
      );
      return;
    }

    const path = this.getPath(shape.ks, frame);
    const points = path?.v ?? [];
    if (points.length === 0) {
      return;
    }

    points.forEach((rawPoint, index) => {
      const point = this.transformPoint(Number(rawPoint[0]), Number(rawPoint[1]), transform);
      if (index === 0) {
        this.graphics?.moveTo(point.x, point.y);
      } else {
        this.graphics?.lineTo(point.x, point.y);
      }
    });

    if (path?.c) {
      this.graphics.close();
    }
  }

  private getLayerTransform(layer: LottieLayer, frame: number): LayerTransform {
    const ks = layer.ks ?? {};
    return {
      position: this.getNumberArray(ks.p, frame, [0, 0]),
      anchor: this.getNumberArray(ks.a, frame, [0, 0]),
      scale: this.getNumberArray(ks.s, frame, [100, 100]),
      rotation: this.getNumber(ks.r, frame, 0),
      opacity: this.getNumberArray(ks.o, frame, [100])[0] / 100,
    };
  }

  private transformPoint(x: number, y: number, transform: LayerTransform) {
    const layerScaleX = Number(transform.scale[0] ?? 100) / 100;
    const layerScaleY = Number(transform.scale[1] ?? 100) / 100;
    const localX = (x - Number(transform.anchor[0] ?? 0)) * layerScaleX;
    const localY = (y - Number(transform.anchor[1] ?? 0)) * layerScaleY;
    const radians = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const worldX = localX * cos - localY * sin + Number(transform.position[0] ?? 0);
    const worldY = localX * sin + localY * cos + Number(transform.position[1] ?? 0);
    const sourceWidth = Number(this.data?.w ?? 512);
    const sourceHeight = Number(this.data?.h ?? 512);
    const scale = this.getRenderScale();

    return new Vec2(
      (worldX - sourceWidth / 2) * scale,
      -(worldY - sourceHeight / 2) * scale,
    );
  }

  private getFillStyle(shape: LottieShape, frame: number, layerOpacity: number): DrawStyle {
    const color = this.getColor(shape.c, frame, this.fillColor);
    const opacity = this.getNumberArray(shape.o, frame, [100])[0] / 100;
    color.a = Math.round(255 * layerOpacity * opacity);
    return { color };
  }

  private getStrokeStyle(shape: LottieShape, frame: number, layerOpacity: number): DrawStyle {
    const color = this.getColor(shape.c, frame, this.strokeColor);
    const opacity = this.getNumberArray(shape.o, frame, [100])[0] / 100;
    const width = this.getNumber(shape.w, frame, this.lineWidth) * this.getRenderScale();
    color.a = Math.round(255 * layerOpacity * opacity);
    return {
      color,
      lineWidth: width,
    };
  }

  private getColor(property: LottieProperty | undefined, frame: number, fallback: Color) {
    const value = this.getNumberArray(property, frame, [
      fallback.r / 255,
      fallback.g / 255,
      fallback.b / 255,
      fallback.a / 255,
    ]);

    return new Color(
      Math.round(this.clamp01(Number(value[0] ?? 1)) * 255),
      Math.round(this.clamp01(Number(value[1] ?? 1)) * 255),
      Math.round(this.clamp01(Number(value[2] ?? 1)) * 255),
      Math.round(this.clamp01(Number(value[3] ?? 1)) * 255),
    );
  }

  private getNumber(property: LottieProperty | undefined, frame: number, fallback: number) {
    const value = this.sampleValue(property, frame, fallback);
    return Array.isArray(value) ? Number(value[0] ?? fallback) : Number(value);
  }

  private getNumberArray(
    property: LottieProperty | undefined,
    frame: number,
    fallback: number[],
  ) {
    const value = this.sampleValue(property, frame, fallback);
    if (Array.isArray(value)) {
      return value.map((item) => Number(item));
    }
    return [Number(value)];
  }

  private getPath(property: LottieProperty | undefined, frame: number) {
    const value = this.sampleValue(property, frame, null);
    return this.isPath(value) ? value : null;
  }

  private sampleValue(
    property: LottieProperty | undefined,
    frame: number,
    fallback: LottieValue | null,
  ): LottieValue | null {
    if (!property || property.k === undefined) {
      return fallback;
    }

    if (property.a !== 1 || !Array.isArray(property.k) || !this.isKeyframe(property.k[0])) {
      return property.k as LottieValue;
    }

    const keyframes = property.k as LottieKeyframe[];
    let current = keyframes[0];
    let next: LottieKeyframe | null = null;

    for (let index = 0; index < keyframes.length; index += 1) {
      if (frame >= keyframes[index].t) {
        current = keyframes[index];
        next = keyframes[index + 1] ?? null;
      }
    }

    const startValue = current.s ?? current.e ?? fallback;
    if (!next || current.h === 1 || startValue === null) {
      return startValue;
    }

    const endValue = next.s ?? current.e ?? startValue;
    const span = Math.max(next.t - current.t, 1);
    const progress = Math.max(0, Math.min(1, (frame - current.t) / span));

    return this.interpolateValue(startValue, endValue, progress);
  }

  private interpolateValue(start: LottieValue, end: LottieValue, progress: number): LottieValue {
    if (typeof start === "number" && typeof end === "number") {
      return start + (end - start) * progress;
    }

    if (Array.isArray(start) && Array.isArray(end)) {
      return start.map((value, index) => {
        const endValue = Number(end[index] ?? value);
        return Number(value) + (endValue - Number(value)) * progress;
      });
    }

    return start;
  }

  private drawFallbackArrow() {
    this.prepareNode();
    if (!this.graphics) {
      return;
    }

    this.graphics.clear();
    this.graphics.lineWidth = this.lineWidth;
    this.graphics.fillColor = this.fillColor;
    this.graphics.strokeColor = this.strokeColor;

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
        this.graphics?.moveTo(point.x, point.y);
      } else {
        this.graphics?.lineTo(point.x, point.y);
      }
    });
    this.graphics.close();
    this.graphics.fill();
    this.graphics.stroke();
  }

  private prepareNode() {
    let transform = this.node.getComponent(UITransform);
    if (!transform) {
      transform = this.node.addComponent(UITransform);
    }
    transform.setContentSize(this.arrowSize, this.arrowSize);

    this.graphics = this.node.getComponent(Graphics);
    if (!this.graphics) {
      this.graphics = this.node.addComponent(Graphics);
    }

    this.opacity = this.node.getComponent(UIOpacity);
    if (!this.opacity) {
      this.opacity = this.node.addComponent(UIOpacity);
    }
  }

  private setOpacity(opacity: number) {
    this.prepareNode();
    if (this.opacity) {
      this.opacity.opacity = opacity;
    }
  }

  private getRenderScale() {
    const sourceWidth = Number(this.data?.w ?? 512);
    return this.arrowSize / sourceWidth;
  }

  private clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  private isKeyframe(value: unknown): value is LottieKeyframe {
    return this.isRecord(value) && typeof value.t === "number";
  }

  private isPath(value: unknown): value is LottiePath {
    return this.isRecord(value) && Array.isArray(value.v);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
