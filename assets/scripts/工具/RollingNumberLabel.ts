import { _decorator, Component, Label, tween, Vec3 } from "cc";
import { TextLetterSpacing } from "./TextLetterSpacing";

const { ccclass, property } = _decorator;

type NumberFormat = {
  type: "number" | "time" | "text";
  value: number;
  decimals: number;
  useThousandsSeparator: boolean;
  prefix: string;
  suffix: string;
  minuteDigits: number;
  secondDigits: number;
};

@ccclass("RollingNumberLabel")
export class RollingNumberLabel extends Component {
  @property({ type: Label, displayName: "目标文本" })
  public targetLabel: Label | null = null;

  @property({ displayName: "进入场景自动播放" })
  public autoPlayOnStart = false;

  @property({ displayName: "自动读取当前文本为目标" })
  public autoReadCurrentText = true;

  @property({ displayName: "起始文本" })
  public startText = "0";

  @property({ displayName: "开始延迟" })
  public startDelay = 0;

  @property({ displayName: "滚动时长" })
  public duration = 0.9;

  @property({ displayName: "每次翻动间隔" })
  public tickInterval = 0.035;

  @property({ displayName: "启用上下翻动" })
  public enableRollMotion = true;

  @property({ displayName: "翻动距离" })
  public rollDistance = 12;

  @property({ displayName: "结束时弹一下" })
  public popOnComplete = true;

  @property({ displayName: "弹出缩放" })
  public popScale = 1.08;

  @property({ displayName: "相同数值时播放轻动画" })
  public animateWhenSameValue = true;

  @property({ displayName: "从右往左逐位滚动" })
  public rollDigitsRightToLeft = false;

  @property({ displayName: "单字符滚动间隔" })
  public digitRollDelay = 0.08;

  private originPosition = new Vec3();
  private originScale = new Vec3();
  private elapsed = 0;
  private nextTickAt = 0;
  private fromFormat: NumberFormat | null = null;
  private toFormat: NumberFormat | null = null;
  private fromText = "";
  private toText = "";
  private digitSlots: string[] = [];
  private digitOrder: number[] = [];
  private digitStartTimes: number[] = [];
  private isPlaying = false;
  private delayedPlayCallback: (() => void) | null = null;

  onLoad() {
    this.targetLabel = this.targetLabel ?? this.node.getComponent(Label);
    this.recordOrigin();
  }

  start() {
    if (!this.autoPlayOnStart) {
      return;
    }

    const targetText = this.autoReadCurrentText
      ? this.targetLabel?.string ?? this.startText
      : this.startText;
    this.playToText(targetText);
  }

  update(deltaTime: number) {
    if (!this.isPlaying || !this.fromFormat || !this.toFormat) {
      return;
    }

    this.elapsed += deltaTime;
    const duration = Math.max(0.01, this.duration);
    const progress = Math.min(this.elapsed / duration, 1);
    const easedProgress = this.easeOutCubic(progress);

    if (this.elapsed >= this.nextTickAt || progress >= 1) {
      this.nextTickAt = this.elapsed + Math.max(0.01, this.tickInterval);
      this.setText(this.createDisplayText(easedProgress));
      this.playRollMotion();
    }

    if (progress >= 1) {
      this.finish();
    }
  }

  public playToText(targetText: string) {
    this.stop(false);
    this.recordOrigin();

    this.toFormat = this.parseText(targetText);
    const currentText = this.createStartTextForTarget(this.toFormat);
    this.fromFormat = this.parseText(currentText);
    this.fromText = this.formatValue(this.fromFormat, this.fromFormat.value);
    this.toText = this.formatValue(this.toFormat, this.toFormat.value);
    this.setupDigitRolling();

    if (this.toFormat.type === "text") {
      this.setText(targetText);
      return;
    }

    this.setText(this.fromText);

    if (this.isSameDisplayValue()) {
      this.playSameValueAnimation();
      return;
    }

    if (this.startDelay > 0) {
      this.delayedPlayCallback = () => this.startRolling();
      this.scheduleOnce(this.delayedPlayCallback, this.startDelay);
      return;
    }

    this.startRolling();
  }

  public playToValue(value: number) {
    this.playToText(`${value}`);
  }

  public stop(restore = true) {
    if (this.delayedPlayCallback) {
      this.unschedule(this.delayedPlayCallback);
      this.delayedPlayCallback = null;
    }

    this.isPlaying = false;
    tween(this.node).stop();

    if (restore) {
      this.node.setPosition(this.originPosition);
      this.node.setScale(this.originScale);
    }
  }

