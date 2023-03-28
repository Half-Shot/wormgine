import Matter, { Composite, Body, Vector, Bodies, Collision, Detector, Query, Bounds, Vertices } from "matter-js";
import { UPDATE_PRIORITY, Container, DisplayObject, Graphics, ViewSystem, Rectangle, Texture, Sprite, RenderTexture, ImageResource, ImageBitmapResource } from "pixi.js";
import { IMatterEntity } from "./entity";
import { SpriteEntity } from "./spriteEntity";

function rgbaToUint(red: number, green: number, blue: number, alpha = 255): number {
    const r = red & 0xFF;
    const g = green & 0xFF;
    const b = blue & 0xFF;
    const a = alpha & 0xFF;
    
    return (r << 24) + (g << 16) + (b << 8) + (a);
    
}

export class BitmapTerrain implements IMatterEntity {
    public readonly priority = UPDATE_PRIORITY.LOW;

    public get destroyed() {
        // Terrain cannot be destroyed...yet
        return false;
    }

    public static texture: Texture;

    private static SEGMENT_WIDTH = 5;
    private static TERRIAN_HEIGHT = 5;
    private static TERRAIN_VARIANCE = 15;

    private readonly gfx: Graphics = new Graphics();
    private readonly parts: Body[] = [];

    private readonly canvas: HTMLCanvasElement;
    private texture: Texture;
    private readonly sprite: Sprite;

    private textureModified: boolean;

    get bodies() {
        return this.parts;
    }

    constructor(viewWidth: number, viewHeight: number, private readonly composite: Composite) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = viewWidth;
        this.canvas.height = viewHeight;
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get render context of canvas');
        }
        const bitmap = (BitmapTerrain.texture.baseTexture.resource as ImageBitmapResource).source;
        context.drawImage(bitmap as CanvasImageSource, 0, 0);
        this.texture = Texture.from(this.canvas);
        this.sprite = new Sprite(this.texture);
        this.sprite.x = 0
        this.sprite.y = 20;

        // Calculate bounding boxes
        this.calculateBoundaryVectors();
    }

    calculateBoundaryVectors() {
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get render context of canvas');
        }
        const imgData = context.getImageData(0,0,this.canvas.width, this.canvas.height);
        const boundaryVectors = new Set<Vector>();
        const xBoundaryTracker= new Array(imgData.width);
        const yBoundaryTracker = new Array(imgData.height);
        const lengthOfOneRow = this.canvas.width*4;
        for (let i = 0; i < imgData.data.length; i += 4) {
            const x = i % lengthOfOneRow;
            const y = Math.ceil(i / lengthOfOneRow);
            const [r,g,b,a] = imgData.data.slice(i, i+4);
            if (a !== 0) {
                if (!xBoundaryTracker[x] || !yBoundaryTracker[y]) {
                    boundaryVectors.add(Vector.create(x,y));
                    xBoundaryTracker[x] = true;
                    yBoundaryTracker[y] = true;
                    imgData.data[i] = 255;
                    imgData.data[i+1] = 0;
                    imgData.data[i+2] = 0;
                    imgData.data[i+3] = 255;
                }
            } else if (a === 0 && (xBoundaryTracker[x] || yBoundaryTracker[y])) {
                boundaryVectors.add(Vector.create(x,y));
                imgData.data[i] = 255;
                imgData.data[i+1] = 0;
                imgData.data[i+2] = 0;
                imgData.data[i+3] = 255;
                xBoundaryTracker[x] = false;
                yBoundaryTracker[y] = false;
            } else {
                xBoundaryTracker[x] = false;
                yBoundaryTracker[y] = false;
            }
        }
        context.putImageData(imgData, 0,0);
        console.log(boundaryVectors);
        
    }

    async create(parent: Container<DisplayObject>, composite: Composite) {
        parent.addChild(this.gfx);
        parent.addChild(this.sprite);
        Composite.add(composite, this.parts);
    }

    update?(dt: number): void {
        this.gfx.clear();
        this.gfx.lineStyle(1, 0xFFBD01, 1);
        if (this.textureModified) {
            this.texture.update();
            this.textureModified = false;
        }

        // for (const rect of this.parts) {
        //     const gfxR = new Rectangle(rect.bounds.min.x, rect.bounds.min.y, rect.bounds.max.x - rect.bounds.min.x, rect.bounds.max.y - rect.bounds.min.y);
        //     this.gfx.drawShape(gfxR);
        // }
    }

    destroy(): void {
        throw new Error("Never destroyed.");
    }
}