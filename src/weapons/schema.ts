import { IWeaponCode } from "./weapon";

export const DefaultWeaponSchema: Record<IWeaponCode, number> = Object.freeze({
  [IWeaponCode.Bazooka]: -1,
  [IWeaponCode.FireworkLauncher]: -1,
  [IWeaponCode.Grenade]: -1,
  [IWeaponCode.HomingMissile]: -1,
  [IWeaponCode.Mine]: -1,
  [IWeaponCode.Shotgun]: -1,
});
