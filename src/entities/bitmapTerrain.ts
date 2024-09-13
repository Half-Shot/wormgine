import { Composite, Body, Vector, Bodies, Query, Collision } from "matter-js";
import { UPDATE_PRIORITY, Container, Graphics, Rectangle, Texture, Sprite } from "pixi.js";
import { IMatterEntity } from "./entity";
import { generateQuadTreeFromTerrain, imageDataToTerrainBoundaries } from "../terrain";
import Flags from "../flags";

export type OnDamage = () => void;
export class BitmapTerrain implements IMatterEntity {
    public readonly priority = UPDATE_PRIORITY.LOW;

    public get destroyed() {
        // Terrain cannot be destroyed...yet
        return false;
    }

    private readonly gfx: Graphics = new Graphics();
    private parts: Body[] = [];
    private nearestTerrainPositionBodies = new Set();
    private nearestTerrainPositionPoint = Vector.create();

    private bounds: Rectangle;

    private readonly canvas: HTMLCanvasElement;
    private texture: Texture;
    private textureBackdrop: Texture;
    private readonly sprite: Sprite;
    private readonly spriteBackdrop: Sprite;
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
        

        const bitmap = texture.source.resource;
        context.drawImage(bitmap as CanvasImageSource,  (viewWidth / 2) - (texture.width / 2), viewHeight - texture.height);
        
        this.texture = Texture.from(this.canvas, true);
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

        Flags.on('toggleDebugView', (value) => {
            if (!value) {
                this.gfx.clear();
            }
        });

        // Calculate bounding boxes
        this.calculateBoundaryVectors();
    }

    addToWorld(parent: Container) {
        parent.addChild(this.spriteBackdrop, this.sprite, this.gfx);
    }

    calculateBoundaryVectors(boundaryX = 0, boundaryY = 0, boundaryWidth = this.canvas.width, boundaryHeight = this.canvas.height) {
        console.time('Generating terrain');
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get render context of canvas');
        }

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
        const { boundaries, boundingBox } = imageDataToTerrainBoundaries(boundaryX, boundaryY, imgData);
        this.bounds = boundingBox;

        // Turn it into a quadtree of rects
        const quadtreeRects = generateQuadTreeFromTerrain(boundaries, boundingBox.width, boundingBox.height, boundingBox.x, boundingBox.y);
        console.log("Found", quadtreeRects.length, "quads in terrain");

        console.log(this.sprite.x, this.sprite.y);

        // Now create the pieces
        const newParts: Body[] = [];
        for (const quad of quadtreeRects) {
            const body = Bodies.rectangle(quad.x + this.sprite.x, quad.y + this.sprite.y, quad.width, quad.height, { isStatic: true });
            newParts.push(body);
        }
        this.parts.push(...newParts);

        Composite.add(this.composite, newParts);
        console.timeEnd("Generating terrain");
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
        // context.fillStyle = 'green';
        // context.arc(imageX, imageY, radius + 15, 0, 2 * Math.PI);
        // context.fill();

        context.fillStyle = 'grey';
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

        // Remember to recalculate the collision paths
        this.calculateBoundaryVectors(snapshotX,snapshotY, snapshotWidth, snapshotHeight);
        const newTex = Texture.from(this.canvas);
        this.sprite.texture = newTex;
        this.texture.destroy();
        this.texture = newTex;
    }

    public update(): void {
        if (!Flags.DebugView) {
            return;
        }
        this.gfx.clear();
        for (const rect of this.parts) {
            let color = 0xFFBD01;
            if (this.nearestTerrainPositionBodies.has(rect)) {
                color = 0x00AA00;
            } else if (rect.isSleeping) {
                color = 0x0000FF;
            }
            this.gfx.rect(rect.position.x, rect.position.y, rect.bounds.max.x - rect.bounds.min.x, rect.bounds.max.y - rect.bounds.min.y).stroke({ width: 1, color });
        }
        this.gfx.rect(this.nearestTerrainPositionPoint.x, this.nearestTerrainPositionPoint.y, 1, 1).stroke({width: 5, color: 0xFF0000});
    }

    public entityOwnsBody(bodyId: number) {
        // TODO: Use a set
        return this.parts.some(b => b.id === bodyId);
    }

    public getNearestTerrainPosition(point: Vector, width: number, maxHeightDiff: number, xDirection = 0): {point?: Vector, fell: boolean} {
        // This needs a rethink, we really want to have it so that the character's "platform" is visualised
        // by this algorithm. We want to figure out if we can move left or right, and if not if we're going to fall.

        this.nearestTerrainPositionBodies.clear();
        this.nearestTerrainPositionPoint = point;

        // First filter for all the points within the range of the point.
        const filteredPoints = this.parts.filter((p) => {
            return p.position.x < point.x + width + xDirection && 
                p.position.x > point.x - width - xDirection && 
                p.position.y > point.y - maxHeightDiff
        });

        // This needs to answer the following as quickly as possible:

        // Can we go to the next x point without falling?
        let closestTerrainPoint: Vector|undefined;

        let rejectedPoints: Body[] = [];

        for (const terrain of filteredPoints) {
            const terrainPoint = terrain.position;
            const distY = Math.abs(terrainPoint.y - point.y);
            if (xDirection < 0 && terrainPoint.x - point.x > xDirection) {
                // If moving left, -3
                continue;
            }
            if (xDirection > 0 && terrainPoint.x - point.x < xDirection) {
                // If moving right
                continue;
            }
            if (distY > maxHeightDiff) {
                rejectedPoints.push(terrain);
                continue;
            }
            const distX = Math.abs(terrainPoint.x - (point.x + xDirection));
            const prevDistX = closestTerrainPoint ? Math.abs(closestTerrainPoint.x - (point.x + xDirection)) : Number.MAX_SAFE_INTEGER;
            if (distX < prevDistX) {
                closestTerrainPoint = terrainPoint;
            }
        }

        if (closestTerrainPoint) {
            return { point: closestTerrainPoint, fell: false};
        }

        // We have fallen, look for the closest X position to land on.
        for (const terrain of rejectedPoints) {
            const terrainPoint = terrain.position;
            const distX = Math.abs(terrainPoint.x - (point.x + xDirection));
            const prevDistX = closestTerrainPoint ? Math.abs(closestTerrainPoint.x - (point.x + xDirection)) : Number.MAX_SAFE_INTEGER;
            if (distX < prevDistX && distX > 15) {
                console.log(distX);
                closestTerrainPoint = terrainPoint;
            }
        }

        return {
            point: closestTerrainPoint,
            fell: true,
        };
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