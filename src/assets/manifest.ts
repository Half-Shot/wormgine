import { AssetsManifest } from "pixi.js";
import '@pixi/sound';
import grenadeSrc from "./grenade.png";
import bazookaShellSrc from "./bazooka.png";
import island1 from "./island1.png";
import terrain2 from "./terrain2.png";
import testingGround from "./testing_ground.png";


// Sounds
import bounce from "./borrowed/grenade.ogg";
import splash from "./borrowed/splash.ogg";
import metalBounceLight from "./metal_bounce_light.ogg";
import metalBounceHeavy from "./metal_bounce_heavy.ogg";
import explosion1 from "./explosion_1.ogg";
import explosion2 from "./explosion_2.ogg";
import explosion3 from "./explosion_3.ogg";

export const manifest = {
    bundles: [{
        name: "textures",
        assets: [{
            alias: "grenade",
            src: grenadeSrc,
        },
        {
            alias: "island1",
            src: island1,
        },
        {
            alias: "terrain2",
            src: terrain2,
        },
        {
            alias: "testingGround",
            src: testingGround,
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
            alias: "metalBounceLight",
            src: metalBounceLight,
        }, {
            alias: "metalBounceHeavy",
            src: metalBounceHeavy,
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