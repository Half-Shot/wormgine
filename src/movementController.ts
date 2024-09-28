import { Ball, Cuboid, Shape, ShapeType, Vector2 } from "@dimforge/rapier2d-compat";
import { GameWorld, RapierPhysicsObject } from "./world";
import { add, Coordinate, MetersValue, mult } from "./utils";

export let debugData: {
    rayCoodinate: Coordinate,
    shape: Shape,
};

export function calculateMovement(physObject: RapierPhysicsObject, movement: Vector2, maxSteppy: MetersValue, world: GameWorld): Vector2 {
    const currentTranslation = physObject.collider.translation();
    const move = mult(add(
        currentTranslation,
        movement,
    ), { x: 1, y: 1 });

    const {y: objHalfHeight, x: objHalfWidth } = (physObject.collider.shape as Cuboid).halfExtents;
    // Get the extremity.
    const rayCoodinate = new Coordinate(
        move.x,
        // Increase the bounds to the steppy position.
        move.y  - maxSteppy.value,
    );

    // Increase by steppy amount.
    const initialCollisionShape = new Cuboid(objHalfWidth, objHalfHeight - maxSteppy.value);
    debugData = { rayCoodinate, shape: initialCollisionShape };

    const collides = world.checkCollisionShape(rayCoodinate, initialCollisionShape, physObject.collider);
    // Pop the highest collider
    const highestCollider = collides.sort((a,b) => a.collider.translation().y-b.collider.translation().y)[0];

    // No collisions, go go go!
    if (!highestCollider) {
        return move;
    }

    const shape = highestCollider.collider.shape;
    const bodyT = highestCollider.collider.translation();
    const stepSize = currentTranslation.y - bodyT.y;
    console.log({stepSize, currentTranslation: currentTranslation.y, bodyT: bodyT.y})
    if (stepSize > maxSteppy.value) {
        return currentTranslation;
    }
    // TODO: Support more types.
    const halfHeight = shape.type === ShapeType.Cuboid ? (shape as Cuboid).halfExtents.y : (shape as Ball).radius;

    // Step
    const potentialX = bodyT.x;
    // Crop a bit off the top to avoid colliding with it.
    const potentialY = bodyT.y - halfHeight - objHalfHeight - 0.01;
    
    // Check step is safe
    debugData = { rayCoodinate: new Coordinate(potentialX, potentialY), shape: physObject.collider.shape }
    if (world.checkCollisionShape(new Coordinate(potentialX, potentialY), physObject.collider.shape, physObject.collider).length){
        return currentTranslation;
    }
    move.y = potentialY;
    move.x = potentialX;
    return move;
}