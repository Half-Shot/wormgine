import { Container, Sprite, Texture } from 'pixi.js';
import { IPhysicalEntity } from '../entity';
import { IWeaponDefiniton } from '../../weapons/weapon';
import { WeaponGrenade } from '../../weapons/grenade';
import Controller, { InputKind } from '../../input';
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER } from '../../world';
import { ActiveEvents, ColliderDesc, KinematicCharacterController, RigidBodyDesc, Vector, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from '../../utils/coodinate';
import { add, mult } from '../../utils';
import { AssetPack } from '../../assets';
import { PlayableEntity } from './playable';
import { WormIdentity, WormInstance } from '../../logic/teams';
import { calculateMovement } from '../../movementController';

enum WormState {
    Idle = 0,
    InMotion = 1,
    Firing = 2,
    MovingLeft = 3,
    MovingRight = 4,
}

type FireWeaponFn = (worm: Worm, definition: IWeaponDefiniton, duration: number) => void;


/**
 * Physical representation of a worm on the map. May be controlled.
 */
export class Worm extends PlayableEntity {
    private static readonly collisionBitmask = collisionGroupBitmask([CollisionGroups.WorldObjects], [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);

    public static readAssets(assets: AssetPack) {
        Worm.texture = assets.textures.grenade;
    }

    private static texture: Texture;
    private static offsetFromGroundM =  0.04;

    private fireWeaponDuration = 0;
    private currentWeapon: IWeaponDefiniton = WeaponGrenade;
    private state: WormState;

    static create(parent: Container, world: GameWorld, position: Coordinate, wormIdent: WormInstance, onFireWeapon: FireWeaponFn) {
        const ent = new Worm(position, world, wormIdent, onFireWeapon);
        world.addBody(ent, ent.physObject.collider);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        parent.addChild(ent.healthTextBox);
        return ent;
    }

    get position() {
        return this.physObject.body.translation();
    }

    private constructor(position: Coordinate, world: GameWorld, wormIdent: WormInstance, private readonly onFireWeapon: FireWeaponFn) {
        const sprite = new Sprite(Worm.texture);
        sprite.anchor.set(0.5, 0.5);
        const body = world.createRigidBodyCollider(
            ColliderDesc.cuboid(sprite.width / (PIXELS_PER_METER*2), sprite.height / (PIXELS_PER_METER*2))
            .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
            .setCollisionGroups(Worm.collisionBitmask)
            .setSolverGroups(Worm.collisionBitmask),
            RigidBodyDesc.dynamic().setTranslation(position.worldX, position.worldY).lockRotations()
        );
        super(sprite, body, position, world, wormIdent, {
            explosionRadius: new MetersValue(5),
            damageMultiplier: 5,
        });
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
        // Attempt to move to the left or right by 3 pixels
        const movementMod = 0.06;
        const moveMod = new Vector2(moveState === WormState.MovingLeft ? -movementMod : movementMod, 0);
        const move = calculateMovement(this.physObject, moveMod, this.gameWorld);
        this.physObject.body.setTranslation(move, false);
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
        if (this.sprite.destroyed) {
            return;
        }

        this.wireframe.setDebugText(`worm_state: ${WormState[this.state]}`);
        //this.wireframe.setDebugText(`Worm\n${this.physObject.body.isEnabled() ? "static" : "dynamic"}\nVelocity: ${this.physObject.body.linvel().x.toPrecision(2) } ${this.physObject.body.linvel().y.toPrecision(2)}`);

        if (this.state === WormState.InMotion) {
            if (!this.body.isMoving()) {
                // Stopped moving, must not be in motion anymore.
                this.state = WormState.Idle;
                // Gravity does not affect us while we are idle.
                //this.body.setGravityScale(0, false);
                console.log(this.physObject.body.translation(), this.physObject.collider.translation());
            }
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
            this.onMove(this.state, dt);
        } // else, we're idle and not currently moving.
    }

    destroy(): void {
        super.destroy();
    }
}