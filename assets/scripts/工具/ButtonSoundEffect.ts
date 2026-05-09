import {
  _decorator,
  AudioClip,
  AudioSource,
  Button,
  Component,
  Node,
  warn,
} from "cc";
import { GameSettings } from "../设置/GameSettings";

const { ccclass, property } = _decorator;

@ccclass("ButtonSoundEffect")
export class ButtonSoundEffect extends Component {
  @property({ type: AudioClip, displayName: "点击音效" })
  public clickSound: AudioClip | null = null;

  @property({ displayName: "音量" })
  public volume = 1;

  @property({ displayName: "自动绑定按钮点击" })
  public autoBindClick = true;

  private audioSource: AudioSource | null = null;

  start() {
    this.audioSource = this.getOrCreateAudioSource();

    if (this.autoBindClick) {
      this.node.on(Button.EventType.CLICK, this.playClickSound, this);
    }
  }

  onDestroy() {
    this.node.off(Button.EventType.CLICK, this.playClickSound, this);
  }

  public playClickSound() {
    if (!this.clickSound) {
      warn("ButtonSoundEffect: clickSound is missing.");
      return;
    }

    const volume = GameSettings.getEffectiveEffectsVolume(this.volume);
    if (volume <= 0) {
      return;
    }

    const audioSource = this.getOrCreateAudioSource();
    audioSource.volume = volume;
    audioSource.playOneShot(this.clickSound, volume);
  }

  private getOrCreateAudioSource() {
    let audioSource = this.node.getComponent(AudioSource);
    if (!audioSource) {
      audioSource = this.node.addComponent(AudioSource);
    }

    return audioSource;
  }
}
