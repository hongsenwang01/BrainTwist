import {
  _decorator,
  Button,
  Color,
  Component,
  Enum,
  Node,
  Sprite,
  Toggle,
  tween,
} from "cc";
import { GameSettings, GameSettingsSnapshot } from "./GameSettings";

const { ccclass, property } = _decorator;

enum ToggleSetting {
  Music = 0,
  Effects = 1,
  Vibration = 2,
}

Enum(ToggleSetting);

@ccclass("SettingsToggleBinding")
export class SettingsToggleBinding extends Component {
  @property({ type: Toggle, displayName: "Toggle组件" })
  public toggle: Toggle | null = null;

  @property({ type: Button, displayName: "Button组件(无Toggle时使用)" })
  public button: Button | null = null;

  @property({
    type: ToggleSetting,
    displayName: "绑定设置项",
  })
  public setting: ToggleSetting = ToggleSetting.Music;

  @property({ type: Node, displayName: "圆形把手" })
  public handleNode: Node | null = null;

  @property({ displayName: "关闭把手X" })
  public offHandleX = -32;

  @property({ displayName: "开启把手X" })
  public onHandleX = 32;

  @property({ type: Sprite, displayName: "开关底图" })
  public backgroundSprite: Sprite | null = null;

  @property({ displayName: "开启颜色" })
  public onColor = new Color(255, 53, 134, 255);

  @property({ displayName: "关闭颜色" })
  public offColor = new Color(38, 38, 44, 255);

  @property({ displayName: "关闭时底图灰度" })
  public grayscaleBackgroundWhenOff = true;

  @property({ displayName: "关闭时把手灰度" })
  public grayscaleHandleWhenOff = false;

  @property({ type: Node, displayName: "开启态节点" })
  public onNode: Node | null = null;

  @property({ type: Node, displayName: "关闭态节点" })
  public offNode: Node | null = null;

  @property({ displayName: "动画时间" })
  public animateDuration = 0.12;

  private currentValue = true;

  start() {
    this.currentValue = this.readValue(GameSettings.getSnapshot());
    this.applyValue(this.currentValue, false);

    this.toggle?.node.on(Toggle.EventType.TOGGLE, this.onToggleChanged, this);
    this.button?.node.on(Button.EventType.CLICK, this.onButtonClicked, this);
    GameSettings.onChanged(this.onSettingsChanged, this);
  }

  onDestroy() {
    this.toggle?.node?.off(Toggle.EventType.TOGGLE, this.onToggleChanged, this);
    this.button?.node?.off(Button.EventType.CLICK, this.onButtonClicked, this);
    GameSettings.offChanged(this.onSettingsChanged, this);
  }

  private onToggleChanged() {
    this.setValue(Boolean(this.toggle?.isChecked));
  }

  private onButtonClicked() {
    if (this.toggle) {
      return;
    }

    this.setValue(!this.currentValue);
  }

  private onSettingsChanged(settings: GameSettingsSnapshot) {
    const nextValue = this.readValue(settings);
    if (nextValue === this.currentValue) {
      return;
    }

    this.applyValue(nextValue, true);
  }

  private setValue(value: boolean) {
    this.currentValue = value;
    this.writeValue(value);
    this.applyValue(value, true);
  }

  private applyValue(value: boolean, animated: boolean) {
    this.currentValue = value;

    if (this.toggle && this.toggle.isChecked !== value) {
      this.toggle.isChecked = value;
    }

    if (this.onNode) {
      this.onNode.active = value;
    }

    if (this.offNode) {
      this.offNode.active = !value;
    }

    if (this.backgroundSprite) {
      this.backgroundSprite.color = value ? this.onColor : this.offColor;
      this.backgroundSprite.grayscale =
        this.grayscaleBackgroundWhenOff && !value;
    }

    const handleSprite = this.handleNode?.getComponent(Sprite);
    if (handleSprite) {
      handleSprite.grayscale = this.grayscaleHandleWhenOff && !value;
    }

    if (!this.handleNode) {
      return;
    }

    const position = this.handleNode.position.clone();
    position.x = value ? this.onHandleX : this.offHandleX;

    tween(this.handleNode).stop();
    if (animated && this.animateDuration > 0) {
      tween(this.handleNode)
        .to(this.animateDuration, { position })
        .start();
    } else {
      this.handleNode.setPosition(position);
    }
  }

  private readValue(settings: GameSettingsSnapshot) {
    switch (this.setting) {
      case ToggleSetting.Effects:
        return settings.effectsEnabled;
      case ToggleSetting.Vibration:
        return settings.vibrationEnabled;
      case ToggleSetting.Music:
      default:
        return settings.musicEnabled;
    }
  }

  private writeValue(value: boolean) {
    switch (this.setting) {
      case ToggleSetting.Effects:
        GameSettings.setEffectsEnabled(value);
        return;
      case ToggleSetting.Vibration:
        GameSettings.setVibrationEnabled(value);
        return;
      case ToggleSetting.Music:
      default:
        GameSettings.setMusicEnabled(value);
    }
  }
}
