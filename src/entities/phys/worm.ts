import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { Body, Bodies, Composite, Vector } from "matter-js";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { PhysicsEntity } from './physicsEntity';


enum WormState {
    Idle = 0,
    InMotion = 1,
}

export class Worm extends PhysicsEntity {
    private static readonly boundingWireframe = true;
    private static readonly FRICTION = 0.5;
    private static readonly RESITITUTION = 0.2;
    private static readonly MOTION_THRESHOLD = 0.2;
    public static texture: Texture;

    private gfx = new Graphics();

    private state: WormState;

    private terrainPosition: Vector = Vector.create(0,0);

    static async create(parent: Container, composite: Composite, position: { x: number, y: number }, terrain: BitmapTerrain) {
        const ent = new Worm(position, composite, terrain);
        Composite.add(composite, ent.body);
        parent.addChild(ent.sprite);
        parent.addChild(ent.gfx);
        return ent;
    }

    private constructor(position: { x: number, y: number }, composite: Composite, private readonly terrain: BitmapTerrain) {
        const sprite = new Sprite(Worm.texture);
        sprite.scale.set(1, 1);
        sprite.anchor.set(0.5, 0.5);
        const body = Bodies.rectangle(sprite.x, sprite.y, sprite.width, sprite.height, {
            isStatic: false,
            position,
            sleepThreshold: 30,
            friction: Worm.FRICTION,
            restitution: Worm.RESITITUTION,
            label: "worm",
            timeScale: 0.1,
            density: 500,
        });
        super(sprite, body, composite);
        this.state = WormState.InMotion;
        this.parent = composite;

        window.onkeydown = (evt) => {
            if(evt.key === "ArrowLeft" || evt.key === "ArrowRight") {
                this.onMove(evt.key === "ArrowLeft" ? "left" : "right");
            }
        }
    }

    onMove(direction: "left"|"right") {
        // Either a Query.ray or a Query.point to determine if the worm is up against terrain geometry.

        // Broadly we want to know if the worm can move N pixels to the direction without colliding or falling.
        // We need to do the following checks:
        // - Is the space next to me free.
        // - Is it higher or lower, if higher, can I climb?
        // - If lower, can I slide or will I fall?
        // - Having moved, will I trigger any mines?

        if (this.state === WormState.InMotion) {
            // Falling, can't move
            return;
        }
        const move = Vector.create(direction === "left" ? -3 : 3, 0);
        const height = (this.body.bounds.max.y - this.body.bounds.min.y) - 20;
        const tp = this.terrain.getNearestTerrainPosition(
            Vector.add(this.terrainPosition, move),
            30,
            50,
            move.x,
        );
        if (!tp) {
            console.log('Nowhere to move in this direction');
        } else {
            if (tp.y - this.terrainPosition.y > 50) {
                // We're falling
                console.log('Fell!');
                this.body.position.x -= 30;
                Body.setPosition(this.body, this.body.position);
                this.state = WormState.InMotion;
                Body.setStatic(this.body, false);
                Body.setVelocity(this.body, Vector.create(0,0));
                this.body.isSleeping = false;
                console.log(this.body);
            } else {
                console.log('Moving!', this.terrainPosition, tp);
                this.body.position.x = tp.x;
                this.body.position.y = tp.y - height;
                this.terrainPosition = tp;
            }
        }
    }

    onStoppedMoving() {
        this.state = WormState.Idle;
        Body.setStatic(this.body!, true);
        this.body.angle = 0;
        const height = (this.body.bounds.max.y - this.body.bounds.min.y) - 20;
        const tp = this.terrain.getNearestTerrainPosition(
            Vector.create(this.body.position.x, this.body.position.y + height),
            30,
            50,
        );
        if (tp) {
            this.body.position.x = tp.x;
            this.body.position.y = tp.y - height;
            this.terrainPosition = tp;
            console.log("Stopped at:", this.terrainPosition);
        } else {
            console.warn("Stopped moving but could not find a terrain position");
        }
    }

    update(dt: number): void {
        super.update(dt);
        if (!this.body || this.sprite.destroyed) {
            return;
        }

        if (this.state === WormState.InMotion && this.terrainPosition.x === 0) {
            // We're in motion, either we've been blown up, falling, or otherwise not in control.
            if (this.body.isSleeping) {
                this.onStoppedMoving();
            }
        }

        if (Worm.boundingWireframe) {
            this.gfx.clear();
            this.gfx.lineStyle(1, 0xFFBD01, 1);
            const width = (this.body.bounds.max.x - this.body.bounds.min.x);
            const height = (this.body.bounds.max.y - this.body.bounds.min.y);
            this.gfx.drawShape(new Rectangle(this.body.position.x - width/2, this.body.position.y - height/2,width,height));
        }
        // const down = this.terrain.castRay(this.body.position, 100, degreesToRadians(180));
        // console.log(down);
        if (this.isSinking) {
            this.body.position.y += 1 * dt;
            // TODO: Hacks
            if (this.body.position.y > 2000) {
                this.destroy();
            }
        }
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector) {
        if (super.onCollision(otherEnt, contactPoint)) {
            return true;
        }
        return false;
    }

    destroy(): void {
        super.destroy();
        this.gfx.destroy();
    }
}