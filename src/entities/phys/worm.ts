import { Container, Sprite, Texture } from 'pixi.js';
import { Body, Bodies, Composite, Vector, Sleeping } from "matter-js";
import { IMatterEntity, IMatterPluginInfo } from '../entity';
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
    private static readonly FRICTION = 0.95;
    private static readonly RESITITUTION = 0;
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
        sprite.scale.set(1, 1);
        sprite.anchor.set(0.5, 0.5);
        const body = Bodies.rectangle(sprite.x, sprite.y, sprite.width, sprite.height, {
            isStatic: false,
            isSleeping: false,
            position,
            sleepThreshold: 30,
            restitution: 0,
            // friction: Worm.FRICTION,
            // restitution: Worm.RESITITUTION,
            mass: 100,
            inverseMass: 0.01,
            label: "worm",
            // timeScale: 1,
            // density: 50,
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

        // this.onStoppedMoving();
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
        console.log("move dt", dt);
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

        if (!tp) {
            // We've hit a wall, or something unmovable.
            console.log('Nowhere to move in this direction');
        } else {
            if (fell) {
                // We're falling!
                console.log('Fell!', tp, this.terrainPosition);
                this.body.position.y -= 30;
                this.body.position.x -= 30;
                Body.setPosition(this.body, this.body.position);
                this.state = WormState.InMotion;
                Sleeping.set(this.body, false);
                Body.setStatic(this.body, false);
                Body.setVelocity(this.body, Vector.create(0,0));
            } else {
                // Normal move along a point
                this.body.position.x = tp.x;
                this.body.position.y = tp.y - height + 10;
                this.terrainPosition = tp;
            }
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
            this.body.position.x = tp.x;
            this.body.position.y = tp.y - height;
            this.terrainPosition = tp;
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