import { Graphics, Sprite, Texture } from 'pixi.js';
import { FireOpts, IWeaponDefiniton, WeaponFireResult } from '../../weapons/weapon';
import Controller, { InputKind } from '../../input';
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER } from '../../world';
import { ActiveEvents, ColliderDesc, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from '../../utils/coodinate';
import { AssetPack } from '../../assets';
import { PlayableEntity } from './playable';
import { teamGroupToColorSet, WormInstance } from '../../logic/teams';
import { calculateMovement } from '../../movementController';
import { Viewport } from 'pixi-viewport';
import { magnitude, pointOnRadius, sub } from '../../utils';
import { GameStateOverlay } from '../../overlays/gameStateOverlay';
import { FireResultHitEnemy, FireResultHitOwnTeam, FireResultHitSelf, FireResultKilledEnemy, FireResultKilledOwnTeam, FireResultKilledSelf, FireResultMiss, templateRandomText, TurnEndTextFall, TurnStartText, WeaponTimerText, WormDeathGeneric, WormDeathSinking } from '../../text/toasts';
import { WeaponBazooka } from '../../weapons';

export enum WormState {
    Idle = 0,
    InMotion = 1,
    Firing = 2,
    MovingLeft = 3,
    MovingRight = 4,
    AimingUp = 5,
    AimingDown = 6,
    InactiveWaiting = 98,
    Inactive = 99,
}

export enum EndTurnReason {
    TimerElapsed = 0,
    FallDamage = 1,
    FiredWeapon= 2,
    Sank = 3,
}

const MaxAim = Math.PI * 1.5; // Up
const MinAim = Math.PI * 0.5; // Down
const targettingRadius = new MetersValue(5);
const FireAngleArcPadding = 0.15;
const maxWormStep = new MetersValue(0.6);
const aimMoveSpeed = 0.02;

type FireFn = (worm: Worm, selectedWeapon: IWeaponDefiniton, opts: FireOpts) => Promise<WeaponFireResult[]>;

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
    private currentWeapon: IWeaponDefiniton = WeaponBazooka;
    private state: WormState = WormState.Inactive;
    private statePriorToMotion: WormState = WormState.Idle;
    private turnEndedReason: EndTurnReason|undefined;
    private impactVelocity = 0;
    // TODO: Best place for this var?
    private weaponTimerSecs = 3;
    public fireAngle = 0;
    private targettingGfx: Graphics;
    private facingRight = true;

    static create(parent: Viewport, world: GameWorld, position: Coordinate, wormIdent: WormInstance, onFireWeapon: FireFn, gameOverlay?: GameStateOverlay) {
        const ent = new Worm(position, world, parent, wormIdent, onFireWeapon, gameOverlay);
        world.addBody(ent, ent.physObject.collider);
        parent.addChild(ent.targettingGfx);
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

    get collider() {
        return this.physObject.collider;
    }

    get weapon() {
        return this.currentWeapon;
    }

    public selectWeapon(weapon: IWeaponDefiniton) {
        this.currentWeapon = weapon;
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
        this.targettingGfx = new Graphics({ visible: false });
        this.updateTargettingGfx();
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
        this.targettingGfx.visible = false;
    }

    onJump() {
        this.state = WormState.InMotion;
        this.body.applyImpulse({x: this.facingRight ? 5 : -5, y: -10}, true);
    }

    onInputBegin = (inputKind: InputKind) => {
        if (this.state === WormState.Firing) {
            // Ignore all input when the worm is firing.
            return;
        }
        if (inputKind === InputKind.MoveLeft || inputKind === InputKind.MoveRight) {
            this.setMoveDirection(inputKind);
        } else if (this.state !== WormState.Idle) {
            return;
        } else if (inputKind === InputKind.AimUp) {
            this.state = WormState.AimingUp;
        } else if (inputKind === InputKind.AimDown) {
            this.state = WormState.AimingDown;
        } else if (inputKind === InputKind.Fire) {
            this.onBeginFireWeapon();
        } else if (inputKind === InputKind.Jump) {
            this.onJump();
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
                }), 1250, undefined, true);
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
        if (inputKind === InputKind.AimUp || inputKind === InputKind.AimDown) {
            this.state = WormState.Idle;
        } 
    }

    setMoveDirection(direction: InputKind.MoveLeft|InputKind.MoveRight) {
        // We can only change direction if we are idle.
        if (this.state !== WormState.Idle) {
            // Falling, can't move
            return;
        }
        const changedDirection = (direction === InputKind.MoveLeft && this.facingRight) || (direction === InputKind.MoveRight && !this.facingRight);

        if (changedDirection) {
            this.fireAngle = MaxAim + (MaxAim - this.fireAngle);
            if (this.fireAngle > Math.PI*2) {
                this.fireAngle -= Math.PI*2;
            }
            if (this.fireAngle < 0) {
                this.fireAngle = (Math.PI*2) - this.fireAngle;
            }
            this.facingRight = !this.facingRight;
        }

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
        // TODO: Bind to tick time!!
        // Attempt to move to the left or right by 3 pixels
        const movementMod = 0.03;
        const moveMod = new Vector2(moveState === WormState.MovingLeft ? -movementMod : movementMod, 0);
        const move = calculateMovement(this.physObject, moveMod, maxWormStep, this.gameWorld);
        this.physObject.body.setTranslation(move, false);
    }

    onBeginFireWeapon() {
        this.state = WormState.Firing;
    }

    onEndFireWeapon() {
        if (this.state !== WormState.Firing) {
            return;
        }
        this.targettingGfx.visible = false;
        // TODO: Need a middle state for while the world is still active.
        this.state = WormState.InactiveWaiting;
        this.turnEndedReason = EndTurnReason.FiredWeapon;
        const duration = this.fireWeaponDuration;
        this.fireWeaponDuration = 0;
        this.onFireWeapon(this, this.currentWeapon, {
            duration,
            timer: this.weaponTimerSecs,
            angle: this.fireAngle,
        }).then((fireResult) => {
            this.state = WormState.Inactive;
            let randomTextSet: string[];
            if (fireResult.includes(WeaponFireResult.KilledOwnTeam)) {
                randomTextSet = FireResultKilledOwnTeam;
            }
            else if (fireResult.includes(WeaponFireResult.KilledSelf)) {
                randomTextSet = FireResultKilledSelf;
            }
            else if (fireResult.includes(WeaponFireResult.KilledEnemy)) {
                randomTextSet = FireResultKilledEnemy;
            }
            else if (fireResult.includes(WeaponFireResult.HitEnemy)) {
                randomTextSet = FireResultHitEnemy;
            }
            else if (fireResult.includes(WeaponFireResult.HitOwnTeam)) {
                randomTextSet = FireResultHitOwnTeam;
            }
            else if (fireResult.includes(WeaponFireResult.HitSelf)) {
                randomTextSet = FireResultHitSelf;
            }
            else if (fireResult.includes(WeaponFireResult.NoHit)) {
                randomTextSet = FireResultMiss;
            } else {
                // Unknown.
                return;
            }

            this.toaster?.addNewToast(templateRandomText(randomTextSet, {
                WormName: this.wormIdent.name,
                TeamName: this.wormIdent.team.name,
            }), 2000);
        })
        this.updateTargettingGfx();
    }

    updateTargettingGfx() {
        this.targettingGfx.clear();
        const teamFgColour = teamGroupToColorSet(this.wormIdent.team.group).fg;
        this.targettingGfx.circle(0,0,12).stroke({
            color: teamFgColour,
            width: 2,
        })
            .moveTo(-12,0).lineTo(12,0)
            .moveTo(0,-12).lineTo(0,12)
            .stroke({
            color: teamFgColour,
            width: 4,
        }).circle(0,0,3).fill({
            color: 'white',
        });
        if (this.state === WormState.Firing && this.currentWeapon.maxDuration) {
            const mag = this.fireWeaponDuration / this.currentWeapon.maxDuration;
            const relativeSpritePos = sub(this.sprite.position, this.targettingGfx.position);
            this.targettingGfx.moveTo(relativeSpritePos.x, relativeSpritePos.y)
                .arc(relativeSpritePos.x, relativeSpritePos.y, mag * targettingRadius.pixels, this.fireAngle-FireAngleArcPadding, this.fireAngle+FireAngleArcPadding)
                .moveTo(relativeSpritePos.x, relativeSpritePos.y).fill({
                color: teamFgColour,
            });
        }
    }

    updateAiming() {
        if (this.state === WormState.AimingUp) {
            if (this.facingRight) {
                if (this.fireAngle >= MaxAim || this.fireAngle <= MinAim) {
                    this.fireAngle = this.fireAngle -aimMoveSpeed;
                }
            } else {
                if (this.fireAngle <= MaxAim || this.fireAngle >= MinAim) {
                    this.fireAngle = this.fireAngle + aimMoveSpeed;
                }
            }
        } else if (this.state === WormState.AimingDown) {
            if (this.facingRight) {
                if (this.fireAngle >= MaxAim || this.fireAngle <= MinAim) {
                    this.fireAngle = this.fireAngle +aimMoveSpeed; // Math.max(this.fireAngle - aimMoveSpeed, MinAim); 
                }
            } else {
                this.fireAngle = this.fireAngle -aimMoveSpeed; //Math.min(this.fireAngle + aimMoveSpeed, MaxAim);
            }
        }  // else, we're idle and not currently moving.

        if (this.facingRight) {
            if (this.fireAngle < MaxAim && this.fireAngle > (MaxAim -aimMoveSpeed*2)) {
                this.fireAngle = MaxAim;
            }
            if (this.fireAngle > MinAim && this.fireAngle < MaxAim) {
                this.fireAngle = MinAim;
            }
        } else {
            if (this.fireAngle > MaxAim && this.fireAngle < (MaxAim +aimMoveSpeed*2)) {
                this.fireAngle = MaxAim;
            }
            if (this.fireAngle < MinAim && this.fireAngle < MaxAim) {
                this.fireAngle = MinAim;
            }
        }

        if (this.fireAngle > Math.PI*2) {
            this.fireAngle = 0;
        }
        if (this.fireAngle < 0) {
            this.fireAngle = Math.PI*2;
        }
    }

    update(dt: number): void {
        super.update(dt);
        if (this.sprite.destroyed) {
            return;
        }
        this.wireframe.setDebugText(`worm_state: ${WormState[this.state]}, velocity: ${this.body.linvel().y} ${this.impactVelocity}, aim: ${this.fireAngle}` );
        if (this.state === WormState.Inactive) {
            // Do nothing.
            return;
        }
        const falling = !this.isSinking && this.body.linvel().y > 4;
        this.targettingGfx.visible = !!this.currentWeapon.showTargetGuide && [WormState.Firing, WormState.Idle, WormState.AimingDown, WormState.AimingUp].includes(this.state);

        if (this.targettingGfx.visible) {
            const {x, y} = pointOnRadius(this.sprite.x, this.sprite.y, this.fireAngle, targettingRadius.pixels);
            this.targettingGfx.position.set(x, y);    
        }

        if (this.state === WormState.Firing) {
            this.updateTargettingGfx();
        }


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
        } else if (this.state === WormState.AimingUp || this.state === WormState.AimingDown) {
            this.updateAiming();
        }
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