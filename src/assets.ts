import { Assets, Texture } from "pixi.js";
import {
  AssetData,
  AssetSounds,
  AssetTextures,
  manifest,
} from "./assets/manifest";
import { Sound } from "@pixi/sound";
import { BehaviorSubject, map } from 'rxjs';


let textures: Record<string, Texture>;
let sounds: Record<string, Sound>;
let data: Record<string, unknown>;

const internalAssetLoadPercentage = new BehaviorSubject(0);

export const assetLoadPercentage = internalAssetLoadPercentage.pipe();
export const assetsAreReady = internalAssetLoadPercentage.pipe(map<number, boolean>(v => v === 1));

export async function loadAssets() {
  await Assets.init({ manifest });

  const bundleCount = Object.keys(manifest.bundles).length;
  let bundleIndex = 0;
  for (const { name } of manifest.bundles) {
    const bundle = await Assets.loadBundle(name, (progress) => {
      const totalProgress = bundleIndex / bundleCount + progress / bundleCount;
      internalAssetLoadPercentage.next(totalProgress);
    });
    bundleIndex++;
    if (name === "textures") {
      textures = bundle;
    } else if (name === "sounds") {
      sounds = bundle;
    } else if (name === "data") {
      data = bundle;
    }
  }
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
