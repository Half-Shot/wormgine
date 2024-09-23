import { getAssets } from "../assets";
import { Mine } from "./phys/mine";
import { TestDummy } from "./phys/testDummy";

export function readAssetsForEntities(assets: ReturnType<typeof getAssets>): void {
    TestDummy.readAssets(assets);
    Mine.readAssets(assets);
}