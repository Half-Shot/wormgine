import { Container } from "pixi.js";
import { FireOpts, IWeaponCode, IWeaponDefiniton, projectileWeaponHelper } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { add, Coordinate, mult } from "../utils";
import { AssetPack } from "../assets";
import { Sound } from "@pixi/sound";
import icon from "../assets/firework.png";
import { Firework } from "../entities/phys/firework";

let fireSound: Sound;

const WeaponFireworkLauncher: IWeaponDefiniton = {
  name: "Firework Launcher",
  code: IWeaponCode.FireworkLauncher,
  icon,
  maxDuration: 80,
  timerAdjustable: false,
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
    const { position, force } = projectileWeaponHelper(worm.position, opts.duration, opts.angle);
    return Firework.create(parent, world, position, force, worm.wormIdent);
  },
};

export default WeaponFireworkLauncher;
