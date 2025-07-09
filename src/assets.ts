import { Assets, Texture } from "pixi.js";
import {
  AssetData,
  AssetSounds,
  AssetTextures,
  manifest,
} from "./assets/manifest";
import { Sound } from "@pixi/sound";
import { BehaviorSubject, map } from "rxjs";
import Logger from "./log";

const log = new Logger('Assets');

let textures: Record<string, Texture>;
let sounds: Record<string, Sound>;
let data: Record<string, unknown>;

const internalAssetLoadPercentage = new BehaviorSubject(0);

export const assetLoadPercentage = internalAssetLoadPercentage.pipe();
export const assetsAreReady = internalAssetLoadPercentage.pipe(
  map<number, boolean>((v) => v === 1),
);

export async function loadAssets() {
  await Assets.init({ manifest });

  const totalAssetCount = Object.values(manifest.bundles).map((b) => b.assets.length).reduce((a,b) => a+b, 0);
  let loadedAssets = 0;
  for (const { name } of manifest.bundles) {
    log.debug('Loading bundle', name);
    const bundle = await Assets.loadBundle(name, (progress) => {
      log.debug('Bundle progress', name, progress);
      loadedAssets++;
      internalAssetLoadPercentage.next(loadedAssets/totalAssetCount);
    });
    log.debug('Loaded bundle', name);
    if (name === "textures") {
      textures = bundle;
    } else if (name === "sounds") {
      sounds = bundle;
    } else if (name === "data") {
      data = bundle;
    }
  }
  log.debug('Bundle load complete');
  internalAssetLoadPercentage.next(1);
}

export function getAssets() {
  if (!textures || !sounds || !data) {
    throw Error("Assets not preloaded");
  }
  return {
    textures: textures as unknown as AssetTextures,
    sounds: sounds as unknown as AssetSounds,
    data: data as unknown as AssetData,
  };
}

export type AssetPack = ReturnType<typeof getAssets>;
