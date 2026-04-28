import { _decorator, Component, Label } from "cc";
import { GameResultData, GameResultStore } from "../工具/GameResultStore";
import { RollingNumberLabel } from "../工具/RollingNumberLabel";

const { ccclass, property } = _decorator;

@ccclass("GameSummaryDisplay")
export class GameSummaryDisplay extends Component {
  @property({ type: Label, displayName: "本局分数文本" })
  public scoreLabel: Label | null = null;

  @property({ type: Label, displayName: "历史最高分文本" })
  public historyBestScoreLabel: Label | null = null;

  @property({ type: Label, displayName: "正确次数文本" })
  public correctCountLabel: Label | null = null;

  @property({ type: Label, displayName: "正确率文本" })
  public accuracyLabel: Label | null = null;

  @property({ type: Label, displayName: "最快反应文本" })
  public fastestReactionLabel: Label | null = null;

  @property({ type: Label, displayName: "最大连击文本" })
  public maxComboLabel: Label | null = null;

  @property({ type: Label, displayName: "游戏时长文本" })
  public durationLabel: Label | null = null;

  @property({ type: Label, displayName: "失误次数文本" })
  public wrongCountLabel: Label | null = null;

  @property({ displayName: "数字滚动整体延迟" })
  public rollingStartDelay = 0.35;

  @property({ displayName: "数字滚动错峰间隔" })
  public rollingItemDelay = 0.12;

  start() {
    this.render(GameResultStore.getResult());
  }

  public render(result: GameResultData) {
    this.setLabel(this.scoreLabel, this.formatNumber(result.score), 0);
    this.setLabel(
      this.historyBestScoreLabel,
      this.formatNumber(result.historyBestScore),
      0,
    );
    this.setLabel(this.correctCountLabel, `${result.correctCount}`, 0);
    this.setLabel(this.accuracyLabel, `${Math.round(result.accuracy)}%`, 1);
    this.setLabel(
      this.fastestReactionLabel,
      result.fastestReaction > 0 ? result.fastestReaction.toFixed(2) : "--",
      2,
    );
    this.setLabel(this.maxComboLabel, `${result.maxCombo}`, 3);
    this.setLabel(this.durationLabel, this.formatDuration(result.durationSeconds), 4);
    this.setLabel(this.wrongCountLabel, `${result.wrongCount}`, 5);
  }

  private setLabel(label: Label | null, text: string, rollingIndex: number) {
    if (label) {
      const rollingLabel = label.node.getComponent(RollingNumberLabel);
      if (rollingLabel) {
        rollingLabel.startDelay = Math.max(
          0,
          this.rollingStartDelay + rollingIndex * this.rollingItemDelay,
        );
        rollingLabel.playToText(text);
        return;
      }

      label.string = text;
    }
  }

  private formatNumber(value: number) {
    return Math.max(0, Math.floor(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  private formatDuration(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const restSeconds = safeSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${restSeconds
      .toString()
      .padStart(2, "0")}`;
  }
}
