import { FunctionalComponent } from "preact";
import { IWeaponCode, IWeaponDefiniton } from "../../weapons/weapon";
import styles from "./weapon-select.module.css";
import { pointOnRadius } from "../../utils";
import { useAnimate } from "framer-motion";
import { useEffect, useMemo, useState } from "preact/hooks";
import { AmmoCount } from "../../interop/gamechannel";

const ANIMATION_DURATION = 0.075;

export const WeaponSelector: FunctionalComponent<{
  weapons: AmmoCount | null;
  onWeaponPicked: (code: IWeaponCode) => void;
}> = ({ weapons, onWeaponPicked }) => {
  const [selectedWeaponIndex, setSelectedWeapon] = useState<number>(-1);
  const [weaponSet, setWeaponSet] = useState<AmmoCount>([]);
  const shouldBeVisible = useMemo(() => weapons?.length, [weapons]);
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (weapons) {
      setSelectedWeapon(-1);
      setWeaponSet(weapons);
    }
  }, [weapons]);

  useEffect(() => {
    async function runAnim() {
      if (shouldBeVisible) {
        await animate(
          scope.current,
          { opacity: 0 },
          { duration: 0, ease: "linear" },
        );
        await animate(
          scope.current,
          { opacity: 1 },
          { duration: ANIMATION_DURATION, ease: "linear" },
        );
      } else {
        await animate(
          scope.current,
          { opacity: 0 },
          { duration: ANIMATION_DURATION, ease: "linear" },
        );
        setWeaponSet([]);
      }
    }
    if (!scope.current) {
      return;
    }
    void runAnim();
  }, [shouldBeVisible, scope.current]);

  const radiansPerItem = weaponSet.length
    ? (2 * Math.PI) / weaponSet.length
    : 0;

  function weaponDescription(wep: IWeaponDefiniton, ammo: number) {
    if (ammo === -1) {
      return `${wep.name} (∞)`;
    }
    if (ammo) {
      return `${wep.name} (${ammo})`;
    }
  }

  const selectedWeapon = weaponSet[selectedWeaponIndex];

  return (
    <div ref={scope}>
      {!weaponSet.length ? null : (
        <div
          className={styles.root}
          onMouseLeave={() => {
            setSelectedWeapon(-1);
          }}
        >
          <ul>
            {weaponSet.map((weapon, i) => {
              const wepData = weapon[0];
              const point = pointOnRadius(-250, 250, radiansPerItem * i, 250);
              return (
                <li
                  className={styles.weaponOption}
                  style={{ top: -point.x, left: point.y }}
                  key={i}
                >
                  <button
                    onClick={() => {
                      setSelectedWeapon(i);
                      onWeaponPicked(wepData.code);
                    }}
                    onMouseOver={() => {
                      setSelectedWeapon(i);
                    }}
                    className={selectedWeaponIndex === i ? styles.selected : ""}
                  >
                    <img
                      src={wepData.icon}
                      style={{ width: `${wepData.iconWidth}px` }}
                    ></img>
                  </button>
                </li>
              );
            })}
            <p className={styles.weaponText}>
              {selectedWeapon
                ? weaponDescription(...selectedWeapon)
                : "Select a weapon"}
            </p>
          </ul>
        </div>
      )}
    </div>
  );
};
