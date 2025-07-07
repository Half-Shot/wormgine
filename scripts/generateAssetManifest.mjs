import { readdir } from "fs/promises";
import path, { join } from "path";

const assetLocation = path.resolve(import.meta.dirname, "../src/assets");

function camelCaseString(str, i) {
    if (i === 0) {
        return str;
    }
    return str[0].toUpperCase() + str.slice(1);
}

const fontData = {
    family: 'Monogram',
    weights: ['normal'],
};

async function main() {
    let importTextures = "";
    let importSounds = "";
    let importFonts = "";
    let importData = "";
    
    let interfaceTextures = "";
    let interfaceSounds = "";
    let interfaceData = "";

    let assetTextures = [];
    let assetSounds = [];
    let assetFonts = [];
    let assetData = [];

    function parseDirectory(root, element, prefix = "") {
        const extName = path.extname(element);
        const camelCaseName = (prefix ? prefix + "_" : "") + element.slice(0, -extName.length).split("_").map(camelCaseString).join('');
        switch(extName) {
            case ".webm":
            case ".png":
                importTextures += `import ${camelCaseName}Tex from "${root}${element}";\n`
                interfaceTextures += `    ${camelCaseName}: Texture;\n`
                assetTextures.push(`        {src: ${camelCaseName}Tex, alias: "${camelCaseName}"}`)
                break;
            case ".ogg":
                importSounds += `import ${camelCaseName}Snd from "${root}${element}";\n`
                interfaceSounds += `    ${camelCaseName}: Sound;\n`
                assetSounds.push(`          {src: ${camelCaseName}Snd, alias: "${camelCaseName}"}`)
                break;
            case ".woff2":
                importFonts += `import ${camelCaseName}Fnt from "${root}${element}";\n`
                assetFonts.push(`           {src: ${camelCaseName}Fnt, alias: "${camelCaseName}", data: ${JSON.stringify(fontData)}}`)
                break;
            case ".tsj":
            case ".tmj":
                importData += `import ${camelCaseName}Data from "${root}${element}?url";\n`
                interfaceData += `    ${camelCaseName}: unknown;\n`
                assetData.push(`            {src: ${camelCaseName}Data, alias: "${camelCaseName}"}`)
                break;
            default:
                console.error("Ignoring", element, path.extname(element));
        }
    }

    for (const element of await readdir(assetLocation)) {
        parseDirectory("./", element);
    }
    for (const element of await readdir(join(assetLocation, "levels"))) {
        parseDirectory("./levels/", element, "levels");
    }
    for (const element of await readdir(join(assetLocation, "player"))) {
        parseDirectory("./player/", element, "player");
    }
    for (const element of await readdir(join(assetLocation, "particles"))) {
        parseDirectory("./particles/", element, "particles");
    }
    for (const element of await readdir(join(assetLocation, "music"))) {
        parseDirectory("./music/", element, "music");
    }
    console.log(MANIFEST_TEMPLATE
        .replace("$IMPORT_TEXTURES", importTextures)
        .replace("$IMPORT_SOUNDS", importSounds)
        .replace("$IMPORT_FONTS", importFonts)
        .replace("$IMPORT_DATA", importData)
        .replace("$INTERFACE_TEXTURES", interfaceTextures)
        .replace("$INTERFACE_SOUNDS", interfaceSounds)
        .replace("$INTERFACE_DATA", interfaceData)
        .replace("$ASSET_TEXTURES", assetTextures.join(',\n'))
        .replace("$ASSET_SOUNDS", assetSounds.join(',\n'))
        .replace("$ASSET_FONTS", assetFonts.join(',\n'))
        .replace("$ASSET_DATA", assetData.join(',\n'))
    );
}

main().catch((ex) => {
    console.warn(`Fatal error`, ex);
})

const MANIFEST_TEMPLATE = `
import { AssetsManifest, Texture } from "pixi.js";
import { Sound } from "@pixi/sound";
import "@pixi/sound";
import "../loaders";

// NOTE: Do not edit, use ./scripts/generateAssetManifest.mjs

// TEXTURES
$IMPORT_TEXTURES
// Sounds
$IMPORT_SOUNDS
// Fonts
$IMPORT_FONTS
// Data
$IMPORT_DATA

export interface AssetTextures {
$INTERFACE_TEXTURES}

export interface AssetSounds {
$INTERFACE_SOUNDS}

export interface AssetData {
$INTERFACE_DATA}

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
    }, {
        name: "fonts",
        assets: [
$ASSET_FONTS
        ]
    }, {
        name: "data",
        assets: [
$ASSET_DATA
        ]
    }]
} satisfies AssetsManifest;
`