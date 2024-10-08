import { AssetPack } from "../assets";
import { WeaponBazooka } from "./bazooka";
import WeaponShotgun from "./shotgun";
export { WeaponGrenade } from "./grenade";
export { WeaponBazooka } from "./bazooka";

export { WeaponShotgun };

export function readAssetsForWeapons(assets: AssetPack): void {
    WeaponShotgun.loadAssets?.(assets);
    WeaponBazooka.loadAssets?.(assets);
}