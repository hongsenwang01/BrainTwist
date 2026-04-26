import { _decorator, Component, Label } from "cc";

const { ccclass, property } = _decorator;

@ccclass("RandomScoreLabel")
export class RandomScoreLabel extends Component {
  @property({ type: Label, displayName: "目标文本" })
  public targetLabel: Label | null = null;

  @property({ displayName: "随机最大分数" })
  public maxScore = 5000;

  @property({ displayName: "开始时随机分数" })
  public randomizeOnStart = true;

  start() {
    this.targetLabel = this.targetLabel ?? this.node.getComponent(Label);

    if (this.randomizeOnStart) {
      this.showRandomScore();
    }
  }

  public showRandomScore() {
    this.setScore(this.createRandomScore());
  }

  public setScore(score: number) {
    if (!this.targetLabel) {
      return;
    }

    this.targetLabel.string = this.formatScore(score);
  }

  private createRandomScore() {
    const max = Math.max(0, Math.floor(this.maxScore));
    return Math.floor(Math.random() * (max + 1));
  }

  private formatScore(score: number) {
    const safeScore = Math.max(0, Math.floor(score));
    return safeScore.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
}
