import {
  _decorator,
  Component,
  Enum,
  Label,
  Node,
  Slider,
  Sprite,
  Tween,
  tween,
  UITransform,
} from "cc";
import { GameSettings, GameSettingsSnapshot } from "./GameSettings";

const { ccclass, property } = _decorator;
const SLIDER_EVENT = "slide";

enum SliderSetting {
  MusicVolume = 0,
  EffectsVolume = 1,
}

Enum(SliderSetting);

@ccclass("SettingsSliderBinding")
export class SettingsSliderBinding extends Component {
  @property({ type: Slider, displayName: "Slider组件" })
  public slider: Slider | null = null;

  @property({
    type: SliderSetting,
    displayName: "绑定设置项",
  })
  public setting: SliderSetting = SliderSetting.MusicVolume;

  @property({ type: Node, displayName: "滑槽总宽节点" })
  public trackNode: Node | null = null;

  @property({ type: Node, displayName: "进度填充节点" })
  public fillNode: Node | null = null;

  @property({ displayName: "使用Sprite裁切填充" })
  public useSpriteFilledMode = true;

  @property({ displayName: "关闭开关时显示为0" })
  public showZeroWhenDisabled = true;

  @property({ displayName: "开关切换动画时间" })
  public toggleTransitionDuration = 0.16;

  @property({ type: Label, displayName: "百分比文本(可选)" })
  public valueLabel: Label | null = null;

  private trackWidth = 0;
  private displayProgress = 0;
  private progressTween: Tween<{ value: number }> | null = null;

  start() {
    this.cacheTrackWidth();
    this.displayProgress = this.readDisplayProgress(GameSettings.getSnapshot());
    this.applyProgress(this.displayProgress);

    this.slider?.node.on(SLIDER_EVENT, this.onSlide, this);
    GameSettings.onChanged(this.onSettingsChanged, this);
  }

  onDestroy() {
    this.slider?.node?.off(SLIDER_EVENT, this.onSlide, this);
    GameSettings.offChanged(this.onSettingsChanged, this);
    this.stopProgressTween();
  }

  private onSlide() {
    if (!this.slider) {
      return;
    }

    this.stopProgressTween();

    const progress = this.clamp01(this.slider.progress);
    this.writeProgress(progress);
    this.displayProgress = progress;
    this.applyProgress(progress);
  }

  private onSettingsChanged(settings: GameSettingsSnapshot) {
    this.applyProgressAnimated(this.readDisplayProgress(settings));
  }

  private applyProgress(progress: number) {
    const normalizedProgress = this.clamp01(progress);
    this.displayProgress = normalizedProgress;

    if (this.slider && this.slider.progress !== normalizedProgress) {
      this.slider.progress = normalizedProgress;
    }

    this.updateFill(normalizedProgress);

    if (this.valueLabel) {
      this.valueLabel.string = `${Math.round(normalizedProgress * 100)}`;
    }
  }

  private updateFill(progress: number) {
    if (!this.fillNode) {
      return;
    }

    if (this.trackWidth <= 0) {
      this.cacheTrackWidth();
    }

    const fillTransform = this.fillNode.getComponent(UITransform);
    if (!fillTransform) {
      return;
    }

    const fillSprite = this.fillNode.getComponent(Sprite);
    if (this.useSpriteFilledMode && fillSprite) {
      fillSprite.type = Sprite.Type.FILLED;
      fillSprite.fillType = Sprite.FillType.HORIZONTAL;
      fillSprite.fillStart = 0;
      fillSprite.fillRange = progress;

      const position = this.fillNode.position.clone();
      position.x = 0;
      this.fillNode.setPosition(position);
      fillTransform.setContentSize(this.trackWidth, fillTransform.contentSize.height);
      return;
    }

    const height = fillTransform.contentSize.height;
    const fillWidth = this.trackWidth * progress;
    fillTransform.setContentSize(fillWidth, height);

    const anchorX = fillTransform.anchorPoint.x;
    const position = this.fillNode.position.clone();
    position.x = -this.trackWidth * 0.5 + fillWidth * anchorX;
    this.fillNode.setPosition(position);
  }

  private cacheTrackWidth() {
    const trackTransform =
      this.trackNode?.getComponent(UITransform) ??
      this.slider?.node.getComponent(UITransform);
    this.trackWidth = trackTransform?.contentSize.width ?? this.trackWidth;
  }

  private readProgress(settings: GameSettingsSnapshot) {
    switch (this.setting) {
      case SliderSetting.EffectsVolume:
        return settings.effectsVolume;
      case SliderSetting.MusicVolume:
      default:
        return settings.musicVolume;
    }
  }

  private readDisplayProgress(settings: GameSettingsSnapshot) {
    const progress = this.readProgress(settings);
    if (!this.showZeroWhenDisabled) {
      return progress;
    }

    switch (this.setting) {
      case SliderSetting.EffectsVolume:
        return settings.effectsEnabled ? progress : 0;
      case SliderSetting.MusicVolume:
      default:
        return settings.musicEnabled ? progress : 0;
    }
  }

  private applyProgressAnimated(progress: number) {
    const targetProgress = this.clamp01(progress);
    if (this.toggleTransitionDuration <= 0) {
      this.stopProgressTween();
      this.applyProgress(targetProgress);
      return;
    }

    if (Math.abs(this.displayProgress - targetProgress) < 0.001) {
      this.applyProgress(targetProgress);
      return;
    }

    this.stopProgressTween();

    const tweenState = { value: this.displayProgress };
    this.progressTween = tween(tweenState)
      .to(
        this.toggleTransitionDuration,
        { value: targetProgress },
        {
          onUpdate: () => {
            this.applyProgress(tweenState.value);
          },
        },
      )
      .call(() => {
        this.applyProgress(targetProgress);
        this.progressTween = null;
      });
    this.progressTween.start();
  }

  private stopProgressTween() {
    if (!this.progressTween) {
      return;
    }

    this.progressTween.stop();
    this.progressTween = null;
  }

  private writeProgress(progress: number) {
    switch (this.setting) {
      case SliderSetting.EffectsVolume:
        GameSettings.setEffectsVolume(progress);
        return;
      case SliderSetting.MusicVolume:
      default:
        GameSettings.setMusicVolume(progress);
    }
  }

  private clamp01(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(1, value));
  }
}
