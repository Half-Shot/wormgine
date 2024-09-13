import { Body } from "matter-js";
import { Graphics } from "pixi.js";

/**
 * Render a wireframe in pixi.js around a matter body.
 */
export class BodyWireframe {
    private gfx = new Graphics();

    public set enabled(value: boolean) {
        this.shouldRender = value;
    }

    public get enabled() {
        return this.shouldRender;
    }

    public get renderable() {
        return this.gfx;
    }

    constructor(private body: Body, private shouldRender = true) {
        
    }

    update() {
        // TODO: Wasteful?
        this.gfx.clear();
        if (!this.shouldRender) {
            return;
        }

        const width = (this.body.bounds.max.x - this.body.bounds.min.x);
        const height = (this.body.bounds.max.y - this.body.bounds.min.y);
        this.gfx.rect(this.body.position.x - width/2, this.body.position.y - height/2,width,height).stroke({width: 1, color: 0xFFBD01, alpha: 1});
    }
}