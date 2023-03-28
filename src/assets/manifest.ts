import { ResolverManifest } from "pixi.js";
import grenadeSrc from "./grenade.png";
import island1png from "./island1.png";

export const manifest = {
    bundles: [{
        name: "textures",
        assets: [{
            name: "grenade",
            srcs: grenadeSrc,
        },
        {
            name: "island1",
            srcs: island1png,
        }]
    }]
} as ResolverManifest;

console.log(manifest);