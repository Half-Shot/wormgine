import { AssetPack } from "../assets";
import { BazookaShell } from "./phys/bazookaShell";
import { Firework } from "./phys/firework";
import { Grenade } from "./phys/grenade";
import { Mine } from "./phys/mine";
import { TestDummy } from "./phys/testDummy";

export function readAssetsForEntities(assets: AssetPack): void {
    BazookaShell.readAssets(assets);
    Grenade.readAssets(assets);
    TestDummy.readAssets(assets);
    Mine.readAssets(assets);
    Firework.readAssets(assets);
}