import { AssetPack } from "../assets";
import { WeaponBazooka } from "./bazooka";
import { WeaponGrenade } from "./grenade";
import WeaponShotgun from "./shotgun";
import WeaponFireworkLauncher from "./firework";
import WeaponHomingMissile from "./homingMissile";

import { IWeaponCode } from "./weapon";

export {
  WeaponGrenade,
  WeaponBazooka,
  WeaponFireworkLauncher,
  WeaponHomingMissile,
  WeaponShotgun,
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
    default:
      throw Error("Unknown weapon code");
  }
}

export function readAssetsForWeapons(assets: AssetPack): void {
  WeaponShotgun.loadAssets?.(assets);
  WeaponBazooka.loadAssets?.(assets);
  WeaponFireworkLauncher.loadAssets?.(assets);
  WeaponHomingMissile.loadAssets?.(assets);
}
