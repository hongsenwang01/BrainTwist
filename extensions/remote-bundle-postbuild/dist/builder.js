"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.unload = exports.load = exports.configs = void 0;

exports.configs = {
  "*": {
    hooks: "./hooks"
  }
};

function load() {
  console.log("[remote-bundle-postbuild] loaded");
}
exports.load = load;

function unload() {
  console.log("[remote-bundle-postbuild] unloaded");
}
exports.unload = unload;
