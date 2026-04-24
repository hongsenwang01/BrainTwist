import { _decorator, Component, director, warn } from "cc";

const { ccclass, property } = _decorator;

@ccclass("LoadingProgressMask")
export class LoadingProgressMask extends Component {
  @property({ displayName: "起始X坐标" })
  public startX = -271.426;

  @property({ displayName: "结束X坐标" })
  public endX = 275.129;

  @property({ displayName: "目标场景名" })
  public preloadSceneName = "";

  @property({ displayName: "启动后自动播放" })
  public autoPlayOnStart = true;

  @property({ displayName: "预览时长" })
  public previewDuration = 2;

  @property({ displayName: "自动预加载场景" })
  public autoStartPreload = false;

  @property({ displayName: "加载完成后切场景" })
  public loadSceneWhenComplete = false;

  private fixedY = 0;
  private fixedZ = 0;
  private isPreloading = false;
  private previewElapsed = 0;
  private isPreviewPlaying = false;

  onLoad() {
    const position = this.node.position;
    this.fixedY = position.y;
    this.fixedZ = position.z;
    this.setProgress(0);
  }

  start() {
    if (this.autoStartPreload) {
      this.preloadScene();
      return;
    }

    if (this.autoPlayOnStart) {
      this.playPreview();
    }
  }

  update(deltaTime: number) {
    if (!this.isPreviewPlaying) {
      return;
    }

    this.previewElapsed += deltaTime;
    const duration = Math.max(this.previewDuration, 0.01);
    const progress = Math.min(this.previewElapsed / duration, 1);
    this.setProgress(progress);

    if (progress >= 1) {
      this.isPreviewPlaying = false;

      if (this.loadSceneWhenComplete && this.preloadSceneName) {
        director.loadScene(this.preloadSceneName);
      }
    }
  }

  public setProgress(progress: number) {
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const x = this.startX + (this.endX - this.startX) * clampedProgress;
    this.node.setPosition(x, this.fixedY, this.fixedZ);
  }

  public playPreview() {
    this.isPreviewPlaying = true;
    this.previewElapsed = 0;
    this.setProgress(0);
  }

  public preloadScene(sceneName = this.preloadSceneName) {
    if (this.isPreloading) {
      return;
    }

    if (!sceneName) {
      warn("LoadingProgressMask: preloadSceneName is empty.");
      return;
    }

    this.isPreloading = true;
    this.isPreviewPlaying = false;
    this.setProgress(0);

    director.preloadScene(
      sceneName,
      (completedCount: number, totalCount: number) => {
        this.setProgress(totalCount > 0 ? completedCount / totalCount : 1);
      },
      (error: Error | null) => {
        this.isPreloading = false;

        if (error) {
          warn(`LoadingProgressMask: failed to preload scene "${sceneName}".`);
          return;
        }

        this.setProgress(1);

        if (this.loadSceneWhenComplete) {
          director.loadScene(sceneName);
        }
      },
    );
  }
}
