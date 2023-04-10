import { Body } from "matter-js";
import { Container, Graphics, Rectangle } from "pixi.js";

/**
 * Render a wireframe in pixi.js around a matter body.
 */
export class BodyWireframe {
    private gfx = new Graphics();
    private shouldRender = false;

    public set enabled(value: boolean) {
        this.gfx.clear();
        this.shouldRender = value;
    }

    public get enabled() {
        return this.shouldRender;
    }

    public get renderable() {
        return this.gfx;
    }

    constructor(private body: Body) {
        
    }

    update() {
        if (!this.shouldRender) {
            return;
        }

        this.gfx.clear();
        this.gfx.lineStyle(1, 0xFFBD01, 1);
        const width = (this.body.bounds.max.x - this.body.bounds.min.x);
        const height = (this.body.bounds.max.y - this.body.bounds.min.y);
        this.gfx.drawShape(new Rectangle(this.body.position.x - width/2, this.body.position.y - height/2,width,height));
    }
}