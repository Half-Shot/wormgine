import { FunctionalComponent } from "preact";
import { IWeaponCode, IWeaponDefiniton } from "../../weapons/weapon";
import styles from "./weapon-select.module.css";
import { pointOnRadius } from "../../utils";
import { motion } from "motion/react";
import { useEffect, useState } from "preact/hooks";

export const WeaponSelector: FunctionalComponent<{
  weapons: IWeaponDefiniton[] | null;
  onWeaponPicked: (code: IWeaponCode) => void;
}> = ({ weapons, onWeaponPicked }) => {
  const visible = !!weapons;

  const [selectedWeapon, setSelectedWeapon] = useState<number>(-1);
  const [weaponSet, setWeaponSet] = useState<IWeaponDefiniton[]>([]);
  useEffect(() => {
    if (weapons) {
      setSelectedWeapon(-1);
      setWeaponSet(weapons);
    }
  }, [weapons]);

  const radiansPerItem = weaponSet.length
    ? (2 * Math.PI) / weaponSet.length
    : 0;
  // No animation initally.
  return (
    <motion.div
      transition={{
        duration: (weapons?.length ?? 0) + weaponSet.length ? 0.075 : 0,
        delay: 0,
        ease: "linear",
      }}
      animate={{ opacity: visible ? 1 : 0 }}
      exit={{ opacity: 0 }}
    >
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
    </motion.div>
  );
};
