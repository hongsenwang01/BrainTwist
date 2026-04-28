import { _decorator, Color, Component, Label, Node, UITransform } from "cc";

const { ccclass, executeInEditMode, property } = _decorator;

@ccclass("TextLetterSpacing")
@executeInEditMode(true)
export class TextLetterSpacing extends Component {
  @property({ type: Label, displayName: "源文本" })
  public sourceLabel: Label | null = null;

  @property({ displayName: "使用源文本内容" })
  public useSourceText = true;

  @property({ displayName: "自定义文本" })
  public customText = "";

  @property({ displayName: "字间距" })
  public letterSpacing = 8;

  @property({ displayName: "隐藏源文本" })
  public hideSourceLabel = true;

  @property({ displayName: "字符宽度倍率" })
  public characterWidthScale = 1;

  private readonly childPrefix = "__letter_spacing_char_";
  private lastSignature = "";

  onLoad() {
    this.refresh();
  }

  start() {
    this.refresh();
  }

  update() {
    const signature = this.createSignature();
    if (signature !== this.lastSignature) {
      this.refresh();
    }
  }

  public refresh() {
    const label = this.getSourceLabel();
    if (!label) {
      return;
    }

    this.clearGeneratedChildren();

    const text = this.useSourceText ? label.string : this.customText;
    if (!text) {
      label.enabled = !this.hideSourceLabel;
      this.lastSignature = this.createSignature();
      return;
    }

    label.enabled = !this.hideSourceLabel;

    const characters = Array.from(text);
    const charWidths = characters.map((character) =>
      this.getCharacterWidth(character, label.fontSize),
    );
    const totalWidth =
      charWidths.reduce((sum, width) => sum + width, 0) +
      Math.max(0, characters.length - 1) * this.letterSpacing;

    let x = -totalWidth * 0.5;
    characters.forEach((character, index) => {
      const width = charWidths[index];
      const child = this.createCharacterNode(character, label, index, width);
      child.setPosition(x + width * 0.5, 0, 0);
      x += width + this.letterSpacing;
    });

    this.lastSignature = this.createSignature();
  }

  private getSourceLabel() {
    return this.sourceLabel ?? this.node.getComponent(Label);
  }

  private createCharacterNode(
    character: string,
    sourceLabel: Label,
    index: number,
    width: number,
  ) {
    const child = new Node(`${this.childPrefix}${index}`);
    child.parent = this.node;

    const transform = child.addComponent(UITransform);
    transform.setContentSize(width, sourceLabel.lineHeight);

    const label = child.addComponent(Label);
    label.string = character;
    label.fontSize = sourceLabel.fontSize;
    label.lineHeight = sourceLabel.lineHeight;
    label.color = new Color(
      sourceLabel.color.r,
      sourceLabel.color.g,
      sourceLabel.color.b,
      sourceLabel.color.a,
    );
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.isBold = sourceLabel.isBold;
    label.isItalic = sourceLabel.isItalic;
    label.isUnderline = sourceLabel.isUnderline;
    label.enableWrapText = false;

    if (sourceLabel.font) {
      label.font = sourceLabel.font;
    } else {
      label.fontFamily = sourceLabel.fontFamily;
      label.useSystemFont = sourceLabel.useSystemFont;
    }

    return child;
  }

  private clearGeneratedChildren() {
    const generatedChildren = this.node.children.filter((child) =>
      child.name.startsWith(this.childPrefix),
    );

    generatedChildren.forEach((child) => child.destroy());
  }

  private getCharacterWidth(character: string, fontSize: number) {
    if (character === " ") {
      return fontSize * 0.5 * this.characterWidthScale;
    }

    if (/^[\x00-\x7F]$/.test(character)) {
      return fontSize * 0.65 * this.characterWidthScale;
    }

    return fontSize * this.characterWidthScale;
  }

  private createSignature() {
    const label = this.getSourceLabel();
    return JSON.stringify({
      text: this.useSourceText ? label?.string : this.customText,
      fontSize: label?.fontSize,
      lineHeight: label?.lineHeight,
      color: label
        ? [label.color.r, label.color.g, label.color.b, label.color.a]
        : null,
      letterSpacing: this.letterSpacing,
      hideSourceLabel: this.hideSourceLabel,
      useSourceText: this.useSourceText,
      customText: this.customText,
      characterWidthScale: this.characterWidthScale,
    });
  }
}
