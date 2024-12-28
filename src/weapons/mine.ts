import { Container, Point } from "pixi.js";
import { IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import icon from "../assets/mine.png";
import { Mine } from "../entities/phys/mine";

export const WeaponMine: IWeaponDefiniton = {
  name: "Mine",
  icon,
  code: IWeaponCode.Mine,
  getawayTime: 350,
  loadAssets(assets) {
    this.sprite = {
      texture: assets.textures.mine,
      scale: new Point(0.1, 0.1),
      offset: new Point(3, -10),
    };
  },
  fireFn(parent: Container, world: GameWorld, worm: Worm) {
    return Mine.create(parent, world, worm.itemPlacementPosition, 3000);
  },
};