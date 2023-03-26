import { ResolverManifest } from "pixi.js";
import grenadeSrc from "./grenade.png";

export const manifest = {
    bundles: [{
        name: "textures",
        assets: [{
            name: "grenade",
            srcs: grenadeSrc,
        }]
    }]
} as ResolverManifest;

console.log(manifest);