import { _decorator, Button, Component, director, warn } from "cc";

const { ccclass, property } = _decorator;

@ccclass("SceneLoadButton")
export class SceneLoadButton extends Component {
  @property
  public sceneName = "游戏进行页面";

  @property
  public autoBindClick = true;

  start() {
    if (this.autoBindClick) {
      this.node.on(Button.EventType.CLICK, this.loadScene, this);
    }
  }

  onDestroy() {
    this.node.off(Button.EventType.CLICK, this.loadScene, this);
  }

  public loadScene() {
    if (!this.sceneName) {
      warn("SceneLoadButton: sceneName is empty.");
      return;
    }

    director.loadScene(this.sceneName);
  }
}
