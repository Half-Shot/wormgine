import { UPDATE_PRIORITY, Container, Graphics, Rectangle, Texture, Sprite } from "pixi.js";
import { IPhysicalEntity } from "./entity";
import { generateQuadTreeFromTerrain, imageDataToTerrainBoundaries } from "../terrain";
import Flags from "../flags";
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../world";
import { Collider, ColliderDesc, RigidBody, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "../utils/coodinate";
import Logger from "../log";

const logger = new Logger('BitmapTerrain');

export type OnDamage = () => void;

/**
 * The terrain that objects sit upon. May be damanged by entities.
 */
export class BitmapTerrain implements IPhysicalEntity {
    public readonly priority = UPDATE_PRIORITY.LOW;
    private static readonly collisionBitmask = collisionGroupBitmask(CollisionGroups.WorldObjects, [CollisionGroups.Terrain, CollisionGroups.WorldObjects, CollisionGroups.Player]);

    public get destroyed() {
        // Terrain cannot be destroyed.
        return false;
    }

    private readonly gfx: Graphics = new Graphics();
    private parts: RapierPhysicsObject[] = [];

    private bounds: Rectangle;

    private readonly foregroundCanvas: HTMLCanvasElement;
    private readonly backgroundCanvas: HTMLCanvasElement;
    private texture: Texture;
    private textureBg: Texture;
    private readonly sprite: Sprite;
    private readonly spriteBackdrop: Sprite;
    // collider.handle -> fn
    private registeredDamageFunctions = new Map<number,OnDamage>();
    
    static create(viewWidth: number, viewHeight: number, gameWorld: GameWorld, texture: Texture) {
        return new BitmapTerrain(viewWidth, viewHeight, gameWorld, texture);
    }

    static drawToCanvas(viewWidth: number, viewHeight: number, texture: Texture) {
        const canvas = document.createElement('canvas')
        canvas.width = viewWidth;
        canvas.height = viewHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get render context of canvas');
        }
        const bitmap = texture.source.resource;
        context.drawImage(bitmap as CanvasImageSource,  (viewWidth / 2) - (texture.width / 2), viewHeight - texture.height);
        return canvas;
    }

    private constructor(viewWidth: number, viewHeight: number, private readonly gameWorld: GameWorld, texture: Texture) {
        this.foregroundCanvas = BitmapTerrain.drawToCanvas(viewWidth, viewHeight, texture);        
        this.texture = Texture.from(this.foregroundCanvas, true);
        this.sprite = new Sprite(this.texture);
        this.sprite.anchor.x = 0;
        this.sprite.anchor.y = 0;

        // Somehow make rain fall infront of this.
        this.backgroundCanvas = BitmapTerrain.drawToCanvas(viewWidth, viewHeight, texture);    
        this.textureBg = Texture.from(this.foregroundCanvas, true);  
        this.spriteBackdrop = new Sprite(Texture.from(this.textureBg._source, true));
        this.spriteBackdrop.anchor.x = 0;
        this.spriteBackdrop.anchor.y = 0;
        this.spriteBackdrop.tint = '0x222222';

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

    calculateBoundaryVectors(boundaryX = 0, boundaryY = 0, boundaryWidth = this.foregroundCanvas.width, boundaryHeight = this.foregroundCanvas.height) {
        console.time('Generating terrain');
        const context = this.foregroundCanvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get render context of canvas');
        }

        // Remove everything within the boundaries 
        const removableBodies = this.parts.filter(
            (b) => {
                let tr = b.body.translation();
                tr = { x: tr.x * PIXELS_PER_METER, y: tr.y * PIXELS_PER_METER };
                return (tr.x >= boundaryX && tr.x <= boundaryX + boundaryWidth) && 
            (tr.y >= boundaryY && tr.y <= boundaryY + boundaryHeight)}
        )


        for (const body of removableBodies) {
            this.gameWorld.removeBody(body);
            const damageFn = this.registeredDamageFunctions.get(body.collider.handle);
            if (damageFn) {
                this.registeredDamageFunctions.delete(body.collider.handle);
                damageFn?.();
            }
        }
        // TODO: Fix this.
        this.parts = this.parts.filter(b => !removableBodies.some(rB => b.body.handle === rB.body.handle));
        const imgData = context.getImageData(boundaryX, boundaryY, boundaryWidth, boundaryHeight);
        const { boundaries, boundingBox } = imageDataToTerrainBoundaries(boundaryX, boundaryY, imgData);
        this.bounds = boundingBox;

        // Turn it into a quadtree of rects
        const quadtreeRects = generateQuadTreeFromTerrain(boundaries, boundingBox.width, boundingBox.height, boundingBox.x, boundingBox.y);
        logger.debug("Found", quadtreeRects.length, "quads in terrain");

        // Now create the pieces
        const newParts: RapierPhysicsObject[] = [];
        for (const quad of quadtreeRects) {
            const body = this.gameWorld.createRigidBodyCollider(
                ColliderDesc.cuboid(quad.width/(PIXELS_PER_METER*2), quad.height/(PIXELS_PER_METER*2))
                .setCollisionGroups(BitmapTerrain.collisionBitmask)
                .setSolverGroups(BitmapTerrain.collisionBitmask),
                
                RigidBodyDesc.fixed().setTranslation(
                    (quad.x + this.sprite.x)/PIXELS_PER_METER, (quad.y + this.sprite.y)/PIXELS_PER_METER)
            )
            newParts.push(body);
        }
        this.parts.push(...newParts);

        this.gameWorld.addBody(this, ...newParts.map(p => p.collider));
        console.timeEnd("Generating terrain");
    }

    onDamage(point: Vector2, radius: MetersValue) {
        logger.debug(`Terrain took damaged (${point.x} ${point.y}`,radius);
        const context = this.foregroundCanvas.getContext('2d');
        if (!context) {
            throw Error('Failed to get context');
        }

        // Optmise this check!
        const imageX = (point.x*PIXELS_PER_METER) - this.sprite.x;
        const imageY = (point.y*PIXELS_PER_METER) - this.sprite.y;
        const snapshotX = (imageX-radius.pixels) - 30;
        const snapshotY = (imageY-radius.pixels) - 30;
        const snapshotWidth = (radius.pixels*3);
        const snapshotHeight = (radius.pixels*3);

        // Fetch the current image
        const before = context.getImageData(snapshotX,snapshotY, snapshotWidth, snapshotHeight);
        // Draw a circle

        // Give the exploded area a border
        // context.fillStyle = 'green';
        // context.arc(imageX, imageY, radius + 15, 0, 2 * Math.PI);
        // context.fill();

        context.fillStyle = 'grey';
        context.beginPath();
        context.arc(imageX, imageY, radius.pixels, 0, 2 * Math.PI);
        context.fill();


        const smallerRadius = radius.pixels / 3;
        if (smallerRadius) {
            const beforeBg = context.getImageData(snapshotX,snapshotY, snapshotWidth, snapshotHeight);
            const contextBg = this.backgroundCanvas.getContext('2d');
            if (!contextBg) {
                throw Error('Failed to get context');
            }
            contextBg.fillStyle = 'grey';
            contextBg.beginPath();
            const offset = (radius.pixels/2) - smallerRadius;
            contextBg.arc(offset + imageX, offset + imageY, smallerRadius, 0, 2 * Math.PI);
            contextBg.fill();

            const afterBg = contextBg.getImageData(snapshotX,snapshotY, snapshotWidth, snapshotHeight);

            // See what has changed, hopefully a red cricle!
            for (let i = 0; i < before.data.length; i += 4) {
                const oldDataValue = beforeBg.data[i]+beforeBg.data[i+1]+beforeBg.data[i+2]+beforeBg.data[i+3];
                const newDataValue = afterBg.data[i]+afterBg.data[i+1]+afterBg.data[i+2]+afterBg.data[i+3];
                if (oldDataValue !== newDataValue) {
                    // Zero the alpha channel for anything that has changed...like a red cricle
                    afterBg.data[i+0] = 0;
                    afterBg.data[i+1] = 0;
                    afterBg.data[i+2] = 0;
                    afterBg.data[i+3] = 0;
                }
            }
            contextBg.putImageData(afterBg, snapshotX, snapshotY);
            const newTex = Texture.from(this.backgroundCanvas);
            this.spriteBackdrop.texture = newTex;
            this.textureBg.destroy();
            this.textureBg = newTex;
        }



        // Fetch the new image
        const after = context.getImageData(snapshotX,snapshotY, snapshotWidth, snapshotHeight);

        // See what has changed, hopefully a red cricle!
        for (let i = 0; i < before.data.length; i += 4) {
            const oldDataValue = before.data[i]+before.data[i+1]+before.data[i+2]+before.data[i+3];
            const newDataValue = after.data[i]+after.data[i+1]+after.data[i+2]+after.data[i+3];
            if (oldDataValue !== newDataValue) {
                // Zero the alpha channel for anything that has changed...like a red cricle
                after.data[i+0] = 0;
                after.data[i+1] = 0;
                after.data[i+2] = 0;
                after.data[i+3] = 0;
            }
        }


        // Show the new image with our newly created hole.
        context.putImageData(after, snapshotX, snapshotY);

        // Remember to recalculate the collision paths
        this.calculateBoundaryVectors(snapshotX,snapshotY, snapshotWidth, snapshotHeight);
        const newTex = Texture.from(this.foregroundCanvas);
        this.sprite.texture = newTex;
        this.texture.destroy();
        this.texture = newTex;
    }

    public update(): void {
        if (!Flags.DebugView) {
            return;
        }
    }

    public getNearestTerrainPosition(point: Vector2, width: number, maxHeightDiff: number, xDirection = 0): {point: Vector2, fell: false}|{fell: true, point: null} {
        // This needs a rethink, we really want to have it so that the character's "platform" is visualised
        // by this algorithm. We want to figure out if we can move left or right, and if not if we're going to fall.

        // First filter for all the points within the range of the point.
        const filteredPoints = this.parts.filter((p) => {
            return p.body.translation().x < point.x + width + xDirection && 
                p.body.translation().x > point.x - width - xDirection && 
                p.body.translation().y > point.y - maxHeightDiff
        });

        // This needs to answer the following as quickly as possible:

        // Can we go to the next x point without falling?
        let closestTerrainPoint: Vector2|undefined;

        const rejectedPoints: RigidBody[] = [];

        for (const terrain of filteredPoints) {
            const terrainPoint = terrain.body.translation();
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
                rejectedPoints.push(terrain.body);
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

        logger.verbose("Rejected points from getNearestTerrainPosition", rejectedPoints);

        // We have fallen, look for the closest X position to land on.
        return {
            point: null,
            fell: true,
        };
    }

    public pointInTerrain(point: Coordinate): boolean {
        // Avoid costly iteration with this one neat trick.
        if (!this.bounds.contains(point.screenX, point.screenY)) {
            return false;
        }
        return this.gameWorld.pointInAnyObject(point);
    }

    public registerDamageListener(collider: Collider, fn: OnDamage) {
        this.registeredDamageFunctions.set(collider.handle, fn);
    }

    destroy(): void {
        throw new Error("Never destroyed.");
    }
}