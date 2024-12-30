import { FunctionalComponent } from "preact";
import { IWeaponCode, IWeaponDefiniton } from "../../weapons/weapon";
import styles from "./weapon-select.module.css";
import { pointOnRadius } from "../../utils";
import { useAnimate } from "framer-motion";
import { useEffect, useMemo, useState } from "preact/hooks";

const ANIMATION_DURATION = 0.075;

export const WeaponSelector: FunctionalComponent<{
  weapons: IWeaponDefiniton[] | null;
  onWeaponPicked: (code: IWeaponCode) => void;
}> = ({ weapons, onWeaponPicked }) => {
  const [selectedWeapon, setSelectedWeapon] = useState<number>(-1);
  const [weaponSet, setWeaponSet] = useState<IWeaponDefiniton[]>([]);
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
                      onWeaponPicked(weapon.code);
                    }}
                    onMouseOver={() => {
                      setSelectedWeapon(i);
                    }}
                    className={selectedWeapon === i ? styles.selected : ""}
                  >
                    <img
                      src={weapon.icon}
                      style={{ width: `${weapon.iconWidth}px` }}
                    ></img>
                  </button>
                </li>
              );
            })}
            <p className={styles.weaponText}>
              {weaponSet[selectedWeapon]?.name || "Select a weapon"}
            </p>
          </ul>
        </div>
      )}
    </div>
  );
};
