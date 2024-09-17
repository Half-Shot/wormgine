import { Container, Sprite, Texture } from 'pixi.js';
import { Body, Bodies, Vector, Sleeping } from "matter-js";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { PhysicsEntity } from './physicsEntity';
import { IWeaponDefiniton } from '../../weapons/weapon';
import { WeaponGrenade } from '../../weapons/grenade';
import Controller, { InputKind } from '../../input';
import { GameWorld } from '../../world';

enum WormState {
    Idle = 0,
    InMotion = 1,
    Firing = 2,
    MovingLeft = 3,
    MovingRight = 4,
}

type FireWeaponFn = (worm: Worm, definition: IWeaponDefiniton, duration: number) => void;

export class Worm extends PhysicsEntity {
    private static readonly FRICTION = 0.9;
    private static readonly RESITITUTION = 0.1;
    public static texture: Texture;

    private fireWeaponDuration = 0;
    private currentWeapon: IWeaponDefiniton = WeaponGrenade;
    private state: WormState;

    private terrainPosition: Vector = Vector.create(0,0);
    private facingAngle = 0;

    static async create(parent: Container, world: GameWorld, position: { x: number, y: number }, terrain: BitmapTerrain, onFireWeapon: FireWeaponFn) {
        const ent = new Worm(position, world, terrain, onFireWeapon);
        world.addBody(ent, ent.body);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        return ent;
    }

    get position() {
        return this.body.position;
    }

    private constructor(position: { x: number, y: number }, world: GameWorld,
        private readonly terrain: BitmapTerrain,
        private readonly onFireWeapon: FireWeaponFn,
    ) {
        const sprite = new Sprite(Worm.texture);
        sprite.anchor.set(0.5, 0.5);
        const body = Bodies.rectangle(sprite.x, sprite.y, sprite.width, sprite.height, {
            isStatic: false,
            isSleeping: false,
            position,
            sleepThreshold: 30,
            timeScale: 0.001,
            friction: Worm.FRICTION,
            restitution: Worm.RESITITUTION,
            mass: 100,
            inverseMass: 0.01,
            label: "worm",
        });
        super(sprite, body, world);
        this.state = WormState.InMotion;

        // TODO: Unbind.
        Controller.on('inputBegin', (inputKind: InputKind) => {
            if (inputKind === InputKind.MoveLeft || inputKind === InputKind.MoveRight) {
                this.setMoveDirection(inputKind);
            } else if (inputKind === InputKind.Fire) {
                this.onBeginFireWeapon();
            }
        });

        Controller.on('inputEnd', (inputKind: InputKind) => {
            if (inputKind === InputKind.Fire) {
                this.onEndFireWeapon();
            }
            if (inputKind === InputKind.MoveLeft || inputKind === InputKind.MoveRight) {
                this.resetMoveDirection(inputKind);
            } 
        });

        this.onStoppedMoving();
    }

    setMoveDirection(direction: InputKind.MoveLeft|InputKind.MoveRight) {
        // We can only change direction if we are idle.
        if (this.state !== WormState.Idle) {
            // Falling, can't move
            return;
        }
        this.state = direction === InputKind.MoveLeft ? WormState.MovingLeft : WormState.MovingRight;
    }

    resetMoveDirection(inputDirection: InputKind.MoveLeft|InputKind.MoveRight) {
        // We can only stop moving if we are in control of our movements and the input that
        // completed was the movement key.
        if (this.state === WormState.MovingLeft && inputDirection === InputKind.MoveLeft) {
            this.state = WormState.Idle;
            return;
        }

        if (this.state === WormState.MovingRight || inputDirection === InputKind.MoveRight) {
            this.state = WormState.Idle;
            return;
        }
    }

    onMove(moveState: WormState.MovingLeft|WormState.MovingRight, dt: number) {
        // Attempt to move to the left or right by 3 pixels
        const movementMod = Math.round(dt);
        const move = Vector.create(moveState === WormState.MovingLeft ? -movementMod : movementMod, 0);
        const height = (this.body.bounds.max.y - this.body.bounds.min.y) - 20;
        const width = (this.body.bounds.max.x - this.body.bounds.min.x) / 1.85;
        // Try to find the terrain position for where we are moving to, to see
        // if we can scale/fall it.

        const nextPosition = Vector.add(this.terrainPosition, move);
        // nextPosition.x += moveState === WormState.MovingLeft ? width : -width;
        
        const { point: tp, fell } = this.terrain.getNearestTerrainPosition(
            nextPosition,
            width,
            height,
            move.x,
        );

        if (tp) {
            // TODO: Smooth transition
            // Normal move along a point
            Body.setPosition(this.body, Vector.create(tp.x, tp.y - height + 10));
            Body.setVelocity(this.body, Vector.create(0,0));
            this.terrainPosition = tp;
        } else {
            // We're falling!
            console.log('Fell!');
            Body.setStatic(this.body, false);
            Sleeping.set(this.body, false);
            Body.translate(this.body, Vector.create(-300, -30));
            Body.setVelocity(this.body, Vector.create(0, 1));
            this.state = WormState.InMotion;
        }
    }

    onStoppedMoving() {
        console.log('Stopped moving');
        // We are in a InMotion state but have come to rest.
        this.state = WormState.Idle;
        Body.setStatic(this.body, true);
        this.body.angle = 0;
        const height = (this.body.bounds.max.y - this.body.bounds.min.y) - 20;
        const {point: tp, fell} = this.terrain.getNearestTerrainPosition(
            Vector.create(this.body.position.x, this.body.position.y + height),
            30,
            50,
        );
        if (fell) {
            console.warn("Worm has stopped moving, but thinks it's still falling according to getNearestTerrainPosition!");
        }
        if (tp) {
            this.terrainPosition = tp;
            Body.setPosition(this.body, Vector.create(tp.x, tp.y - height));
            console.log("Stopped at:", this.terrainPosition);
            this.terrain.registerDamageListener(tp, () => {
                // TODO: This current launches the worm into the water, not quite sure why.
                console.log('Worm position damaged');
                Body.setStatic(this.body, false);
                // Body.setPosition(this.body, Vector.sub(this.body.position, Vector.create(0,50)));
                // Body.setVelocity(this.body, Vector.create(0,0));
                Sleeping.set(this.body, false);
                this.state = WormState.InMotion;
            });
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

        this.wireframe.setDebugText(`Worm\n${this.body.isStatic ? "static" : "dynamic"}\nVelocity: ${this.body.velocity.x.toPrecision(2) } ${this.body.velocity.y.toPrecision(2)}`);

        if (this.state === WormState.InMotion) {
            // We're in motion, either we've been blown up, falling, or otherwise not in control.
            // if (this.body.isSleeping) {
            //     this.onStoppedMoving();
            // }
        } else if (this.state === WormState.Firing) {
            if (this.fireWeaponDuration > this.currentWeapon.maxDuration) {
                this.onEndFireWeapon();
            } else {
                this.fireWeaponDuration += dt;
            }
        } else if (this.state === WormState.MovingLeft || this.state === WormState.MovingRight) {
            this.onMove(this.state, dt)
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