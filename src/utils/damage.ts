import { Collider, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "./coodinate";
import { GameWorld, PIXELS_PER_METER } from "../world";
import { Explosion, ExplosionsOptions } from "../entities/explosion";
import { Container } from "pixi.js";
import { OnDamageOpts } from "../entities/entity";
import { BitmapTerrain } from "../entities/bitmapTerrain";

interface Opts extends Partial<ExplosionsOptions>, OnDamageOpts {}

export function handleDamageInRadius(
  gameWorld: GameWorld,
  parent: Container,
  point: Vector2,
  radius: MetersValue,
  opts: Opts,
  ignoreCollider?: Collider,
) {
  // Detect if anything is around us.
  // We actually target a larger area than the resulting crater as it's
  // more realistic.
  const explosionCollidesWith = gameWorld.checkCollision(
    new Coordinate(point.x, point.y),
    radius.multiply(1.33),
    ignoreCollider,
  );
  for (const element of explosionCollidesWith) {
    if (element instanceof BitmapTerrain && opts.damagesTerrain === false) {
      continue;
    }
    element.onDamage?.(point, radius, opts);
  }
  gameWorld.addEntity(
    Explosion.create(
      parent,
      { x: point.x * PIXELS_PER_METER, y: point.y * PIXELS_PER_METER },
      radius.multiply(1.33),
      opts,
    ),
  );
}
