import { EventTarget, sys, warn } from "cc";

export type GameSettingsSnapshot = {
  musicEnabled: boolean;
  musicVolume: number;
  effectsEnabled: boolean;
  effectsVolume: number;
  vibrationEnabled: boolean;
};

const STORAGE_KEY = "brain_twist_game_settings_v1";

const DEFAULT_SETTINGS: GameSettingsSnapshot = {
  musicEnabled: true,
  musicVolume: 0.65,
  effectsEnabled: true,
  effectsVolume: 0.65,
  vibrationEnabled: true,
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readVolume(value: unknown, fallback: number) {
  return typeof value === "number" ? clamp01(value) : fallback;
}

export class GameSettings {
  public static readonly EVENT_CHANGED = "game-settings-changed";

  private static readonly events = new EventTarget();

  public static getSnapshot(): GameSettingsSnapshot {
    return this.read();
  }

  public static setMusicEnabled(enabled: boolean) {
    this.write({ musicEnabled: enabled });
  }

  public static setMusicVolume(volume: number) {
    this.write({ musicVolume: clamp01(volume) });
  }

  public static setEffectsEnabled(enabled: boolean) {
    this.write({ effectsEnabled: enabled });
  }

  public static setEffectsVolume(volume: number) {
    this.write({ effectsVolume: clamp01(volume) });
  }

  public static setVibrationEnabled(enabled: boolean) {
    this.write({ vibrationEnabled: enabled });
  }

  public static getEffectiveMusicVolume(baseVolume = 1) {
    const settings = this.read();
    return settings.musicEnabled ? clamp01(baseVolume) * settings.musicVolume : 0;
  }

  public static getEffectiveEffectsVolume(baseVolume = 1) {
    const settings = this.read();
    return settings.effectsEnabled
      ? clamp01(baseVolume) * settings.effectsVolume
      : 0;
  }

  public static isEffectsEnabled() {
    return this.read().effectsEnabled;
  }

  public static isVibrationEnabled() {
    return this.read().vibrationEnabled;
  }

  public static onChanged(
    callback: (settings: GameSettingsSnapshot) => void,
    target?: unknown,
  ) {
    this.events.on(this.EVENT_CHANGED, callback, target);
  }

  public static offChanged(
    callback: (settings: GameSettingsSnapshot) => void,
    target?: unknown,
  ) {
    this.events.off(this.EVENT_CHANGED, callback, target);
  }

  private static write(patch: Partial<GameSettingsSnapshot>) {
    const next = {
      ...this.read(),
      ...patch,
    };

    try {
      sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      warn("GameSettings: failed to save settings.", error);
    }

    this.events.emit(this.EVENT_CHANGED, next);
  }

  private static read(): GameSettingsSnapshot {
    const raw = sys.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const data = JSON.parse(raw) as Partial<GameSettingsSnapshot>;
      return {
        musicEnabled: readBoolean(
          data.musicEnabled,
          DEFAULT_SETTINGS.musicEnabled,
        ),
        musicVolume: readVolume(data.musicVolume, DEFAULT_SETTINGS.musicVolume),
        effectsEnabled: readBoolean(
          data.effectsEnabled,
          DEFAULT_SETTINGS.effectsEnabled,
        ),
        effectsVolume: readVolume(
          data.effectsVolume,
          DEFAULT_SETTINGS.effectsVolume,
        ),
        vibrationEnabled: readBoolean(
          data.vibrationEnabled,
          DEFAULT_SETTINGS.vibrationEnabled,
        ),
      };
    } catch (error) {
      warn("GameSettings: failed to parse settings.", error);
      return { ...DEFAULT_SETTINGS };
    }
  }
}
