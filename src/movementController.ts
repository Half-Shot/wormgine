import { Vector2 } from "@dimforge/rapier2d-compat";
import { GameWorld, RapierPhysicsObject } from "./world";
import { add, Coordinate, MetersValue, mult } from "./utils";

const maxStep = new MetersValue(1.5);

export function calculateMovement(physObject: RapierPhysicsObject, movement: Vector2, world: GameWorld): Vector2 {
    const currentTranslation = physObject.collider.translation();
    const move = mult(add(
        currentTranslation,
        movement,
    ), { x: 1, y: 1 });

    const rayCoodinate = new Coordinate(
        move.x -0.03,
        move.y -0.09,
    );

    // TODO: Render this shape!
    const collides = world.checkCollisionShape(rayCoodinate, physObject.collider.shape, physObject.collider);
    let canTravel = collides.length === 0;
    for (const c of collides) {
        const bodyT = c.collider.translation();
        console.log(currentTranslation.y - bodyT.y);
        if (currentTranslation.y - bodyT.y < maxStep.value) {
            console.log('step!', bodyT.y - 0.10);
            // Step
            move.y = Math.min(move.y, bodyT.y - 0.10);
            canTravel = true;
        }
    }
    // Find closest shape along the x axis.
    console.log(currentTranslation,'+', movement, '=', move, collides);

    if (!canTravel) {
        console.log("Can't travel");
        return currentTranslation;
    }

    return move;
}