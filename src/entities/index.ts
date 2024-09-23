import { getAssets } from "../assets";
import { TestDummy } from "./phys/testDummy";

export function readAssetsForEntities(assets: ReturnType<typeof getAssets>): void {
    TestDummy.readAssets(assets);
}