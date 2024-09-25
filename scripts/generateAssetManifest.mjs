import { readdir } from "fs/promises";
import path from "path";

const assetLocation = path.resolve(import.meta.dirname, "../src/assets");

function camelCaseString(str, i) {
    if (i === 0) {
        return str;
    }
    return str[0].toUpperCase() + str.slice(1);
}

async function main() {
    let importTextures = "", importSounds = "", interfaceTextures = "", interfaceSounds = "", assetTextures = [], assetSounds = [];
    for (const element of await readdir(assetLocation)) {
        const extName = path.extname(element);
        const camelCaseName = element.slice(0, -4).split("_").map(camelCaseString).join('');
        switch(extName) {
            case ".png":
                importTextures += `import ${camelCaseName}Tex from "./${element}";\n`
                interfaceTextures += `    ${camelCaseName}: Texture;\n`
                assetTextures.push(`            {src: ${camelCaseName}Tex, alias: "${camelCaseName}"}`)
                break;
            case ".ogg":
                importSounds += `import ${camelCaseName}Snd from "./${element}";\n`
                interfaceSounds += `    ${camelCaseName}: Sound;\n`
                assetSounds.push(`            {src: ${camelCaseName}Snd, alias: "${camelCaseName}"}`)
                break;
            default:
                console.error("Ignoring", element, path.extname(element));
        }
    }
    console.log(MANIFEST_TEMPLATE
        .replace("$IMPORT_TEXTURES", importTextures)
        .replace("$IMPORT_SOUNDS", importSounds)
        .replace("$INTERFACE_TEXTURES", interfaceTextures)
        .replace("$INTERFACE_SOUNDS", interfaceSounds)
        .replace("$ASSET_TEXTURES", assetTextures.join(',\n'))
        .replace("$ASSET_SOUNDS", assetSounds.join(',\n'))
    );
}

main().catch((ex) => {
    console.warn(`Fatal error`, ex);
})

const MANIFEST_TEMPLATE = `
import { AssetsManifest, Texture } from "pixi.js";
import { Sound } from "@pixi/sound";

// NOTE: Do not edit, use ./scripts/generateAssetManifest.mjs

// TEXTURES
$IMPORT_TEXTURES
// Sounds
$IMPORT_SOUNDS
export interface AssetTextures {
$INTERFACE_TEXTURES}

export interface AssetSounds {
$INTERFACE_SOUNDS}

export const manifest = {
    bundles: [{
        name: "textures",
        assets: [
$ASSET_TEXTURES
        ]
    }, {
        name: "sounds",
        assets: [
$ASSET_SOUNDS
        ]
    }]
} satisfies AssetsManifest;
`