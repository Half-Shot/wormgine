import { Container } from "pixi.js";
import { GameWorld } from "../../world";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { WormInstance } from "../../logic";
import { EntityType } from "../type";
import { Grenade } from "./grenade";
import { getConditionTint, PlayableCondition } from "../playable/conditions";

/**
 * Grenade projectile.
 */
export class GasGrenade extends Grenade {
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
    super(position, initialForce, world, parent, timerSecs, owner, {
      applyCondition: PlayableCondition.Sickness,
      maxDamage: 10,
      explosionRadius: new MetersValue(3),
      damagesTerrain: false,
      explosionHue: getConditionTint([PlayableCondition.Sickness]) ?? 0xfffff,
      forceMultiplier: 0.25,
    });
  }

  recordState() {
    return {
      ...super.recordState(),
      type: EntityType.GasGrenade,
    };
  }
}