  private startRolling() {
    this.delayedPlayCallback = null;
    this.elapsed = 0;
    this.nextTickAt = 0;
    this.isPlaying = true;
  }

  private finish() {
    this.isPlaying = false;

    if (this.toFormat) {
      this.setText(this.toText || this.formatValue(this.toFormat, this.toFormat.value));
    }

    this.node.setPosition(this.originPosition);

    if (!this.popOnComplete) {
      return;
    }

    const peakScale = new Vec3(
      this.originScale.x * this.popScale,
      this.originScale.y * this.popScale,
      this.originScale.z,
    );

    tween(this.node)
      .to(0.08, { scale: peakScale }, { easing: "sineOut" })
      .to(0.1, { scale: this.originScale }, { easing: "sineInOut" })
      .start();
  }

  private playSameValueAnimation() {
    if (!this.toFormat) {
      return;
    }

    const play = () => {
      this.setText(this.formatValue(this.toFormat!, this.toFormat!.value));

      if (!this.animateWhenSameValue) {
        return;
      }

      const halfDuration = Math.max(0.08, this.duration * 0.5);
      const settleDuration = Math.max(0.08, this.duration * 0.25);
      const peakScale = new Vec3(
        this.originScale.x * this.popScale,
        this.originScale.y * this.popScale,
        this.originScale.z,
      );
      const rollPosition = new Vec3(
        this.originPosition.x,
        this.originPosition.y + this.rollDistance * 0.35,
        this.originPosition.z,
      );

      tween(this.node).stop();
      tween(this.node)
        .parallel(
          tween()
            .to(halfDuration, { scale: peakScale }, { easing: "sineOut" })
            .to(settleDuration, { scale: this.originScale }, { easing: "sineInOut" }),
          tween()
            .to(halfDuration, { position: rollPosition }, { easing: "sineOut" })
            .to(
              settleDuration,
              { position: this.originPosition },
              { easing: "sineInOut" },
            ),
        )
        .call(() => {
          this.node.setPosition(this.originPosition);
          this.node.setScale(this.originScale);
        })
        .start();
    };

    if (this.startDelay > 0) {
      this.delayedPlayCallback = play;
      this.scheduleOnce(this.delayedPlayCallback, this.startDelay);
      return;
    }

    play();
  }

  private createDisplayText(progress: number) {
    if (!this.fromFormat || !this.toFormat) {
      return "";
    }

    if (this.rollDigitsRightToLeft && this.digitOrder.length > 0) {
      return this.createDigitRollingText();
    }

    const value =
      this.fromFormat.value +
      (this.toFormat.value - this.fromFormat.value) * progress;
    return this.formatValue(this.toFormat, value);
  }

  private createDigitRollingText() {
    if (!this.fromFormat || !this.toFormat) {
      return this.toText;
    }

    const result = [...this.digitSlots];
    const duration = Math.max(0.01, this.duration);
    const digitDuration = Math.max(
      0.08,
      duration - Math.max(0, this.digitOrder.length - 1) * this.digitRollDelay,
    );

    for (let orderIndex = 0; orderIndex < this.digitOrder.length; orderIndex += 1) {
      const charIndex = this.digitOrder[orderIndex];
      const digitProgress = Math.min(
        Math.max((this.elapsed - this.digitStartTimes[orderIndex]) / digitDuration, 0),
        1,
      );

      const fromValue = this.getDigitValue(this.fromText[charIndex]);
      const toValue = this.getDigitValue(this.toText[charIndex]);
      const value = Math.floor(
        fromValue + (toValue - fromValue) * this.easeOutCubic(digitProgress),
      );
      result[charIndex] = `${Math.max(0, Math.min(9, value))}`;
    }

    return result.join("");
  }

  private setText(text: string) {
    if (this.targetLabel) {
      this.targetLabel.string = text;
    }

    this.node.getComponent(TextLetterSpacing)?.refresh();
  }

  private playRollMotion() {
    if (!this.enableRollMotion) {
      return;
    }

    tween(this.node).stop();
    this.node.setPosition(
      this.originPosition.x,
      this.originPosition.y - this.rollDistance,
      this.originPosition.z,
    );
    tween(this.node)
      .to(
        Math.max(0.01, this.tickInterval * 0.8),
        { position: this.originPosition },
        { easing: "sineOut" },
      )
      .start();
  }

