import { Composite, Body, Vector, Bodies, Query, Collision } from "matter-js";
import { UPDATE_PRIORITY, Container, DisplayObject, Graphics, Rectangle, Texture, Sprite, ImageBitmapResource } from "pixi.js";
import { IMatterEntity } from "./entity";

export type OnDamage = () => void;
export class BitmapTerrain implements IMatterEntity {
    private static readonly explosionBorderSize = 10;

    public readonly priority = UPDATE_PRIORITY.LOW;
    public readonly drawDebugBorder = false;

    public get destroyed() {
        // Terrain cannot be destroyed...yet
        return false;
    }

    private readonly gfx: Graphics = new Graphics();
    private parts: Body[] = [];

    private bounds: Rectangle;

    private readonly canvas: HTMLCanvasElement;
    private texture: Texture;
    private textureBackdrop: Texture;
    private readonly sprite: Sprite;
    private readonly spriteBackdrop: Sprite;
    private lastBoundaryChange?: Rectangle;
    private registeredDamageFunctions = new Map<string,OnDamage>();
    
    static create(viewWidth: number, viewHeight: number, composite: Composite, texture: Texture) {
        return new BitmapTerrain(viewWidth, viewHeight, composite, texture);
    }

    private constructor(viewWidth: number, viewHeight: number, private readonly composite: Composite, texture: Texture) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = viewWidth;
        this.canvas.height = viewHeight;
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get render context of canvas');
        }
        

        const bitmap = (texture.baseTexture.resource as ImageBitmapResource).source;
        context.drawImage(bitmap as CanvasImageSource,  (viewWidth / 2) - (texture.width / 2), viewHeight - texture.height);
        this.texture = Texture.from(this.canvas);
        this.textureBackdrop = Texture.from(this.canvas.toDataURL());
        this.sprite = new Sprite(this.texture);
        this.sprite.anchor.x = 0;
        this.sprite.anchor.y = 0;

        // Somehow make rain fall infront of this.
        this.spriteBackdrop = new Sprite(this.textureBackdrop);
        this.spriteBackdrop.anchor.x = 0;
        this.spriteBackdrop.anchor.y = 0;
        this.spriteBackdrop.tint = '0x220000';

        this.bounds = new Rectangle(Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,0,0);

        // Calculate bounding boxes
        this.calculateBoundaryVectors();
    }

    addToWorld(parent: Container<DisplayObject>) {
        parent.addChild(this.spriteBackdrop, this.sprite, this.gfx);
    }

    calculateBoundaryVectors(boundaryX = 0, boundaryY = 0, boundaryWidth = this.canvas.width, boundaryHeight = this.canvas.height) {
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get render context of canvas');
        }

        this.lastBoundaryChange = new Rectangle(boundaryX, boundaryY, boundaryWidth, boundaryHeight);

        // Remove everything within the boundaries 
        const removableBodies = this.parts.filter(
            (b) => (b.position.x >= boundaryX && b.position.x <= boundaryX + boundaryWidth) && 
            (b.position.y >= boundaryY && b.position.y <= boundaryY + boundaryHeight)
        )

        console.log("Removing", removableBodies.length, "bodies");
        for (const body of removableBodies) {
            Composite.remove(this.composite, body);
            const key = body.position.x + "," + body.position.y;
            const damageFn = this.registeredDamageFunctions.get(key);
            if (damageFn) {
                this.registeredDamageFunctions.delete(key);
                damageFn?.();
            }
        }
        this.parts = this.parts.filter(b => !removableBodies.some(rB => b.id === rB.id));


        const imgData = context.getImageData(boundaryX, boundaryY, boundaryWidth, boundaryHeight);
        const boundaryVectors = new Set<Vector>();
        const xBoundaryTracker= new Array(imgData.width);
        const yBoundaryTracker = new Array(imgData.height);

        const lengthOfOneRow = imgData.width*4;
        for (let i = 0; i < imgData.data.length; i += 4) {
            const x = (i % lengthOfOneRow) / 4;
            const y = Math.ceil(i / lengthOfOneRow);
            const realX = x + boundaryX;
            const realY = y + boundaryY;
            const [,,,a] = imgData.data.slice(i, i+4);

            if (x === 0) {
                xBoundaryTracker[x] = false;
                yBoundaryTracker[y] = false;
            }

            if (a > 5) {
                if (!xBoundaryTracker[x] || !yBoundaryTracker[y]) {
                    // This is to stop us from drawing straight lines down
                    // when we have a boundary, but I don't know why this works.
                    if (x > 1 && y > 1) {
                        boundaryVectors.add(Vector.create(realX,realY));
                    }
                    xBoundaryTracker[x] = true;
                    yBoundaryTracker[y] = true;

                    this.bounds.x = Math.min(this.bounds.x, realX);
                    this.bounds.y = Math.min(this.bounds.y, realY);
                    this.bounds.width = Math.max(this.bounds.width, x-this.bounds.x);
                    this.bounds.height = Math.max(this.bounds.height, y-this.bounds.y);
                }
            } else if (a === 0) {
                if (xBoundaryTracker[x] || yBoundaryTracker[y]) {
                    boundaryVectors.add(Vector.create(realX,realY));
                    xBoundaryTracker[x] = false;
                    yBoundaryTracker[y] = false;
                }
            }
        }

        // Now create the pieces
        const newParts: Body[] = [];
        for (const vertex of boundaryVectors) {
            const body = Bodies.rectangle(vertex.x + this.sprite.x, vertex.y + this.sprite.y, 1, 1, { isStatic: true });
            newParts.push(body);
        }
        this.parts.push(...newParts);

        Composite.add(this.composite, newParts);

        if (this.drawDebugBorder) {
            this.gfx.clear();
            if (this.lastBoundaryChange) {
                this.gfx.drawRect(this.lastBoundaryChange.x, this.lastBoundaryChange.y, this.lastBoundaryChange.width, this.lastBoundaryChange.height);
            }
    
            for (const rect of this.parts) {
                this.gfx.lineStyle(1, rect.isSleeping ? 0x00AA00 : 0xFFBD01, 1);
                const gfxR = new Rectangle(rect.position.x, rect.position.y, 1, 1);
                this.gfx.drawShape(gfxR);
            }
        }
        console.log("Calculated bitmap terrain bounds to be", this.bounds);
    }

    onDamage(point: Vector, radius: number) {
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get context');
        }

        console.log('onDamage', point, radius);

        // Optmise this check!
        const imageX = point.x - this.sprite.x;
        const imageY = point.y - this.sprite.y;
        const snapshotX = (imageX-radius) - 30;
        const snapshotY = (imageY-radius) - 30;
        const snapshotWidth = (radius*3);
        const snapshotHeight = (radius*3);

        // Fetch the current image
        const before = context.getImageData(snapshotX,snapshotY, snapshotWidth, snapshotHeight);
        // Draw a circle
        context.beginPath();

        // Give the exploded area a border
        // context.fillStyle = 'gray';
        // context.arc(imageX, imageY, radius + BitmapTerrain.explosionBorderSize, 0, 2 * Math.PI);
        // context.fill();

        context.fillStyle = 'gray';
        context.arc(imageX, imageY, radius, 0, 2 * Math.PI);
        context.fill();

        // Fetch the new image
        const after = context.getImageData(snapshotX,snapshotY, snapshotWidth, snapshotHeight);

        // See what has changed, hopefully a red cricle!
        let diffPixels = 0;
        for (let i = 0; i < before.data.length; i += 4) {
            const oldDataValue = before.data[i]+before.data[i+1]+before.data[i+2]+before.data[i+3];
            const newDataValue = after.data[i]+after.data[i+1]+after.data[i+2]+after.data[i+3];
            if (oldDataValue !== newDataValue) {
                // Zero the alpha channel for anything that has changed...like a red cricle
                after.data[i+0] = 0;
                after.data[i+1] = 0;
                after.data[i+2] = 0;
                after.data[i+3] = 0;
                diffPixels++;
            }
        }

        // Show the new image with our newly created hole.
        context.putImageData(after, snapshotX, snapshotY);
        console.log('Updated texture', diffPixels);

        // Remember to recalculate the collision paths
        this.calculateBoundaryVectors(snapshotX,snapshotY, snapshotWidth, snapshotHeight);
        this.texture.update();
    }

    public entityOwnsBody(bodyId: number) {
        // TODO: Use a set
        return this.parts.some(b => b.id === bodyId);
    }

    public collidesWithTerrain(point: Vector, width: number, height: number): Collision|undefined {
        console.log(point, width, height);
        return Query.collides(
            Bodies.rectangle(
                point.x - width/2,
                point.y - height/2,
                width,
                height,
            ),
            this.parts,
        ).sort((a,b) => b.depth - a.depth)[0];
    }

    public getNearestTerrainPosition(point: Vector, width: number, maxHeightDiff: number, xDirection = 0) {
        let body: Body|undefined;
        let distance = Number.MAX_SAFE_INTEGER;
        for (const part of this.parts) {
            const distX = Math.abs(part.position.x - point.x);
            if (distX > width / 2) {
                continue;
            }
            if (xDirection < 0 && part.position.x - point.x > xDirection) {
                // If moving left, -3
                continue;
            }
            if (xDirection > 0 && part.position.x - point.x < xDirection) {
                // If moving left, -3
                continue;
            }
            const distY = Math.abs(part.position.y - point.y);
            if (point.y - part.position.y > maxHeightDiff) {
                // This is too high for us to scale
                continue;
            } else if (part.position.y - point.y > maxHeightDiff) {
                // This is a fall, allow it.
            }
            const newDistance = Math.sqrt(Math.pow(distX, 2) + Math.pow(distY, 2));
            if (newDistance < distance) {
                body = part;
                distance = newDistance;
            }
        }
        return body?.position;
    }

    public pointInTerrain(point: Vector, radius: number): Collision[] {
        // Avoid costly iteration with this one neat trick.
        if (!this.bounds.contains(point.x, point.y)) {
            return [];
        }
        return Query.collides(Bodies.circle(point.x, point.y, radius), this.parts);
    }

    public registerDamageListener(point: Vector, fn: OnDamage) {
        this.registeredDamageFunctions.set(point.x + "," + point.y, fn);
    }

    destroy(): void {
        throw new Error("Never destroyed.");
    }
}