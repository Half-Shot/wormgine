import { AssetsManifest, Texture } from "pixi.js";
import { Sound } from "@pixi/sound";
import "@pixi/sound";

// NOTE: Do not edit, use ./scripts/generateAssetManifest.mjs

// TEXTURES
import bazookaTex from "./bazooka.png";
import boneIslesTex from "./bone_isles.png";
import fireworkTex from "./firework.png";
import grenadeTex from "./grenade.png";
import island1Tex from "./island1.png";
import mineTex from "./mine.png";
import mineActiveTex from "./mine_active.png";
import missileActiveTex from "./missile_active.png";
import missileInactiveTex from "./missile_inactive.png";
import shotgunTex from "./shotgun.png";
import terrain2Tex from "./terrain2.png";
import testDolbyTex from "./test_dolby.png";
import testDolbyBlushTex from "./test_dolby_blush.png";
import testDolbyDamage1Tex from "./test_dolby_damage1.png";
import testDolbyDamage1BlushTex from "./test_dolby_damage1_blush.png";
import testDolbyDamage2BlushTex from "./test_dolby_damage2_blush.png";
import testDolbyDamage3Tex from "./test_dolby_damage3.png";
import testDolbyDamage3BlushTex from "./test_dolby_damage3_blush.png";
import testingGroundTex from "./testing_ground.png";
import windScrollTex from "./windScroll.png";

// Sounds
import bazookafireSnd from "./bazookafire.ogg";
import explosion1Snd from "./explosion_1.ogg";
import explosion2Snd from "./explosion_2.ogg";
import explosion3Snd from "./explosion_3.ogg";
import fireworkSnd from "./firework.ogg";
import metalBounceHeavySnd from "./metal_bounce_heavy.ogg";
import metalBounceLightSnd from "./metal_bounce_light.ogg";
import mineBeepSnd from "./mine_beep.ogg";
import placeholderSnd from "./placeholder.ogg";
import shotgunSnd from "./shotgun.ogg";
import splashSnd from "./splash.ogg";

// Fonts
import monogramFnt from "./monogram.woff2";

export interface AssetTextures {
  bazooka: Texture;
  boneIsles: Texture;
  firework: Texture;
  grenade: Texture;
  island1: Texture;
  mine: Texture;
  mineActive: Texture;
  missileActive: Texture;
  missileInactive: Texture;
  shotgun: Texture;
  terrain2: Texture;
  testDolby: Texture;
  testDolbyBlush: Texture;
  testDolbyDamage1: Texture;
  testDolbyDamage1Blush: Texture;
  testDolbyDamage2Blush: Texture;
  testDolbyDamage3: Texture;
  testDolbyDamage3Blush: Texture;
  testingGround: Texture;
  windScroll: Texture;
}

export interface AssetSounds {
  bazookafire: Sound;
  explosion1: Sound;
  explosion2: Sound;
  explosion3: Sound;
  firework: Sound;
  metalBounceHeavy: Sound;
  metalBounceLight: Sound;
  mineBeep: Sound;
  placeholder: Sound;
  shotgun: Sound;
  splash: Sound;
}

export const manifest = {
  bundles: [
    {
      name: "textures",
      assets: [
        { src: bazookaTex, alias: "bazooka" },
        { src: boneIslesTex, alias: "boneIsles" },
        { src: fireworkTex, alias: "firework" },
        { src: grenadeTex, alias: "grenade" },
        { src: island1Tex, alias: "island1" },
        { src: mineTex, alias: "mine" },
        { src: mineActiveTex, alias: "mineActive" },
        { src: missileActiveTex, alias: "missileActive" },
        { src: missileInactiveTex, alias: "missileInactive" },
        { src: shotgunTex, alias: "shotgun" },
        { src: terrain2Tex, alias: "terrain2" },
        { src: testDolbyTex, alias: "testDolby" },
        { src: testDolbyBlushTex, alias: "testDolbyBlush" },
        { src: testDolbyDamage1Tex, alias: "testDolbyDamage1" },
        { src: testDolbyDamage1BlushTex, alias: "testDolbyDamage1Blush" },
        { src: testDolbyDamage2BlushTex, alias: "testDolbyDamage2Blush" },
        { src: testDolbyDamage3Tex, alias: "testDolbyDamage3" },
        { src: testDolbyDamage3BlushTex, alias: "testDolbyDamage3Blush" },
        { src: testingGroundTex, alias: "testingGround" },
        { src: windScrollTex, alias: "windScroll" },
      ],
    },
    {
      name: "sounds",
      assets: [
        { src: bazookafireSnd, alias: "bazookafire" },
        { src: explosion1Snd, alias: "explosion1" },
        { src: explosion2Snd, alias: "explosion2" },
        { src: explosion3Snd, alias: "explosion3" },
        { src: fireworkSnd, alias: "firework" },
        { src: metalBounceHeavySnd, alias: "metalBounceHeavy" },
        { src: metalBounceLightSnd, alias: "metalBounceLight" },
        { src: mineBeepSnd, alias: "mineBeep" },
        { src: placeholderSnd, alias: "placeholder" },
        { src: shotgunSnd, alias: "shotgun" },
        { src: splashSnd, alias: "splash" },
      ],
    },
    {
      name: "fonts",
      assets: [
        {
          src: monogramFnt,
          alias: "monogram",
          data: { family: "Monogram", weights: ["normal"] },
        },
      ],
    },
  ],
} satisfies AssetsManifest;
