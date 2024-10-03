import {  Sprite, Texture } from 'pixi.js';
import { FireOpts, IWeaponDefiniton } from '../../weapons/weapon';
import { WeaponGrenade } from '../../weapons/grenade';
import Controller, { InputKind } from '../../input';
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER } from '../../world';
import { ActiveEvents, ColliderDesc, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from '../../utils/coodinate';
import { AssetPack } from '../../assets';
import { PlayableEntity } from './playable';
import { teamGroupToColorSet, WormInstance } from '../../logic/teams';
import { calculateMovement } from '../../movementController';
import { Viewport } from 'pixi-viewport';
import { magnitude } from '../../utils';
import { GameStateOverlay } from '../../overlays/gameStateOverlay';
import { templateRandomText, TurnEndTextFall, TurnEndTextMiss, TurnStartText, WeaponTimerText, WormDeathGeneric, WormDeathSinking } from '../../text/toasts';

export enum WormState {
    Idle = 0,
    InMotion = 1,
    Firing = 2,
    MovingLeft = 3,
    MovingRight = 4,
    Inactive = 5,
}

export enum EndTurnReason {
    TimerElapsed = 0,
    FallDamage = 1,
    FiredWeaponNoHit = 2,
    FiredWeaponAndHit = 3,
    FiredWeaponAndKilled = 4,
    Sank = 5,
}


const maxWormStep = new MetersValue(0.6);

type FireFn = (worm: Worm, selectedWeapon: IWeaponDefiniton, opts: FireOpts) => void;

/**
 * Physical representation of a worm on the map. May be controlled.
 */
export class Worm extends PlayableEntity {
    private static readonly collisionBitmask = collisionGroupBitmask([CollisionGroups.WorldObjects], [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);

    public static readAssets(assets: AssetPack) {
        Worm.texture = assets.textures.grenade;
    }

    private static texture: Texture;
    private static impactDamageMultiplier = 0.75;
    private static minImpactForDamage = 8;
    private static offsetFromGroundM =  0.04;

    private fireWeaponDuration = 0;
    private currentWeapon: IWeaponDefiniton = WeaponGrenade;
    private state: WormState;
    private statePriorToMotion: WormState = WormState.Idle;
    private turnEndedReason: EndTurnReason|undefined;
    private impactVelocity = 0;
    // TODO: Best place for this var?
    private weaponTimerSecs = 3;
    public fireAngle = 0;

    static create(parent: Viewport, world: GameWorld, position: Coordinate, wormIdent: WormInstance, onFireWeapon: FireFn, gameOverlay?: GameStateOverlay) {
        const ent = new Worm(position, world, parent, wormIdent, onFireWeapon, gameOverlay);
        world.addBody(ent, ent.physObject.collider);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        parent.addChild(ent.healthTextBox);
        return ent;
    }

    get position() {
        return this.physObject.body.translation();
    }

    get currentState() {
        return this.state;
    }

    get endTurnReason() {
        return this.turnEndedReason;
    }

    private constructor(position: Coordinate, world: GameWorld, parent: Viewport, wormIdent: WormInstance, private readonly onFireWeapon: FireFn, private readonly toaster?: GameStateOverlay) {
        const sprite = new Sprite(Worm.texture);
        sprite.scale.set(0.5, 0.5);
        sprite.anchor.set(0.5, 0.5);
        const body = world.createRigidBodyCollider(
            ColliderDesc.cuboid(sprite.width / (PIXELS_PER_METER*2), sprite.height / (PIXELS_PER_METER*2))
            .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
            .setCollisionGroups(Worm.collisionBitmask)
            .setSolverGroups(Worm.collisionBitmask),
            RigidBodyDesc.dynamic().setTranslation(position.worldX, position.worldY).lockRotations()
        );
        super(sprite, body, world, parent, wormIdent, {
            explosionRadius: new MetersValue(5),
            damageMultiplier: 250,
        });
        this.state = WormState.Inactive;
    }

    onWormSelected() {
        this.state = WormState.Idle;
        this.toaster?.addNewToast(templateRandomText(TurnStartText, {
            WormName: this.wormIdent.name,
            TeamName: this.wormIdent.team.name,
        }), 3000, teamGroupToColorSet(this.wormIdent.team.group).fg);
        Controller.on('inputBegin', this.onInputBegin);
        Controller.on('inputEnd', this.onInputEnd);
    }

    onEndOfTurn() {
        Controller.removeListener('inputBegin', this.onInputBegin);
        Controller.removeListener('inputEnd', this.onInputEnd);
    }

    onInputBegin = (inputKind: InputKind) => {
        if (inputKind === InputKind.MoveLeft || inputKind === InputKind.MoveRight) {
            this.setMoveDirection(inputKind);
        } else if (inputKind === InputKind.Fire) {
            this.onBeginFireWeapon();
        }
        if (this.currentWeapon.timerAdjustable) {
            const oldTime = this.weaponTimerSecs;
            switch(inputKind) {
                case InputKind.WeaponTimer1:
                    this.weaponTimerSecs = 1;
                    break;
                case InputKind.WeaponTimer2:
                    this.weaponTimerSecs = 2;
                    break;
                case InputKind.WeaponTimer3:
                    this.weaponTimerSecs = 3;
                    break;
                case InputKind.WeaponTimer4:
                    this.weaponTimerSecs = 4;
                    break;
                case InputKind.WeaponTimer5:
                    this.weaponTimerSecs = 5;
                    break;
            }
            if (this.weaponTimerSecs !== oldTime) {
                this.toaster?.addNewToast(templateRandomText(WeaponTimerText, {
                    Time: this.weaponTimerSecs.toString(),
                }), 1250);
            }
        }
    }

    onInputEnd = (inputKind: InputKind) => {
        if (inputKind === InputKind.Fire) {
            this.onEndFireWeapon();
        }
        if (inputKind === InputKind.MoveLeft || inputKind === InputKind.MoveRight) {
            this.resetMoveDirection(inputKind);
        } 
    }

    setMoveDirection(direction: InputKind.MoveLeft|InputKind.MoveRight) {
        // We can only change direction if we are idle.
        if (this.state !== WormState.Idle) {
            // Falling, can't move
            return;
        }
        this.fireAngle = direction === InputKind.MoveLeft ? -1 : 1;
        this.state = direction === InputKind.MoveLeft ? WormState.MovingLeft : WormState.MovingRight;
    }

    resetMoveDirection(inputDirection: InputKind.MoveLeft|InputKind.MoveRight) {
        // We can only stop moving if we are in control of our movements and the input that
        // completed was the movement key.

        if (this.state === WormState.InMotion) {
            this.statePriorToMotion = WormState.Idle;
        } 

        if (this.state === WormState.MovingLeft && inputDirection === InputKind.MoveLeft) {
            this.state = WormState.Idle;
            return;
        }

        if (this.state === WormState.MovingRight || inputDirection === InputKind.MoveRight) {
            this.state = WormState.Idle;
            return;
        }
    }

    onMove(moveState: WormState.MovingLeft|WormState.MovingRight) {
        // Attempt to move to the left or right by 3 pixels
        const movementMod = 0.05;
        const moveMod = new Vector2(moveState === WormState.MovingLeft ? -movementMod : movementMod, 0);
        const move = calculateMovement(this.physObject, moveMod, maxWormStep, this.gameWorld);
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
        // TODO: Need a middle state for while the world is still active.
        this.state = WormState.Inactive;
        this.turnEndedReason = EndTurnReason.FiredWeaponNoHit;
        const duration = this.fireWeaponDuration;
        this.fireWeaponDuration = 0;
        this.onFireWeapon(this, this.currentWeapon, {
            duration,
            timer: this.weaponTimerSecs,
        });
        this.toaster?.addNewToast(templateRandomText(TurnEndTextMiss, {
            WormName: this.wormIdent.name,
            TeamName: this.wormIdent.team.name,
        }), 2000);
    }

    update(dt: number): void {
        super.update(dt);
        if (this.sprite.destroyed) {
            return;
        }
        if (this.state === WormState.Inactive) {
            // Do nothing.
            return;
        }
        const falling = !this.isSinking && this.body.linvel().y > 4;
        if (falling) {
            console.log(this.body.linvel());
        }

        this.wireframe.setDebugText(`worm_state: ${WormState[this.state]}, velocity: ${this.body.linvel().y} ${this.impactVelocity}` );

        if (this.state === WormState.InMotion) {
            this.impactVelocity = Math.max(magnitude(this.body.linvel()), this.impactVelocity);
            if (!this.body.isMoving()) {
                // Stopped moving, must not be in motion anymore.
                this.state = this.statePriorToMotion;
                this.statePriorToMotion = WormState.Idle;
                // Gravity does not affect us while we are idle.
                //this.body.setGravityScale(0, false);
                if (this.impactVelocity > Worm.minImpactForDamage) {
                    const damage = this.impactVelocity*Worm.impactDamageMultiplier;
                    this.health -= damage;
                    this.state = WormState.Inactive;
                    this.toaster?.addNewToast(templateRandomText(TurnEndTextFall, {
                        WormName: this.wormIdent.name,
                        TeamName: this.wormIdent.team.name,
                    }), 2000);
                    this.turnEndedReason = EndTurnReason.FallDamage;
                }
                this.impactVelocity = 0;
            }
        } else if (this.state === WormState.Firing) {
            if (!this.currentWeapon.maxDuration) {
                this.onEndFireWeapon();
            } else if (this.fireWeaponDuration > this.currentWeapon.maxDuration) {
                this.onEndFireWeapon();
            } else {
                this.fireWeaponDuration += dt;
            }
        } else if (falling) {
            this.statePriorToMotion = this.state;
            this.state = WormState.InMotion;
        } else if (this.state === WormState.MovingLeft || this.state === WormState.MovingRight) {
            this.onMove(this.state);
        } // else, we're idle and not currently moving.
    }

    destroy(): void {
        super.destroy();
        // XXX: This might need to be dead.
        this.state = WormState.Inactive;
        if (this.isSinking) {
            this.toaster?.addNewToast(templateRandomText(WormDeathSinking, {
                WormName: this.wormIdent.name,
                TeamName: this.wormIdent.team.name,
            }), 3000);
            // Sinking death
        } else if (this.health === 0) {
            // Generic death
            this.toaster?.addNewToast(templateRandomText(WormDeathGeneric, {
                WormName: this.wormIdent.name,
                TeamName: this.wormIdent.team.name,
            }), 3000);
        }
    }
}