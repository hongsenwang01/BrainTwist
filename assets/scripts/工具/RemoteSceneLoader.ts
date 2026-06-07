import { AssetManager, assetManager, director, error, warn } from "cc";

const REMOTE_BUNDLE_NAME = "remoteScenes";
const REMOTE_BUNDLE_URL =
  "https://objectstorageapi.hzh.sealos.run/iq8hgkhc-braintwist/brain-twist/v1/remote/remoteScenes";

const LOCAL_SCENES = new Set(["初始化加载", "游戏首页"]);
const loadingScenes = new Set<string>();

export class RemoteSceneLoader {
  public static loadScene(sceneName: string) {
    if (!sceneName) {
      warn("RemoteSceneLoader: sceneName is empty.");
      return;
    }

    if (LOCAL_SCENES.has(sceneName)) {
      director.loadScene(sceneName);
      return;
    }

    if (loadingScenes.has(sceneName)) {
      return;
    }

    loadingScenes.add(sceneName);
    this.loadRemoteBundle((bundle) => {
      bundle.loadScene(sceneName, (sceneError, sceneAsset) => {
        loadingScenes.delete(sceneName);

        if (sceneError || !sceneAsset) {
          error(`RemoteSceneLoader: load remote scene "${sceneName}" failed.`, sceneError);
          return;
        }

        director.runScene(sceneAsset);
      });
    });
  }

  public static loadRemoteBundle(onLoaded: (bundle: AssetManager.Bundle) => void) {
    const existingBundle = assetManager.getBundle(REMOTE_BUNDLE_NAME);
    if (existingBundle) {
      onLoaded(existingBundle);
      return;
    }

    assetManager.loadBundle(REMOTE_BUNDLE_URL, (bundleError, bundle) => {
      if (bundleError || !bundle) {
        error("RemoteSceneLoader: load remote bundle failed.", bundleError);
        return;
      }

      onLoaded(bundle);
    });
  }
}
