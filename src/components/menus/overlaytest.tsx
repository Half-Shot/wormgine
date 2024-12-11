import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { WeaponSelector } from "../gameui/weapon-select";
import { WeaponBazooka, WeaponGrenade, WeaponShotgun } from "../../weapons";

export const OverlayTest: FunctionalComponent = () => {
  const [weaponMenuOpen, setWeaponMenuOpen] = useState(false);
  return (
    <main>
      <button onClick={() => setWeaponMenuOpen(true)}>Open Weapon Menu</button>
      {weaponMenuOpen && (
        <WeaponSelector
          weapons={[
            WeaponBazooka,
            WeaponGrenade,
            WeaponShotgun,
            WeaponGrenade,
            WeaponShotgun,
            WeaponGrenade,
            WeaponShotgun,
          ]}
          onWeaponPicked={() => setWeaponMenuOpen(false)}
        />
      )}
    </main>
  );
};
