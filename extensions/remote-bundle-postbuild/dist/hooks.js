"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.throwError = true;
exports.onAfterBuild = void 0;

const fs = require("fs");
const path = require("path");

const BUNDLE_NAME = "remoteScenes";

function log(message) {
  console.log(`[remote-bundle-postbuild] ${message}`);
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(dirPath) {
  if (exists(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function getOutputDir(options, result) {
  if (result && result.paths && result.paths.output) {
    return result.paths.output;
  }

  const projectPath = global.Editor && Editor.Project && Editor.Project.path
    ? Editor.Project.path
    : process.cwd();
  const outputName = options.outputName || options.taskName || "bytedance-mini-game";
  return path.join(projectPath, "build", outputName);
}

function copyBundleScript(outputDir, remoteBundleDir) {
  const remoteScript = path.join(remoteBundleDir, "index.js");
  if (!exists(remoteScript)) {
    return;
  }

  const localScriptDir = path.join(outputDir, "src", "bundle-scripts", BUNDLE_NAME);
  ensureDir(localScriptDir);
  fs.copyFileSync(remoteScript, path.join(localScriptDir, "index.js"));
}

function patchGameJs(outputDir) {
  const gameJsPath = path.join(outputDir, "game.js");
  if (!exists(gameJsPath)) {
    return;
  }

  const requireLine = `    require('./src/bundle-scripts/${BUNDLE_NAME}/index.js');`;
  let content = fs.readFileSync(gameJsPath, "utf8");
  content = content
    .replace(new RegExp(`\\s*require\\(['"]\\.\\/src\\/bundle-scripts\\/${BUNDLE_NAME}\\/index\\.js['"]\\);\\s*`, "g"), "\n\n");

  const marker = '    require("src/system.bundle.js");';
  if (content.includes(marker)) {
    content = content.replace(marker, `${marker}\n\n${requireLine}`);
  } else {
    content = `${requireLine}\n${content}`;
  }

  fs.writeFileSync(gameJsPath, content, "utf8");
}

function patchProjectConfig(outputDir) {
  const projectConfigPath = path.join(outputDir, "project.config.json");
  if (!exists(projectConfigPath)) {
    return;
  }

  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
  projectConfig.packOptions = projectConfig.packOptions || {};
  projectConfig.packOptions.ignore = Array.isArray(projectConfig.packOptions.ignore)
    ? projectConfig.packOptions.ignore
    : [];

  const hasRemoteIgnore = projectConfig.packOptions.ignore.some((item) => {
    return item && item.type === "folder" && item.value === "remote";
  });
  if (!hasRemoteIgnore) {
    projectConfig.packOptions.ignore.push({ type: "folder", value: "remote" });
  }

  fs.writeFileSync(projectConfigPath, `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
}

function postprocess(outputDir) {
  const localBundleDir = path.join(outputDir, "assets", BUNDLE_NAME);
  const remoteRoot = path.join(outputDir, "remote");
  const remoteBundleDir = path.join(remoteRoot, BUNDLE_NAME);

  if (!exists(localBundleDir) && !exists(remoteBundleDir)) {
    log(`skip: ${BUNDLE_NAME} bundle not found in ${outputDir}`);
    return;
  }

  ensureDir(remoteRoot);

  if (exists(localBundleDir)) {
    removeDir(remoteBundleDir);
    fs.renameSync(localBundleDir, remoteBundleDir);
    log(`moved assets/${BUNDLE_NAME} to remote/${BUNDLE_NAME}`);
  }

  copyBundleScript(outputDir, remoteBundleDir);
  patchGameJs(outputDir);
  patchProjectConfig(outputDir);
  log(`postbuild complete: ${outputDir}`);
}

async function onAfterBuild(options, result) {
  if (options.platform !== "bytedance-mini-game") {
    return;
  }
  postprocess(getOutputDir(options, result));
}
exports.onAfterBuild = onAfterBuild;
