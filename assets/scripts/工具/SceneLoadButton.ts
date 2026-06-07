import { _decorator, Button, Component, warn } from "cc";
import { RemoteSceneLoader } from "./RemoteSceneLoader";

const { ccclass, property } = _decorator;

@ccclass("SceneLoadButton")
export class SceneLoadButton extends Component {
  @property({ displayName: "目标场景名" })
  public sceneName = "游戏进行页面";

  @property({ displayName: "自动绑定点击" })
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

    RemoteSceneLoader.loadScene(this.sceneName);
  }
}
