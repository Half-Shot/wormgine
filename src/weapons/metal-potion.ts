import { Container, Point } from "pixi.js";
import { IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import icon from "../assets/potion_metal.png";
import { PlayableCondition } from "../entities/playable/conditions";

export const WeaponMetalPotion: IWeaponDefiniton = {
  name: "Aunt Millies Famous Iron Brew",
  icon,
  code: IWeaponCode.MetalPotion,
  maxDuration: 0,
  allowGetaway: true,
  loadAssets(assets) {
    this.sprite = {
      texture: assets.textures.potionMetal,
      scale: new Point(0.15, 0.15),
      offset: new Point(0, 0),
    };
  },
  fireFn(_parent: Container, _world: GameWorld, worm: Worm) {
    worm.addCondition(PlayableCondition.Metallic, 2);
  },
};
