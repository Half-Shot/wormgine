import Matter, { Composite, Body, Vector, Bodies, Collision, Detector, Query, Bounds, Vertices } from "matter-js";
import { UPDATE_PRIORITY, Container, DisplayObject, Graphics, ViewSystem, Rectangle } from "pixi.js";
import { IMatterEntity } from "./entity";

export class Terrain implements IMatterEntity {
    priority = UPDATE_PRIORITY.NORMAL;
    destroyed = false;

    private static SEGMENT_WIDTH = 5;
    private static TERRIAN_HEIGHT = 5;
    private static TERRAIN_VARIANCE = 15;

    private readonly gfx: Graphics = new Graphics();
    private readonly parts: Body[];

    get bodies() {
        return this.parts;
    }

    constructor(viewWidth: number, viewHeight: number, private readonly composite: Composite) {
        const width = viewWidth;
        const height = viewHeight - 200;

        // Draw the world
        const vertices: Vector[] = [];
        let i = 0;
        for (let x = 0; x < width + Terrain.SEGMENT_WIDTH; x += Terrain.SEGMENT_WIDTH) {
            const previousY = (vertices[i - 1]?.y ?? height);
            const variance = previousY + Math.round(Math.random() * Terrain.TERRAIN_VARIANCE) - (Terrain.TERRAIN_VARIANCE / 2);
            vertices.push(Vector.create(x, variance));
            i++;
        }
                
        const parts = [];
        for (let vI = 1; vI < vertices.length; vI++) {
            const last = vertices[vI - 1];
            const curr = vertices[vI];
            const newY = Math.min(last.y, curr.y);
            parts.push(Bodies.rectangle(last.x, newY, curr.x - last.x, Terrain.TERRIAN_HEIGHT, { isStatic: true }));
        }
        console.log(parts);
        this.parts = parts;

        // // Convert to simple bodies
        // this.terrainBody = Body.create({
        //     position: {
        //         y: height - 50,
        //         x: 6,
        //     },
        //     parts,
        //     isStatic: true,
        // });
    }

    async create(parent: Container<DisplayObject>, composite: Composite) {
        parent.addChild(this.gfx);
        Composite.add(composite, this.parts);
        //console.log(this.terrainBody.bounds);
    }

    update?(dt: number): void {
        this.gfx.clear();
        this.gfx.lineStyle(1, 0xFFBD01, 1);

        for (const rect of this.parts) {
            const gfxR = new Rectangle(rect.bounds.min.x, rect.bounds.min.y, rect.bounds.max.x - rect.bounds.min.x, rect.bounds.max.y - rect.bounds.min.y);
            this.gfx.drawShape(gfxR);
        }
    }

    onDamage(point: Vector, radius: number) {
        const explosionRadius = Bodies.circle(point.x, point.y, radius);
        this.gfx.lineStyle(1, 0xFFBD01, 1);
        this.gfx.drawCircle(point.x, point.y, radius);
        const collidedGround = Query.collides(explosionRadius, this.bodies);
        for (const collision of collidedGround) {
            const groundRect = collision.bodyA !== explosionRadius ? collision.bodyA : collision.bodyB;
            Composite.remove(this.composite, groundRect);
            this.bodies.splice(this.bodies.indexOf(groundRect), 1);
        }

        // TODO: Thoughts 2
        // - Remove anything intersecting explosionRadius
        // - Draw in new bodies around  the perimeter of the circle, using an algo of:
        // - Determine the impact points 
        // - Draw new parts along the radius of the circle between those two points.

        // Now, remove any colliding parts.
        // const explosionRadiusTimes2 = Bodies.circle(point.x, point.y, radius*2);
        // const allAffected = Query.region(this.bodies, explosionRadiusTimes2.bounds);
        // const toRemove = new Set<Body>();
        // for (const groundRect of allAffected) {
        //     // All the collision pieces
        //     for (const collision of Query.collides(groundRect, allAffected)) {
        //         if (collision.bodyA === collision.bodyB) {
        //             // Yes, this happens.
        //             continue;
        //         }
        //         const subA = Vector.magnitude(Vector.sub(point, collision.bodyA.position));
        //         const subB = Vector.magnitude(Vector.sub(point, collision.bodyB.position));

        //         console.log(subA, subB);

        //         if (subA > subB) {
        //             toRemove.add(collision.bodyB);
        //         } else {
        //             toRemove.add(collision.bodyA);
        //         }
        //     }
        // }

        // for (const body of toRemove) {
        //     Composite.remove(this.composite, body);
        //     this.bodies.splice(this.bodies.indexOf(body), 1);
        // }

        // // Finally, fill in gaps
        // const sortedRemaining = [...allAffected].filter(b => !toRemove.has(b)).sort(b => b.bounds.min.x);
        // for (let index = 0; index < sortedRemaining.length; index++) {
        //     const currentRect = sortedRemaining[index];
        //     const nextRect = sortedRemaining[index+1];
        //     if (!nextRect) {
        //         // At end;
        //         continue;
        //     }
        //     const gapX = Math.abs(nextRect.bounds.min.x - currentRect.bounds.max.x);
        //     const gapY = Math.abs(nextRect.bounds.min.y - currentRect.bounds.max.y);
        //     if (gapX > 10) {
        //         console.log('Found gap of', gapX, gapY);
        //     }
        // }
    }

    destroy(): void {
        throw new Error("Never destroyed.");
    }
}