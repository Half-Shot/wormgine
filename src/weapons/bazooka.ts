import { Container } from "pixi.js";
import {
  FireOpts,
  IWeaponCode,
  IWeaponDefiniton,
  projectileWeaponHelper,
} from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { BazookaShell } from "../entities/phys/bazookaShell";
import { AssetPack } from "../assets";
import { Sound } from "@pixi/sound";
import icon from "../assets/bazooka.png";

let fireSound: Sound;

export const WeaponBazooka: IWeaponDefiniton = {
  name: "Bazooka",
  code: IWeaponCode.Bazooka,
  icon,
  maxDuration: 80,
  timerAdjustable: false,
  allowGetaway: true,
  showTargetGuide: true,
  loadAssets(assets: AssetPack) {
    fireSound = assets.sounds.bazookafire;
  },
  fireFn(parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) {
    if (opts.duration === undefined) {
      throw Error("Duration expected but not given");
    }
    if (opts.angle === undefined) {
      throw Error("Angle expected but not given");
    }
    fireSound.play();
    const { position, force } = projectileWeaponHelper(
      worm.position,
      opts.duration,
      opts.angle,
    );
    return BazookaShell.create(parent, world, position, force, worm.wormIdent);
  },
};
