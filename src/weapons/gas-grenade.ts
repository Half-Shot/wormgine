import { Container, Point } from "pixi.js";
import {
  FireOpts,
  IWeaponCode,
  IWeaponDefiniton,
  projectileWeaponHelper,
} from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import icon from "../assets/potion_green.png";
import { GasGrenade } from "../entities/phys/gas-grenade";

export const WeaponGasGrenade: IWeaponDefiniton = {
  name: "Glass of Creamy Green",
  icon,
  code: IWeaponCode.GasGrenade,
  maxDuration: 50,
  allowGetaway: true,
  showTargetGuide: true,
  loadAssets(assets) {
    this.sprite = {
      texture: assets.textures.potionGreen,
      scale: new Point(0.15, 0.15),
      offset: new Point(3, -10),
    };
  },
  fireFn(parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) {
    if (!opts.duration) {
      throw Error("Duration expected but not given");
    }
    if (!opts.timer) {
      throw Error("Timer expected but not given");
    }
    if (opts.angle === undefined) {
      throw Error("Angle expected but not given");
    }
    const { position, force } = projectileWeaponHelper(
      worm.position,
      opts.duration,
      opts.angle,
    );
    return GasGrenade.create(parent, world, position, force, 3, worm.wormIdent);
  },
};
