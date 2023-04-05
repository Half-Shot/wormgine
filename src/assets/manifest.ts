import { ResolverManifest } from "pixi.js";
import '@pixi/sound';
import grenadeSrc from "./grenade.png";
import bazookaShellSrc from "./bazooka.png";
import island1png from "./terrain2.png";
import bounce from "./borrowed/grenade.ogg";
import explosion1 from "./borrowed/explosion1.ogg";
import explosion2 from "./borrowed/explosion2.ogg";
import explosion3 from "./borrowed/explosion3.ogg";

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
        },
        {
            name: "bazooka_shell",
            srcs: bazookaShellSrc,
        }]
    }, {
        name: "sounds",
        assets: [{
            name: "bounce",
            srcs: bounce,
        },{
            name: "explosion1",
            srcs: explosion1,
        },{
            name: "explosion2",
            srcs: explosion2,
        },{
            name: "explosion3",
            srcs: explosion3,
        }]
    }]
} as ResolverManifest;