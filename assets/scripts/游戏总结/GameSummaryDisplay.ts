import { _decorator, Component, Label } from "cc";
import { GameResultData, GameResultStore } from "../工具/GameResultStore";
import { ScoreCountUpLabel } from "./ScoreCountUpLabel";

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

  @property({ displayName: "分数增长整体延迟" })
  public scoreCountUpStartDelay = 0.35;

  @property({ displayName: "历史分数延迟增加" })
  public historyScoreExtraDelay = 0.12;

  start() {
    this.render(GameResultStore.getResult());
  }

  public render(result: GameResultData) {
    this.setScoreLabel(this.scoreLabel, this.formatNumber(result.score), 0);
    this.setScoreLabel(
      this.historyBestScoreLabel,
      this.formatNumber(result.historyBestScore),
      this.historyScoreExtraDelay,
    );
    this.setLabel(this.correctCountLabel, `${result.correctCount}`);
    this.setLabel(this.accuracyLabel, `${Math.round(result.accuracy)}%`);
    this.setLabel(
      this.fastestReactionLabel,
      result.fastestReaction > 0 ? result.fastestReaction.toFixed(2) : "--",
    );
    this.setLabel(this.maxComboLabel, `${result.maxCombo}`);
    this.setLabel(this.durationLabel, this.formatDuration(result.durationSeconds));
    this.setLabel(this.wrongCountLabel, `${result.wrongCount}`);
  }

  private setScoreLabel(label: Label | null, text: string, extraDelay: number) {
    if (label) {
      const scoreCountUpLabel = label.node.getComponent(ScoreCountUpLabel);
      if (scoreCountUpLabel) {
        scoreCountUpLabel.startDelay = Math.max(
          0,
          this.scoreCountUpStartDelay + extraDelay,
        );
        scoreCountUpLabel.playToText(text);
        return;
      }

      label.string = text;
    }
  }

  private setLabel(label: Label | null, text: string) {
    if (label) {
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
