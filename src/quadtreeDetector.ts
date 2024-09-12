import { Body, Pairs, Detector, Collision } from "matter-js";
import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";

type QuadtreeItem = Rectangle<Body>;

// TODO: This doesn't handle *roaming* bodies that might move
// between quads.

/**
 * Uses a basic quadtree to calculate which objects within our world need to be
 * checked. Essentially stores all bodies in the world on behalf of the 
 * Detector class and returns a subset based on activity.
 */
export class QuadtreeDetector implements Detector {
    public pairs: Pairs[] = [];
    public collisions: Collision[] = [];
    private allBodies: Body[] = [];

    private lastCalculatedActiveBodies = 0;
    private lastRegion?: Rectangle<Body>;

    public get activeBodies() {
        return this.lastCalculatedActiveBodies;
    }

    public get activeRegion() {
        return this.lastRegion;
    }

    public set bodies(newBodies) {
        this.allBodies = newBodies;
        // TODO: Do we need to reconstruct the *entire* quad for this.
        this.reconstructQuads();
    }

    public get bodies() {
        const rect = new Rectangle<Body>({ x: 100000, y: 100000, width: 0, height: 0 });
        this.allBodies.forEach((body) => {
            const width = (body.bounds.max.x - body.bounds.min.x);
            const height = (body.bounds.max.y - body.bounds.min.y);
            const x = body.position.x - width/2;
            const y = body.position.y - height/2;

            // TODO: This needs revisiting.
            rect.x = Math.max(0, Math.min(rect.x, x) - 100);
            rect.y = Math.max(0, Math.min(rect.y, y) - 100);
            rect.width = Math.max(0, Math.max(rect.width, (x + width/2) - rect.x) + 100);
            rect.height = Math.max(0, Math.max(rect.height, (y + height/2) - rect.y) + 100);
        });
        this.lastRegion = rect;
    
        if (rect.x + rect.y + rect.width + rect.height === 0) {
            return [];
        }

        if (rect.x > this.width || rect.y > this.height) {
            return [];
        }
    
        const foundBodies = this.tree.retrieve(rect).map(i => i.data) as Body[];
        this.lastCalculatedActiveBodies = foundBodies.length;

        return foundBodies;
    }

    private readonly tree: Quadtree<QuadtreeItem>;

    /**
     * @param width Width of the world.
     * @param height Height of the world.
     */
    constructor(private width: number,private height: number) {
        this.tree = new Quadtree({
            width,
            height
        });
    }

    /**
     * Reconstruct the quad tree.
     */
    reconstructQuads() {
        this.tree.clear();
        for (const body of this.allBodies) {
            this.tree.insert(new Rectangle({
                x: body.position.x,
                y: body.position.y,
                width: body.bounds.max.x-body.bounds.min.x,
                height: body.bounds.max.y-body.bounds.min.y,
                data: body,
            }));
        }
    }
}