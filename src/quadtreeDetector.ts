import { Body, Pairs } from "matter-js";
import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";

type QuadtreeItem = Rectangle<Body>;

// TODO: This doesn't handle *roaming* bodies that might move
// between quads.

/**
 * Uses a basic quadtree to calculate which objects within our world need to be
 * checked. Essentially stores all bodies in the world on behalf of the 
 * Detector class and returns a subset based on activity.
 */
export class QuadtreeDetector {
    public pairs: Pairs[] = [];
    private allBodies: Body[] = [];

    private lastCalculatedActiveBodies = 0;

    public get activeBodies() {
        return this.lastCalculatedActiveBodies;
    }

    public set bodies(newBodies) {
        this.allBodies = newBodies;
        // TODO: Do we need to reconstruct the *entire* quad for this.
        this.reconstructQuads();
    }

    public get bodies() {
        const rect = new Rectangle<void>({ x: 0, y: 0, width: 0, height: 0 });
        this.allBodies.filter(b => !b.isSleeping).forEach((body) => {
            const width = (body.bounds.max.x - body.bounds.min.x);
            const height = (body.bounds.max.y - body.bounds.min.y);
            const x = body.position.x - width/2;
            const y = body.position.y - height/2;

            rect.x = Math.min(rect.x, x);
            rect.y = Math.min(rect.y, y);
            rect.width = Math.max(rect.width, x + width/2);
            rect.height = Math.max(rect.height, y + height/2);
        });
    
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