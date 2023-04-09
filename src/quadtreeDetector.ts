import { Bodies, Body, Pairs } from "matter-js";
import { Quadtree, Rectangle } from "@timohausmann/quadtree-ts";

type QuadtreeItem = Rectangle<Body>;

export class QuadtreeDetector {
    public pairs: Pairs[] = [];
    private allBodies: Body[] = [];

    private lastCalculatedActiveBodies = 0;

    public set bodies(newBodies) {
        this.allBodies = newBodies;
        this.reconstructQuads();
    }

    public get activeBodies() {
        return this.lastCalculatedActiveBodies;
    }

    public get bodies() {

        const rect = new Rectangle<any>({ x: 0, y: 0, width: 0, height: 0 });
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

    constructor(private width: number,private height: number) {

        this.tree = new Quadtree({width,height, maxObjects: 8});
    }

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