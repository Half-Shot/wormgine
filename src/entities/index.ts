import { AssetPack } from "../assets";
import { Explosion } from "./explosion";
import { BazookaShell } from "./phys/bazookaShell";
import { Firework } from "./phys/firework";
import { Grenade } from "./phys/grenade";
import { Mine } from "./phys/mine";
import { PhysicsEntity } from "./phys/physicsEntity";
import { TestDummy } from "./playable/testDummy";
import { Worm } from "./playable/worm";

/**
 * Should be called during game startup to load all assets to
 * entitires that need them.
 * @param assets 
 */
export function readAssetsForEntities(assets: AssetPack): void {
    BazookaShell.readAssets(assets);
    Grenade.readAssets(assets);
    Mine.readAssets(assets);
    TestDummy.readAssets(assets);
    Firework.readAssets(assets);
    Worm.readAssets(assets);
    Explosion.readAssets(assets);
    PhysicsEntity.readAssets(assets);
}

function entityToType() {

}