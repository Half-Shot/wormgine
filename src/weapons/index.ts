import { AssetPack } from "../assets";
import { WeaponBazooka } from "./bazooka";
import { WeaponGrenade } from "./grenade";
import WeaponShotgun from "./shotgun";
import { IWeaponCode } from "./weapon";
export { WeaponGrenade } from "./grenade";
export { WeaponBazooka } from "./bazooka";

export { WeaponShotgun };

export function getDefinitionForCode(code: IWeaponCode) {
  switch (code) {
    case IWeaponCode.Bazooka:
      return WeaponBazooka;
    case IWeaponCode.Grenade:
      return WeaponGrenade;
    case IWeaponCode.Shotgun:
      return WeaponShotgun;
    default:
      throw Error("Unknown weapon code");
  }
}

export function readAssetsForWeapons(assets: AssetPack): void {
  WeaponShotgun.loadAssets?.(assets);
  WeaponBazooka.loadAssets?.(assets);
}
