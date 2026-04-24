import { _decorator, Component } from "cc";
import { LottieArrowRenderer } from "./LottieArrowRenderer";

const { ccclass, property } = _decorator;

@ccclass("ButtonPressAnimator")
export class ButtonPressAnimator extends Component {
  @property
  public resourcePath = "animations/lottie/按钮按压效果";

  @property
  public size = 220;

  @property
  public playbackSpeed = 1;

  private renderer: LottieArrowRenderer | null = null;

  start() {
    this.setupRenderer();
  }

  public play(onComplete?: () => void) {
    const renderer = this.setupRenderer();
    renderer.playOnce(onComplete);
  }

  private setupRenderer() {
    if (!this.renderer) {
      this.renderer = this.node.getComponent(LottieArrowRenderer);
      if (!this.renderer) {
        this.renderer = this.node.addComponent(LottieArrowRenderer);
      }
    }

    this.renderer.resourcePath = this.resourcePath;
    this.renderer.arrowSize = this.size;
    this.renderer.playbackSpeed = this.playbackSpeed;
    this.renderer.playFullJsonAnimation = true;
    this.renderer.preload(() => this.renderer?.showStartFrame());
    return this.renderer;
  }
}
