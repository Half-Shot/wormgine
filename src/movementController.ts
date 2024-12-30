import {
  Ball,
  Collider,
  Cuboid,
  Shape,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { GameWorld, RapierPhysicsObject } from "./world";
import { add, Coordinate, MetersValue, mult } from "./utils";
import Logger from "./log";

const logger = new Logger("movementController");

export let debugData: {
  rayCoodinate: Coordinate;
  shape: Cuboid;
};

export function getHalfHeight(shape: Shape) {
  if (shape instanceof Cuboid) {
    return shape.halfExtents.y;
  }
  if (shape instanceof Ball) {
    return shape.radius;
  }
  throw Error("Unknown shape");
}

export function getGroundDifference(colliderA: Collider, colliderB: Collider) {
  const [higher, lower] = [colliderA, colliderB].sort(
    (a, b) => b.translation().y - a.translation().y,
  );
  const higherBottom = higher.translation().y - getHalfHeight(higher.shape);
  const lowerTop = lower.translation().y + getHalfHeight(lower.shape);
  return Math.round((lowerTop - higherBottom) * 100) / 100;
}

export function calculateMovement(
  physObject: RapierPhysicsObject,
  movement: Vector2,
  maxSteppy: MetersValue,
  world: GameWorld,
): Vector2 {
  const currentTranslation = physObject.body.translation();
  // Offset from current shape
  if (physObject.collider.shape instanceof Cuboid === false) {
    throw Error("calculateMovement only supports cuboid objects");
  }
  const currentShape = physObject.collider.shape as Cuboid;
  const move = add(
    mult(
      add(currentTranslation, movement),
      // TODO: Mutiply by a scaling factor?
      { x: 1, y: 1 },
      // Add shape extents.
    ),
    { y: 0, x: 0 },
  );

  const { y: objHalfHeight, x: objHalfWidth } = (
    physObject.collider.shape as Cuboid
  ).halfExtents;
  // Get the extremity.
  const rayCoodinate = new Coordinate(
    // Coodinate check in advance of the current shape
    move.x +
      (movement.x < 0
        ? currentShape.halfExtents.x * -1.5
        : currentShape.halfExtents.x * 1.5),
    // Increase the bounds to the steppy position.
    move.y - maxSteppy.value / 2,
  );

  // Increase by steppy amount.
  const initialCollisionShape = new Cuboid(
    objHalfWidth,
    objHalfHeight + maxSteppy.value,
  );
  debugData = { rayCoodinate, shape: initialCollisionShape };

  const collides = world.checkCollisionShape(
    rayCoodinate,
    initialCollisionShape,
    physObject.collider,
  );
  // Pop the highest collider
  const highestCollider = collides
    .filter((s) => !s.collider.isSensor())
    .sort((a, b) => a.collider.translation().y - b.collider.translation().y)[0];

  // No collisions, go go go!
  if (!highestCollider) {
    logger.debug("No collision");
    return move;
  }

  // const shape = highestCollider.collider.shape;
  const bodyT = highestCollider.collider.translation();
  const stepSize = currentTranslation.y - bodyT.y;
  if (stepSize > maxSteppy.value) {
    return currentTranslation;
  }
  // TODO: Support more types.
  // const halfHeight = shape.type === ShapeType.Cuboid ? (shape as Cuboid).halfExtents.y : (shape as Ball).radius;

  // Step
  const differential = getGroundDifference(
    physObject.collider,
    highestCollider.collider,
  );
  if (differential >= 1.5) {
    return currentTranslation;
  } else if (differential > 0) {
    move.y -= differential + 0.1;
  }

  return move;

  // const newMove = new Coordinate(
  //     bodyT.x,
  //     // Crop a bit off the top to avoid colliding with it.
  //     bodyT.y - halfHeight - objHalfHeight - 0.01,
  // )
  // const newCollisionShape = new Cuboid(
  //     objHalfWidth,
  //     objHalfHeight,
  // );
  // console.log('wants to move to', highestCollider.collider.handle, highestCollider.collider.translation());

  // Check step is safe
  // console.log(debugData);
  // debugData = { rayCoodinate: newMove, shape: initialCollisionShape }
  // console.log(debugData);
  // const [secondaryCollision] = world.checkCollisionShape(newMove, newCollisionShape, highestCollider.collider);
  // if (secondaryCollision){
  //     //console.log('Collision!', secondaryCollision.collider.handle, secondaryCollision.collider.translation());
  //     return currentTranslation;
  // }
  // console.log('Moved');
  // return newMove.toWorldVector();
}
