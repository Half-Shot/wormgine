import { Container, Texture } from "pixi.js";
import { GameWorld } from "../../world";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { WormInstance } from "../../logic";
import { EntityType } from "../type";
import { Grenade } from "./grenade";
import { getConditionTint, PlayableCondition } from "../playable/conditions";
import { AssetPack } from "../../assets";
import { ParticleTrail } from "../particletrail";

/**
 * Grenade projectile.
 */
export class GasGrenade extends Grenade {
  private static gasTexture: Texture;
  public static readAssets({ textures }: AssetPack) {
    GasGrenade.gasTexture = textures.potionGreen;
  }
  static create(
    parent: Container,
    world: GameWorld,
    position: Coordinate,
    initialForce: { x: number; y: number },
    timerSecs = 3,
    worm?: WormInstance,
  ) {
    const ent = new GasGrenade(
      position,
      initialForce,
      world,
      parent,
      timerSecs,
      worm,
    );
    world.addEntity(
      ParticleTrail.create(parent, ent.sprite.position, ent, {
        colours: [
          {
            color: "rgba(34, 204, 0, 0.47)",
            size: 10,
            chance: 2,
          },
          {
            color: "rgba(115, 241, 90, 0.81)",
            size: 3,
            chance: 4,
          },
          {
            color: "rgba(172, 204, 31, 0.84)",
            size: 5,
            chance: 2,
          },
        ],
        initialSpeed: { x: 0, y: 0.15 },
        acceleration: { x: 0, y: 0.05 },
      }),
    );
    parent.addChild(ent.sprite, ent.wireframe.renderable);
    return ent;
  }

  private constructor(
    position: Coordinate,
    initialForce: { x: number; y: number },
    world: GameWorld,
    parent: Container,
    timerSecs: number,
    owner?: WormInstance,
  ) {
    super(
      position,
      initialForce,
      world,
      parent,
      timerSecs,
      owner,
      {
        applyCondition: PlayableCondition.Sickness,
        maxDamage: 10,
        explosionRadius: new MetersValue(6),
        damagesTerrain: false,
        explosionHue: getConditionTint([PlayableCondition.Sickness]) ?? 0xfffff,
        forceMultiplier: 0.0025,
      },
      GasGrenade.gasTexture,
      0.15,
    );
  }

  recordState() {
    return {
      ...super.recordState(),
      type: EntityType.GasGrenade,
    };
  }
}
