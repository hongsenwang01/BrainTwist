import {
  _decorator,
  AudioClip,
  AudioSource,
  Component,
  resources,
  warn,
} from "cc";
import { GameSettings } from "../设置/GameSettings";

const { ccclass, property } = _decorator;

@ccclass("HomeBackgroundMusic")
export class HomeBackgroundMusic extends Component {
  @property({ type: [AudioClip], displayName: "背景音乐列表" })
  public musicClips: AudioClip[] = [];

  @property({ displayName: "自动从 resources 加载" })
  public autoLoadFromResources = true;

  @property({ displayName: "resources 音频目录" })
  public resourcesFolder = "音频/背景音乐";

  @property({ displayName: "进入页面自动播放" })
  public playOnStart = true;

  @property({ displayName: "循环播放" })
  public loop = true;

  @property({ displayName: "音量" })
  public volume = 0.6;

  private audioSource: AudioSource | null = null;

  onLoad() {
    GameSettings.onChanged(this.applyCurrentSettings, this);
  }

  start() {
    this.audioSource = this.getOrCreateAudioSource();
    this.applyCurrentSettings();

    if (this.playOnStart) {
      this.playRandomMusic();
    }
  }

  onDestroy() {
    GameSettings.offChanged(this.applyCurrentSettings, this);
    this.audioSource?.stop();
  }

  public playRandomMusic() {
    if (this.musicClips.length > 0) {
      this.playRandomFromList(this.musicClips);
      return;
    }

    if (!this.autoLoadFromResources) {
      warn("HomeBackgroundMusic: musicClips is empty.");
      return;
    }

    resources.loadDir(this.resourcesFolder, AudioClip, (error, clips) => {
      if (error || clips.length === 0) {
        warn(`HomeBackgroundMusic: no music found in ${this.resourcesFolder}.`);
        return;
      }

      this.musicClips = clips;
      this.playRandomFromList(clips);
    });
  }

  public stopMusic() {
    this.audioSource?.stop();
  }

  private playRandomFromList(clips: AudioClip[]) {
    const clip = clips[Math.floor(Math.random() * clips.length)];
    const audioSource = this.getOrCreateAudioSource();

    audioSource.stop();
    audioSource.clip = clip;
    audioSource.loop = this.loop;
    audioSource.volume = GameSettings.getEffectiveMusicVolume(this.volume);
    audioSource.play();
  }

  private applyCurrentSettings() {
    if (!this.audioSource) {
      return;
    }

    this.audioSource.volume = GameSettings.getEffectiveMusicVolume(this.volume);
  }

  private getOrCreateAudioSource() {
    let audioSource = this.node.getComponent(AudioSource);
    if (!audioSource) {
      audioSource = this.node.addComponent(AudioSource);
    }
    return audioSource;
  }
}
