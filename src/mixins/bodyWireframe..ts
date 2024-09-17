import { Body, Vector } from "matter-js";
import { Graphics, Text } from "pixi.js";

/**
 * Render a wireframe in pixi.js around a matter body.
 */


const globalWindow = (window as unknown as {debugPivotModX: number, debugPivotModY: number, debugRotation: number});

globalWindow.debugPivotModX = 0;
globalWindow.debugPivotModY = 0;
globalWindow.debugRotation = 0;
export class BodyWireframe {
    private gfx = new Graphics();
    private debugText = new Text({ 
        text: '',
        style: {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xFFFFFF,
            align: 'center',
        }
    });

    private shouldRender: boolean;
    public set enabled(value: boolean) {
        this.shouldRender = value;
        this.debugText.visible = value;
        this.gfx.visible = value;
    }

    public get enabled() {
        return this.shouldRender;
    }

    public get renderable() {
        return this.gfx;
    }

    private readonly width: number;
    private readonly height: number;

    constructor(private body: Body, enabled = true) {
        this.gfx.addChild(this.debugText);
        this.width = (this.body.bounds.max.x - this.body.bounds.min.x);
        this.height = (this.body.bounds.max.y - this.body.bounds.min.y);
        this.debugText.position.x = this.width + 5;

        // To make TS happy.
        this.shouldRender = enabled;
        this.enabled = enabled;
    }

    setDebugText(text: string) {
        this.debugText.text = text;
    }

    update() {
        // TODO: Wasteful?
        this.gfx.clear();
        if (!this.shouldRender) {
            return;
        }
        this.gfx.circle(this.width / 2, this.height / 2, 3).stroke({width: 1, color: 0xFF0000});
        this.gfx.rect(0, 0,this.width,this.height).stroke({width: 1, color: 0xFFBD01, alpha: 1});
        this.gfx.updateTransform({
            x: this.body.position.x - this.width/2,
            y: this.body.position.y - this.height/2,
            rotation: this.body.angle,
            // pivotX: globalWindow.debugPivotModX,
            // pivotY: globalWindow.debugPivotModY,
        });
        
    }
}