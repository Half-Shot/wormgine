import { AssetPack } from "../assets";
import { Explosion } from "./explosion";
import { BazookaShell } from "./phys/bazookaShell";
import { Firework } from "./phys/firework";
import { GasGrenade } from "./phys/gas-grenade";
import { Grenade } from "./phys/grenade";
import { HomingMissile } from "./phys/homingMissile";
import { Mine } from "./phys/mine";
import { PhysicsEntity } from "./phys/physicsEntity";
import { WeaponTarget } from "./phys/target";
import { TestDummy } from "./playable/testDummy";
import { Worm } from "./playable/worm";
import { Water } from "./water";

/**
 * Should be called during game startup to load all assets to
 * entitires that need them.
 * @param assets
 */
export async function readAssetsForEntities(assets: AssetPack): Promise<void> {
  const p = Water.readAssets();
  BazookaShell.readAssets(assets);
  Grenade.readAssets(assets);
  GasGrenade.readAssets(assets);
  Mine.readAssets(assets);
  TestDummy.readAssets(assets);
  Firework.readAssets(assets);
  Worm.readAssets(assets);
  Explosion.readAssets(assets);
  PhysicsEntity.readAssets(assets);
  HomingMissile.readAssets(assets);
  WeaponTarget.readAssets(assets);
  await p;
}
