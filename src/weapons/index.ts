import { AssetPack } from "../assets";
import { WeaponBazooka } from "./bazooka";
import { WeaponGrenade } from "./grenade";
import { WeaponGasGrenade } from "./gas-grenade";
import WeaponShotgun from "./shotgun";
import WeaponFireworkLauncher from "./firework";
import WeaponHomingMissile from "./homingMissile";

import { IWeaponCode } from "./weapon";
import { WeaponMine } from "./mine";
import { WeaponMetalPotion } from "./metal-potion";

export {
  WeaponGrenade,
  WeaponBazooka,
  WeaponFireworkLauncher,
  WeaponHomingMissile,
  WeaponShotgun,
  WeaponMine,
};

export function getDefinitionForCode(code: IWeaponCode) {
  switch (code) {
    case IWeaponCode.Bazooka:
      return WeaponBazooka;
    case IWeaponCode.Grenade:
      return WeaponGrenade;
    case IWeaponCode.Shotgun:
      return WeaponShotgun;
    case IWeaponCode.FireworkLauncher:
      return WeaponFireworkLauncher;
    case IWeaponCode.Mine:
      return WeaponMine;
    case IWeaponCode.HomingMissile:
      return WeaponHomingMissile;
    case IWeaponCode.GasGrenade:
      return WeaponGasGrenade;
    case IWeaponCode.MetalPotion:
      return WeaponMetalPotion;
    default:
      throw Error(`Unknown weapon code '${code}'`);
  }
}

export function readAssetsForWeapons(assets: AssetPack): void {
  WeaponGrenade.loadAssets?.(assets);
  WeaponGasGrenade.loadAssets?.(assets);
  WeaponShotgun.loadAssets?.(assets);
  WeaponBazooka.loadAssets?.(assets);
  WeaponFireworkLauncher.loadAssets?.(assets);
  WeaponHomingMissile.loadAssets?.(assets);
  WeaponMine.loadAssets?.(assets);
  WeaponMetalPotion.loadAssets?.(assets);
}
