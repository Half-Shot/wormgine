import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { WeaponSelector } from "../gameui/weapon-select";
import { WeaponBazooka, WeaponGrenade, WeaponShotgun } from "../../weapons";

const wepList = [
  WeaponBazooka,
  WeaponGrenade,
  WeaponShotgun,
  WeaponGrenade,
  WeaponShotgun,
  WeaponGrenade,
  WeaponShotgun,
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
