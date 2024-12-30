import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { WeaponSelector } from "../gameui/weapon-select";
import { WeaponBazooka, WeaponGrenade, WeaponShotgun } from "../../weapons";
import { AmmoCount } from "../../interop/gamechannel";
import { IWeaponDefiniton } from "../../weapons/weapon";

const wepList: [IWeaponDefiniton, number][] = [
  [WeaponBazooka, 0],
  [WeaponGrenade, 0],
  [WeaponShotgun, 0],
];

export const OverlayTest: FunctionalComponent = () => {
  const [weaponMenu, setWeaponMenu] = useState<typeof wepList | null>(null);
  return (
    <main>
      <button onClick={() => setWeaponMenu(wepList)}>Open Weapon Menu</button>
      <WeaponSelector
        weapons={weaponMenu}
        onWeaponPicked={() => setWeaponMenu(null)}
      />
    </main>
  );
};
