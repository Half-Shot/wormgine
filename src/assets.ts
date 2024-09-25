import { Assets, Texture } from "pixi.js";
import { AssetSounds, AssetTextures, manifest } from "./assets/manifest";
import { Sound } from "@pixi/sound";

let textures: Record<string, Texture>;
let sounds: Record<string, Sound>;

export async function loadAssets(progressFn: (totalProgress: number) => void) {
    await Assets.init({ manifest });

    const bundleCount = Object.keys(manifest.bundles).length;
    let bundleIndex = 0;
    for (const {name} of manifest.bundles) {
        const bundle = await Assets.loadBundle(name, (progress) => {
            const totalProgress = bundleIndex/bundleCount + (progress / bundleCount);
            progressFn(totalProgress);
        });
        bundleIndex++;
        if (name === 'textures') {
            textures = bundle;
        } else if (name === 'sounds') {
            sounds = bundle;
        }
    }
}

export function getAssets() {
    if (!textures || !sounds) {
        throw Error('Assets not preloaded');
    }
    return {
        textures: textures as unknown as AssetTextures,
        sounds: sounds as unknown as AssetSounds
    }
}

export type AssetPack = ReturnType<typeof getAssets>;
