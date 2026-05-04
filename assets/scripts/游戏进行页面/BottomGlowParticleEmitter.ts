import {
  _decorator,
  Color,
  Component,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  UIOpacity,
  UITransform,
  Vec2,
  Vec3,
  warn,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("BottomGlowParticleEmitter")
export class BottomGlowParticleEmitter extends Component {
  @property({ type: SpriteFrame, displayName: "粒子贴图" })
  public particleSpriteFrame: SpriteFrame | null = null;

  @property({ type: Node, displayName: "粒子父节点" })
  public particleParent: Node | null = null;

  @property({ displayName: "启动后自动播放" })
  public playOnStart = true;

  @property({ displayName: "每秒生成数量" })
  public spawnPerSecond = 8;

  @property({ displayName: "最大粒子数量" })
  public maxParticles = 90;

  @property({ displayName: "生成区域宽度" })
  public spawnWidth = 700;

  @property({ displayName: "底部起始Y" })
  public bottomY = -610;

  @property({ displayName: "最小上升距离" })
  public minRiseDistance = 220;

  @property({ displayName: "最大上升距离" })
  public maxRiseDistance = 620;

  @property({ displayName: "水平飘动范围" })
  public horizontalDrift = 80;

  @property({ displayName: "最小生命周期" })
  public minLifeTime = 1.1;

  @property({ displayName: "最大生命周期" })
  public maxLifeTime = 2.4;

  @property({ displayName: "最小尺寸" })
  public minSize = 8;

  @property({ displayName: "最大尺寸" })
  public maxSize = 26;

  @property({ displayName: "最小透明度" })
  public minOpacity = 120;

  @property({ displayName: "最大透明度" })
  public maxOpacity = 245;

  @property({ displayName: "爆发粒子数量" })
  public burstCount = 22;

  @property({ displayName: "手势喷发起点外扩" })
  public directionalSpawnPadding = 48;

  @property({ displayName: "手势喷发最小距离" })
  public directionalMinDistance = 560;

  @property({ displayName: "手势喷发最大距离" })
  public directionalMaxDistance = 940;

  @property({ displayName: "手势喷发横向散布" })
  public directionalSpread = 520;

  @property({ displayName: "手势喷发侧向漂移" })
  public directionalDrift = 130;

  @property({ type: Color, displayName: "颜色A" })
  public colorA = new Color(255, 66, 194, 255);

  @property({ type: Color, displayName: "颜色B" })
  public colorB = new Color(166, 84, 255, 255);

  @property({ type: Color, displayName: "颜色C" })
  public colorC = new Color(255, 208, 55, 255);

  @property({ type: Color, displayName: "颜色D" })
  public colorD = new Color(255, 255, 255, 255);

  private isPlaying = false;
  private spawnAccumulator = 0;
  private particlePool: Node[] = [];
  private activeParticles: Node[] = [];

  start() {
    if (this.playOnStart) {
      this.play();
    }
  }

  update(deltaTime: number) {
    if (!this.isPlaying || this.spawnPerSecond <= 0) {
      return;
    }

    this.spawnAccumulator += deltaTime * this.spawnPerSecond;
    while (this.spawnAccumulator >= 1) {
      this.spawnAccumulator -= 1;
      this.spawnParticle();
    }
  }

  public play() {
    if (!this.particleSpriteFrame) {
      warn("BottomGlowParticleEmitter: particleSpriteFrame is missing.");
      return;
    }

    this.isPlaying = true;
  }

  public stop() {
    this.isPlaying = false;
    this.spawnAccumulator = 0;
  }

  public clearParticles() {
    for (const particle of [...this.activeParticles]) {
      this.recycleParticle(particle);
    }
  }

  public playBurst(multiplier = 1) {
    if (!this.particleSpriteFrame) {
      warn("BottomGlowParticleEmitter: particleSpriteFrame is missing.");
      return;
    }

    const count = Math.max(1, Math.round(this.burstCount * Math.max(0.35, multiplier)));
    for (let i = 0; i < count; i += 1) {
      this.spawnParticle(true);
    }
  }

  public playDirectionalBurst(direction: Vec2, multiplier = 1) {
    if (!this.particleSpriteFrame) {
      warn("BottomGlowParticleEmitter: particleSpriteFrame is missing.");
      return;
    }

    const directionLength = Math.sqrt(
      direction.x * direction.x + direction.y * direction.y,
    );
    if (directionLength <= 0) {
      return;
    }

    const normalizedDirection = new Vec2(
      direction.x / directionLength,
      direction.y / directionLength,
    );
    const count = Math.max(1, Math.round(this.burstCount * Math.max(0.35, multiplier)));
    for (let i = 0; i < count; i += 1) {
      this.spawnParticle(true, normalizedDirection);
    }
  }

  private spawnParticle(isBurst = false, directionalVelocity: Vec2 | null = null) {
    if (!this.particleSpriteFrame || this.activeParticles.length >= this.maxParticles) {
      return;
    }

    const particle = this.getParticle();
    const sprite = particle.getComponent(Sprite)!;
    const opacity = particle.getComponent(UIOpacity)!;
    const transform = particle.getComponent(UITransform)!;
    const size = this.randomRange(this.minSize, this.maxSize) * (isBurst ? 1.2 : 1);
    const motion = directionalVelocity
      ? this.createDirectionalMotion(directionalVelocity, isBurst)
      : this.createBottomMotion(isBurst);
    const lifeTime = motion.lifeTime;
    const peakOpacity = Math.round(this.randomRange(this.minOpacity, this.maxOpacity));
    const fadeInDuration = Math.min(0.18, lifeTime * 0.22);
    const fadeOutDuration = Math.min(0.55, lifeTime * 0.38);
    const stayDuration = Math.max(0, lifeTime - fadeInDuration - fadeOutDuration);
    const startScale = this.randomRange(0.28, 0.55);
    const endScale = this.randomRange(0.9, 1.35) * (isBurst ? 1.12 : 1);

    tween(particle).stop();
    tween(opacity).stop();
    sprite.color = this.getRandomColor();
    transform.setContentSize(size, size);
    particle.active = true;
    particle.setPosition(motion.startPosition);
    particle.setScale(startScale, startScale, 1);
    opacity.opacity = 0;
    this.activeParticles.push(particle);

    tween(opacity)
      .to(fadeInDuration, { opacity: peakOpacity }, { easing: "sineOut" })
      .delay(stayDuration)
      .to(fadeOutDuration, { opacity: 0 }, { easing: "sineIn" })
      .start();

    tween(particle)
      .to(
        lifeTime,
        {
          position: motion.endPosition,
          scale: new Vec3(endScale, endScale, 1),
        },
        { easing: "sineOut" },
      )
      .call(() => this.recycleParticle(particle))
      .start();
  }

  private createBottomMotion(isBurst: boolean) {
    const startX = this.randomRange(-this.spawnWidth * 0.5, this.spawnWidth * 0.5);
    const drift = this.randomRange(-this.horizontalDrift, this.horizontalDrift);
    const riseDistance =
      this.randomRange(this.minRiseDistance, this.maxRiseDistance) * (isBurst ? 1.15 : 1);
    const startPosition = new Vec3(startX, this.bottomY + this.randomRange(-18, 18), 0);
    const endPosition = new Vec3(startX + drift, startPosition.y + riseDistance, 0);
    const lifeTime = this.randomRange(this.minLifeTime, this.maxLifeTime) * (isBurst ? 0.82 : 1);

    return { startPosition, endPosition, lifeTime };
  }

  private createDirectionalMotion(direction: Vec2, isBurst: boolean) {
    const halfWidth = this.spawnWidth * 0.5;
    const halfHeight = Math.max(Math.abs(this.bottomY), this.maxRiseDistance);
    const startPosition = this.getDirectionalStartPosition(direction, halfWidth, halfHeight);
    const minDistance = Math.min(this.directionalMinDistance, this.directionalMaxDistance);
    const maxDistance = Math.max(this.directionalMinDistance, this.directionalMaxDistance);
    const travelDistance =
      this.randomRange(minDistance, maxDistance) * (isBurst ? 1.08 : 1);
    const sideDrift = this.randomRange(-this.directionalDrift, this.directionalDrift);
    const perpendicularX = -direction.y;
    const perpendicularY = direction.x;
    const endPosition = new Vec3(
      startPosition.x + direction.x * travelDistance + perpendicularX * sideDrift,
      startPosition.y + direction.y * travelDistance + perpendicularY * sideDrift,
      0,
    );
    const lifeTime = this.randomRange(this.minLifeTime * 0.62, this.maxLifeTime * 0.78);

    return { startPosition, endPosition, lifeTime };
  }

  private getDirectionalStartPosition(direction: Vec2, halfWidth: number, halfHeight: number) {
    const padding = Math.max(0, this.directionalSpawnPadding);
    const spread = Math.max(0, this.directionalSpread);

    if (Math.abs(direction.x) >= Math.abs(direction.y)) {
      const startX = direction.x > 0 ? -halfWidth - padding : halfWidth + padding;
      return new Vec3(startX, this.randomRange(-spread * 0.5, spread * 0.5), 0);
    }

    const startY = direction.y > 0 ? this.bottomY - padding : halfHeight + padding;
    return new Vec3(this.randomRange(-halfWidth, halfWidth), startY, 0);
  }

  private getParticle() {
    const pooledParticle = this.particlePool.pop();
    if (pooledParticle) {
      return pooledParticle;
    }

    const particle = new Node("Bottom Glow Particle");
    particle.parent = this.particleParent ?? this.node;

    const transform = particle.addComponent(UITransform);
    transform.setContentSize(16, 16);

    const sprite = particle.addComponent(Sprite);
    sprite.spriteFrame = this.particleSpriteFrame;
    sprite.type = Sprite.Type.SIMPLE;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    particle.addComponent(UIOpacity);
    particle.active = false;
    return particle;
  }

  private recycleParticle(particle: Node) {
    tween(particle).stop();
    const opacity = particle.getComponent(UIOpacity);
    if (opacity) {
      tween(opacity).stop();
      opacity.opacity = 0;
    }

    const activeIndex = this.activeParticles.indexOf(particle);
    if (activeIndex >= 0) {
      this.activeParticles.splice(activeIndex, 1);
    }

    particle.active = false;
    if (this.particlePool.length < this.maxParticles) {
      this.particlePool.push(particle);
    } else {
      particle.destroy();
    }
  }

  private getRandomColor() {
    const colors = [this.colorA, this.colorB, this.colorC, this.colorD];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return new Color(color.r, color.g, color.b, color.a);
  }

  private randomRange(min: number, max: number) {
    return min + Math.random() * (max - min);
  }
}
