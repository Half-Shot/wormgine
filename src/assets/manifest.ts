import { AssetsManifest } from "pixi.js";
import '@pixi/sound';
import grenadeSrc from "./grenade.png";
import bazookaShellSrc from "./bazooka.png";
import island1 from "./island1.png";
import terrain2 from "./terrain2.png";
import testingGround from "./testing_ground.png";
import testDolby from "./test_dolby.png";
import testDolbyBlush from "./test_dolby_blush.png";
import testDolbyDamage1 from "./test_dolby_damage1.png";
import testDolbyDamageBlush1 from "./test_dolby_damage1_blush.png";
import testDolbyDamageBlush2 from "./test_dolby_damage2_blush.png";
import testDolbyDamageBlush3 from "./test_dolby_damage3_blush.png";
import testDolbyDamage3 from "./test_dolby_damage3.png";
import mine from "./mine.png";
import mineActive from "./mine_active.png";
import firework from "./firework.png";
import boneIsles from "./bone_isles.png";


// Sounds
import bounce from "./borrowed/grenade.ogg";
import splash from "./borrowed/splash.ogg";
import metalBounceLight from "./metal_bounce_light.ogg";
import metalBounceHeavy from "./metal_bounce_heavy.ogg";
import explosion1 from "./explosion_1.ogg";
import explosion2 from "./explosion_2.ogg";
import explosion3 from "./explosion_3.ogg";
import mineBeep from "./mine_beep.ogg";
import fireworkSound from "./firework.ogg";


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
        },
        {
            alias: "mine",
            src: mine,
        },
        {
            alias: "firework",
            src: firework,
        },
        {
            alias: "mineActive",
            src: mineActive,
        },
        {
            alias: "testdummy",
            src: testDolby,
        },
        {
            alias: "testdummy_blush",
            src: testDolbyBlush,
        },
        {
            alias: "testdummy_damage_1",
            src: testDolbyDamage1,
        },
        {
            alias: "testdummy_damage_blush_1",
            src: testDolbyDamageBlush1,
        },
        {
            alias: "testdummy_damage_2",
            //src: testDolbyDamage2,
            // Failed to make a file for this one.
            src: testDolbyDamageBlush2,
        },
        {
            alias: "testdummy_damage_blush_2",
            src: testDolbyDamageBlush2,
        },
        {
            alias: "testdummy_damage_3",
            src: testDolbyDamage3,
        },
        {
            alias: "testdummy_damage_blush_3",
            src: testDolbyDamageBlush3,
        },
        {
            alias: "boneIsles",
            src: boneIsles,
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
        },{
            alias: "mineBeep",
            src: mineBeep,
        }, {
            alias: "firework",
            src: fireworkSound,
        }]
    }]
} satisfies AssetsManifest;