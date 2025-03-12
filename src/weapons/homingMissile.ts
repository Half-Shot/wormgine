import { Container } from "pixi.js";
import {
  FireOpts,
  IWeaponCode,
  IWeaponDefiniton,
  projectileWeaponHelper,
} from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { AssetPack } from "../assets";
import { Sound } from "@pixi/sound";
import icon from "../assets/missile_active.png";
import { HomingMissile } from "../entities/phys/homingMissile";

let fireSound: Sound;

const WeaponHomingMissile: IWeaponDefiniton = {
  name: "Kobold Seeking Missile",
  code: IWeaponCode.HomingMissile,
  icon,
  maxDuration: 80,
  allowGetaway: true,
  timerAdjustable: false,
  showTargetGuide: true,
  showTargetPicker: true,
  loadAssets(assets: AssetPack) {
    fireSound = assets.sounds.bazookafire;
  },
  fireFn(
    parent: Container,
    world: GameWorld,
    worm: Worm,
    { duration, angle, target }: FireOpts,
  ) {
    if (duration === undefined) {
      throw Error("Duration expected but not given");
    }
    if (angle === undefined) {
      throw Error("Angle expected but not given");
    }
    if (target === undefined) {
      throw Error("Target expected but not given");
    }
    fireSound.play();
    const { position, force } = projectileWeaponHelper(
      worm.position,
      duration,
      angle,
    );
    return HomingMissile.create(
      parent,
      world,
      position,
      force,
      target,
      worm.wormIdent,
    );
  },
};

export default WeaponHomingMissile;
