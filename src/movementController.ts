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
        move.x - 0.5,
        move.y - 0.25,
    );

    // Always move to whatever y delta is lower ( as in higher )
    let topYDelta = move.y;
    

    const initialCollisionShape = new Cuboid(objHalfWidth, objHalfHeight);
    debugData = { rayCoodinate, shape: initialCollisionShape };

    // TODO: Render this shape!
    const collides = world.checkCollisionShape(new Coordinate(currentTranslation.x, currentTranslation.y), rayCoodinate.toWorldVector(), initialCollisionShape, physObject.collider);
    let canTravel = collides.length === 0;
    for (const c of collides) {
        const shape = c.collider.shape;
        const bodyT = c.collider.translation();
        if (currentTranslation.y - bodyT.y < maxSteppy.value) {
            // TODO: Support more types.
            const halfHeight = shape.type === ShapeType.Cuboid ? (shape as Cuboid).halfExtents.y : (shape as Ball).radius;

            // Step
            const potentialX = bodyT.x;
            const potentialY = bodyT.y - halfHeight - objHalfHeight;
            const yDelta = move.y-bodyT.y;
            if (yDelta < topYDelta) {
                continue;
            }
            
            // Check step is safe
            // if (world.checkCollisionShape(new Coordinate(potentialX, potentialY), physObject.collider.shape, physObject.collider).length){
            //     continue;
            // }
            move.y = potentialY;
            move.x = potentialX;
            topYDelta = yDelta;
            canTravel = true;
            console.log('canTravel');
        }
    }

    if (!canTravel) {
        return currentTranslation;
    }

    console.log("numColliders", collides.length);

    return move;
}