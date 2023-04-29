import { Container, Sprite, Texture } from 'pixi.js';
import { Body, Bodies, Composite, Vector, Sleeping } from "matter-js";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { PhysicsEntity } from './physicsEntity';
import { IWeaponDefiniton } from '../../weapons/weapon';
import { WeaponGrenade } from '../../weapons/grenade';


enum WormState {
    Idle = 0,
    InMotion = 1,
    Firing = 2,
}

type FireWeaponFn = (worm: Worm, definition: IWeaponDefiniton, duration: number) => void;

export class Worm extends PhysicsEntity {
    private static readonly FRICTION = 0.5;
    private static readonly RESITITUTION = 0.2;
    public static texture: Texture;

    private fireWeaponDuration = 0;
    private currentWeapon: IWeaponDefiniton = WeaponGrenade;
    private state: WormState;

    private terrainPosition: Vector = Vector.create(0,0);
    private facingAngle: number = 0;

    static async create(parent: Container, composite: Composite, position: { x: number, y: number }, terrain: BitmapTerrain, onFireWeapon: FireWeaponFn) {
        const ent = new Worm(position, composite, terrain, onFireWeapon);
        Composite.add(composite, ent.body);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        return ent;
    }

    get position() {
        return this.body.position;
    }

    private constructor(position: { x: number, y: number }, composite: Composite,
        private readonly terrain: BitmapTerrain,
        private readonly onFireWeapon: FireWeaponFn,
    ) {
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
            density: 0.001,
        });
        super(sprite, body, composite);
        this.state = WormState.InMotion;
        this.parent = composite;

        // TODO: Move this to a dedicated controller class.
        window.onkeydown = (evt) => {
            if(evt.key === "ArrowLeft" || evt.key === "ArrowRight") {
                this.onMove(evt.key === "ArrowLeft" ? "left" : "right");
            }
            if(evt.code === "Space") {
                this.onBeginFireWeapon();
            }
        }

        window.onkeyup = (evt) => {
            if (evt.code === "Space") {
                this.onEndFireWeapon();
            }
        }
        this.onStoppedMoving();
    }

    onMove(direction: "left"|"right") {
        if (this.state === WormState.InMotion) {
            // Falling, can't move
            return;
        }

        // Attempt to move to the left or right by 3 pixels
        const move = Vector.create(direction === "left" ? -3 : 3, 0);
        const height = (this.body.bounds.max.y - this.body.bounds.min.y) - 20;
        // Try to find the terrain position for where we are moving to, to see
        // if we can scale/fall it.
        const tp = this.terrain.getNearestTerrainPosition(
            Vector.add(this.terrainPosition, move),
            30,
            50,
            move.x,
        );

        if (!tp) {
            // We've hit a wall, or something unmovable.
            console.log('Nowhere to move in this direction');
        } else {
            if (tp.y - this.terrainPosition.y > 50) {
                // We're falling!
                console.log('Fell!');
                this.body.position.x -= 3;
                Body.setPosition(this.body, this.body.position);
                this.state = WormState.InMotion;
                Body.setStatic(this.body, false);
                Body.setVelocity(this.body, Vector.create(0,0));
                this.body.isSleeping = false;
            } else {
                // Normal move along a point
                console.log('Moving!', this.terrainPosition, tp);
                this.body.position.x = tp.x;
                this.body.position.y = tp.y - height;
                this.terrainPosition = tp;
            }
        }
    }

    onStoppedMoving() {
        // We are in a InMotion state but have come to rest.
        this.state = WormState.Idle;
        Body.setStatic(this.body, true);
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
            this.terrain.registerDamageListener(tp, () => {
                // TODO: This current launches the worm into the water, not quite sure why.
                console.log('Worm position damaged');
                Body.setStatic(this.body, false);
                Body.setPosition(this.body, Vector.sub(this.body.position, Vector.create(0,50)));
                // Body.setVelocity(this.body, Vector.create(0,0));
                Sleeping.set(this.body, false);
                this.state = WormState.InMotion;
            })
        } else {
            console.warn("Stopped moving but could not find a terrain position");
        }
    }

    onBeginFireWeapon() {
        this.state = WormState.Firing;
    }

    onEndFireWeapon() {
        if (this.state !== WormState.Firing) {
            return;
        }
        this.state = WormState.Idle;
        const duration = this.fireWeaponDuration;
        this.fireWeaponDuration = 0;
        console.log('Weapon fired with a duration of', duration);
        this.onFireWeapon(this, this.currentWeapon, duration);
    }

    update(dt: number): void {
        super.update(dt);
        if (!this.body || this.sprite.destroyed) {
            return;
        }

        if (this.state === WormState.InMotion) {
            // We're in motion, either we've been blown up, falling, or otherwise not in control.
            if (this.body.isSleeping) {
                this.onStoppedMoving();
            }
        } else if (this.state === WormState.Firing) {
            if (this.fireWeaponDuration > this.currentWeapon.maxDuration) {
                this.onEndFireWeapon();
            } else {
                this.fireWeaponDuration += dt;
            }
        } // else, we're idle and not currently moving.
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector) {
        if (super.onCollision(otherEnt, contactPoint)) {
            return true;
        }
        return false;
    }

    destroy(): void {
        super.destroy();
    }
}