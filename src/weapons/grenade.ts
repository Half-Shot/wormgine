import { Container } from "pixi.js";
import { Grenade } from "../entities/phys/grenade";
import { FireOpts, IWeaponCode, IWeaponDefiniton, projectileWeaponHelper } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { add, Coordinate, mult } from "../utils";
import icon from "../assets/grenade.png";

export const WeaponGrenade: IWeaponDefiniton = {
  name: "Grenade",
  icon,
  code: IWeaponCode.Grenade,
  maxDuration: 50,
  timerAdjustable: true,
  showTargetGuide: true,
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
    const { position, force } = projectileWeaponHelper(worm.position, opts.duration, opts.angle);
    return Grenade.create(
      parent,
      world,
      position,
      force,
      opts.timer,
      worm.wormIdent,
    );
  },
};
