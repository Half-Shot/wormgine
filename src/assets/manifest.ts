import { AssetsManifest } from "pixi.js";
import '@pixi/sound';
import grenadeSrc from "./grenade.png";
import bazookaShellSrc from "./bazooka.png";
import terrain2 from "./terrain2.png";
import bounce from "./borrowed/grenade.ogg";
import splash from "./borrowed/splash.ogg";
import explosion1 from "./borrowed/explosion1.ogg";
import explosion2 from "./borrowed/explosion2.ogg";
import explosion3 from "./borrowed/explosion3.ogg";

export const manifest = {
    bundles: [{
        name: "textures",
        assets: [{
            alias: "grenade",
            src: grenadeSrc,
        },
        {
            alias: "island1",
            src: terrain2,
        },
        {
            alias: "bazooka_shell",
            src: bazookaShellSrc,
        }]
    }, {
        name: "sounds",
        assets: [{
            alias: "bounce",
            src: bounce,
        },{
            alias: "explosion1",
            src: explosion1,
        },{
            alias: "explosion2",
            src: explosion2,
        },{
            alias: "explosion3",
            src: explosion3,
        },{
            alias: "splash",
            src: splash,
        }]
    }]
} satisfies AssetsManifest;