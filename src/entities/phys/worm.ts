import { Container, Sprite, Texture, UPDATE_PRIORITY } from 'pixi.js';
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { PhysicsEntity } from './physicsEntity';
import { IWeaponDefiniton } from '../../weapons/weapon';
import { WeaponGrenade } from '../../weapons/grenade';
import Controller, { InputKind } from '../../input';
import { GameWorld, PIXELS_PER_METER } from '../../world';
import { ColliderDesc, KinematicCharacterController, RigidBodyDesc, Vector, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate } from '../../utils/coodinate';
import { add } from '../../utils';

enum WormState {
    Idle = 0,
    InMotion = 1,
    Firing = 2,
    MovingLeft = 3,
    MovingRight = 4,
}

type FireWeaponFn = (worm: Worm, definition: IWeaponDefiniton, duration: number) => void;

export class Worm extends PhysicsEntity {
    public static texture: Texture;
    private static offsetFromGroundM = 0.01;

    private fireWeaponDuration = 0;
    private currentWeapon: IWeaponDefiniton = WeaponGrenade;
    private state: WormState;
    private characterController: KinematicCharacterController;

    static async create(parent: Container, world: GameWorld, position: Coordinate, onFireWeapon: FireWeaponFn) {
        const ent = new Worm(position, world, onFireWeapon);
        world.addBody(ent, ent.body.collider);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        return ent;
    }

    get position() {
        return this.body.body.translation();
    }

    private constructor(position: Coordinate, world: GameWorld,private readonly onFireWeapon: FireWeaponFn,
    ) {
        const sprite = new Sprite(Worm.texture);
        sprite.anchor.set(0.5, 0.5);
        const body = world.createRigidBodyCollider(
            ColliderDesc.cuboid(sprite.width / (PIXELS_PER_METER*2), sprite.height / (PIXELS_PER_METER*2)),
            RigidBodyDesc.dynamic().setTranslation(position.worldX, position.worldY).lockRotations()
        );
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

        this.characterController = world.rapierWorld.createCharacterController(Worm.offsetFromGroundM);
        this.characterController.enableSnapToGround(0.5);
        this.characterController.enableAutostep(0.5, 0.2, true);

        //this.onStoppedMoving();
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
        // // Attempt to move to the left or right by 3 pixels
        const movementMod = 0.5;
        const move = add(
            this.body.body.translation(),
            new Vector2(moveState === WormState.MovingLeft ? -movementMod : movementMod, 0),
        );
        this.characterController.computeColliderMovement(this.body.collider, move);
        const correctedMovement = this.characterController.computedMovement();
        console.log(correctedMovement, move);
        this.body.body.setTranslation(correctedMovement, false);

        // const height = (this.body.bounds.max.y - this.body.bounds.min.y) - 20;
        // const width = (this.body.bounds.max.x - this.body.bounds.min.x) / 1.85;
        // // Try to find the terrain position for where we are moving to, to see
        // // if we can scale/fall it.

        // const nextPosition = Vector.add(this.terrainPosition, move);
        // // nextPosition.x += moveState === WormState.MovingLeft ? width : -width;
        
        // const { point: tp, fell } = this.terrain.getNearestTerrainPosition(
        //     nextPosition,
        //     width,
        //     height,
        //     move.x,
        // );

        // if (tp) {
        //     // TODO: Smooth transition
        //     // Normal move along a point
        //     Body.setPosition(this.body, Vector.create(tp.x, tp.y - height + 10));
        //     Body.setVelocity(this.body, Vector.create(0,0));
        //     this.terrainPosition = tp;
        // } else {
        //     // We're falling!
        //     console.log('Fell!');
        //     Body.setStatic(this.body, false);
        //     Sleeping.set(this.body, false);
        //     Body.translate(this.body, Vector.create(-300, -30));
        //     Body.setVelocity(this.body, Vector.create(0, 1));
        //     this.state = WormState.InMotion;
        // }
    }

    // onStoppedMoving() {
    //     console.log('Stopped moving');
    //     // We are in a InMotion state but have come to rest.
    //     this.state = WormState.Idle;
    //     Body.setStatic(this.body, true);
    //     this.body.angle = 0;
    //     const height = (this.body.bounds.max.y - this.body.bounds.min.y) - 20;
    //     const {point: tp, fell} = this.terrain.getNearestTerrainPosition(
    //         Vector.create(this.body.position.x, this.body.position.y + height),
    //         30,
    //         50,
    //     );
    //     if (fell) {
    //         console.warn("Worm has stopped moving, but thinks it's still falling according to getNearestTerrainPosition!");
    //     }
    //     if (tp) {
    //         this.terrainPosition = tp;
    //         Body.setPosition(this.body, Vector.create(tp.x, tp.y - height));
    //         console.log("Stopped at:", this.terrainPosition);
    //         this.terrain.registerDamageListener(tp, () => {
    //             // TODO: This current launches the worm into the water, not quite sure why.
    //             console.log('Worm position damaged');
    //             Body.setStatic(this.body, false);
    //             // Body.setPosition(this.body, Vector.sub(this.body.position, Vector.create(0,50)));
    //             // Body.setVelocity(this.body, Vector.create(0,0));
    //             Sleeping.set(this.body, false);
    //             this.state = WormState.InMotion;
    //         });
    //     } else {
    //         console.warn("Stopped moving but could not find a terrain position");
    //     }
    // }

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

        this.wireframe.setDebugText(`Worm\n${this.body.body.isEnabled() ? "static" : "dynamic"}\nVelocity: ${this.body.body.linvel().x.toPrecision(2) } ${this.body.body.linvel().y.toPrecision(2)}`);

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
        this.gameWorld.rapierWorld.removeCharacterController(this.characterController);
        super.destroy();
    }
}