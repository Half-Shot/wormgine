import { Container } from "pixi.js";
import { FireOpts, IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { add, Coordinate, mult } from "../utils";
import { AssetPack } from "../assets";
import { Sound } from "@pixi/sound";
import icon from "../assets/missile_active.png";
import { HomingMissile } from "../entities/phys/homingMissile";

let fireSound: Sound;

const WeaponHomingMissile: IWeaponDefiniton = {
  name: "HomingMisisle",
  code: IWeaponCode.HomingMissile,
  icon,
  maxDuration: 80,
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
    const forceComponent = Math.log(duration / 10) * 3;
    const x = forceComponent * Math.cos(angle);
    const y = forceComponent * Math.sin(angle);
    const force = mult(new Vector2(1.5 * forceComponent, forceComponent), {
      x,
      y,
    });
    // TODO: Refactor ALL OF THIS
    const position = Coordinate.fromWorld(add(worm.position, { x, y: -0.5 }));
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
