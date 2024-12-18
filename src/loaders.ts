import {
  ExtensionFormat,
  ExtensionType,
  LoaderParserPriority,
  extensions,
} from "pixi.js";

// create a custom asset loader for tiled files.
const tiledAssetLoader = {
  name: "tile-asset-loader",
  extension: {
    type: [ExtensionType.LoadParser],
    name: "tile-asset-loader",
    priority: LoaderParserPriority.High,
    ref: null,
  } satisfies ExtensionFormat,
  test(url: string) {
    return url.endsWith(".tsj") || url.endsWith(".tmj");
  },
  async load(url: string) {
    return (await fetch(url)).json();
  },
};

// add the custom asset loader to pixi
extensions.add(tiledAssetLoader);
