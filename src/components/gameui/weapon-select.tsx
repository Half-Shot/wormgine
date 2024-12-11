import { FunctionalComponent } from "preact";
import { IWeaponCode, IWeaponDefiniton } from "../../weapons/weapon";
import styles from "./weapon-select.module.css";
import { pointOnRadius } from "../../utils";

export const WeaponSelector: FunctionalComponent<{
    weapons: IWeaponDefiniton[]
    onWeaponPicked: (code: IWeaponCode) => void,
}> = ({weapons, onWeaponPicked}) => {
    const radiansPerItem = (2*Math.PI) / weapons.length;
    
    return <div className={styles.root}>
        <ul>
          {weapons.map((weapon, i) => {
            const point = pointOnRadius(-250, 250, radiansPerItem * i, 250);
            return <li className={styles.weaponOption} style={{top: -point.x, left: point.y}} key={weapon.code}>
              <button onClick={() => {
                onWeaponPicked(weapon.code);
              }}>
                {weapon.name}
                <img src={weapon.icon} style={{width: `${weapon.iconWidth}px`}}></img>
                </button>
          </li>})
          }
        </ul>
    </div>
}