  private parseText(text: string): NumberFormat {
    const safeText = `${text ?? ""}`.trim();
    const timeMatch = safeText.match(/^(\d+):(\d+)$/);

    if (timeMatch) {
      const minutes = Number(timeMatch[1]);
      const seconds = Number(timeMatch[2]);
      return {
        type: "time",
        value: minutes * 60 + seconds,
        decimals: 0,
        useThousandsSeparator: false,
        prefix: "",
        suffix: "",
        minuteDigits: timeMatch[1].length,
        secondDigits: timeMatch[2].length,
      };
    }

    const numberMatch = safeText.match(/^([^0-9+\-.]*)([+\-]?[0-9,]+(?:\.[0-9]+)?)(.*)$/);
    if (!numberMatch) {
      return {
        type: "text",
        value: 0,
        decimals: 0,
        useThousandsSeparator: false,
        prefix: "",
        suffix: safeText,
        minuteDigits: 2,
        secondDigits: 2,
      };
    }

    const numberText = numberMatch[2];
    const decimalIndex = numberText.indexOf(".");
    return {
      type: "number",
      value: Number(numberText.replace(/,/g, "")) || 0,
      decimals: decimalIndex >= 0 ? numberText.length - decimalIndex - 1 : 0,
      useThousandsSeparator: numberText.includes(","),
      prefix: numberMatch[1],
      suffix: numberMatch[3],
      minuteDigits: 2,
      secondDigits: 2,
    };
  }

  private formatValue(format: NumberFormat, value: number) {
    if (format.type === "time") {
      const totalSeconds = Math.max(0, Math.floor(value));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes
        .toString()
        .padStart(Math.max(1, format.minuteDigits), "0")}:${seconds
        .toString()
        .padStart(Math.max(1, format.secondDigits), "0")}`;
    }

    if (format.type === "number") {
      const fixedValue = Math.max(0, value).toFixed(format.decimals);
      const [integerPart, decimalPart] = fixedValue.split(".");
      const formattedInteger = format.useThousandsSeparator
        ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : integerPart;
      return `${format.prefix}${formattedInteger}${
        decimalPart ? `.${decimalPart}` : ""
      }${format.suffix}`;
    }

    return format.suffix;
  }

  private recordOrigin() {
    this.originPosition.set(this.node.position);
    this.originScale.set(this.node.scale);
  }

  private createStartTextForTarget(targetFormat: NumberFormat) {
    const configuredStartText = this.startText || "0";
    const configuredStartFormat = this.parseText(configuredStartText);

    if (targetFormat.type === "time" && configuredStartFormat.type !== "time") {
      return `${"0".padStart(Math.max(1, targetFormat.minuteDigits), "0")}:${"0".padStart(
        Math.max(1, targetFormat.secondDigits),
        "0",
      )}`;
    }

    if (
      targetFormat.type === "number" &&
      configuredStartFormat.type === "number" &&
      targetFormat.suffix &&
      !configuredStartFormat.suffix
    ) {
      return this.formatValue(targetFormat, configuredStartFormat.value);
    }

    return configuredStartText;
  }

  private setupDigitRolling() {
    this.digitSlots = [...this.toText];
    this.digitOrder = [];
    this.digitStartTimes = [];

    if (!this.rollDigitsRightToLeft || this.fromText.length !== this.toText.length) {
      return;
    }

    for (let index = this.toText.length - 1; index >= 0; index -= 1) {
      if (this.isDigit(this.toText[index]) && this.isDigit(this.fromText[index])) {
        this.digitOrder.push(index);
      }
    }

    this.digitOrder.forEach((_, orderIndex) => {
      this.digitStartTimes.push(orderIndex * Math.max(0, this.digitRollDelay));
    });
  }

  private isDigit(character: string) {
    return /^[0-9]$/.test(character);
  }

  private getDigitValue(character: string) {
    return this.isDigit(character) ? Number(character) : 0;
  }

  private isSameDisplayValue() {
    if (!this.fromFormat || !this.toFormat) {
      return false;
    }

    if (this.fromFormat.type !== this.toFormat.type) {
      return false;
    }

    return Math.abs(this.fromFormat.value - this.toFormat.value) < 0.0001;
  }

  private easeOutCubic(progress: number) {
    return 1 - Math.pow(1 - progress, 3);
  }
}
