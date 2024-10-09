import { Point, Sprite, UPDATE_PRIORITY, Text, DEG_TO_RAD, Graphics } from "pixi.js";
import { PhysicsEntity } from "../phys/physicsEntity";
import { GameWorld, RapierPhysicsObject } from "../../world";
import { magnitude, MetersValue, mult, sub } from "../../utils";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { IPhysicalEntity, OnDamageOpts } from "../entity";
import { teamGroupToColorSet, WormInstance } from "../../logic/teams";
import { applyGenericBoxStyle, DefaultTextStyle } from "../../mixins/styles";
import { Viewport } from "pixi-viewport";
import { handleDamageInRadius } from "../../utils/damage";
import { RecordedEntityState } from "../../state/model";


interface Opts {
    explosionRadius: MetersValue,
    damageMultiplier: number,
}

// This is clearly not milliseconds, something is odd about our dt.
const HEALTH_TENSION_MS = 75;
const SELF_EXPLODE_MAX_DAMAGE = 25;

interface RecordedState extends RecordedEntityState {
    wormIdent: string
} 

/**
 * Entity that can be directly controlled by a player.
 */
export abstract class PlayableEntity extends PhysicsEntity<RecordedState> {
    priority = UPDATE_PRIORITY.LOW;

    private nameText: Text;
    private healthText: Text;
    protected healthTextBox: Graphics;

    private visibleHealth: number;
    private healthChangeTensionTimer: number|null = null;

    get position() {
        return this.physObject.body.translation();
    }

    get health() {
        return this.wormIdent.health;
    }

    set health(v: number) {
        this.wormIdent.health = v;
        // Potentially further delay until the player has stopped moving.
        this.healthChangeTensionTimer = HEALTH_TENSION_MS;
    }

    constructor(sprite: Sprite, body: RapierPhysicsObject, world: GameWorld, protected parent: Viewport, public readonly wormIdent: WormInstance, private readonly opts: Opts) {
        super(sprite, body, world);
        this.renderOffset = new Point(4, 1);
        const {fg} = teamGroupToColorSet(wormIdent.team.group);
        this.nameText = new Text({
            text: this.wormIdent.name,
            style: {
                ...DefaultTextStyle,
                fontSize: 28,
                lineHeight: 32,
                fill: fg,
                align: 'center',
            },
        });
        this.healthText = new Text({
            text: this.health,
            style: {
                ...DefaultTextStyle,
                fontSize: 28,
                lineHeight: 32,
                fill: fg,
                align: 'center',
            },
        });
        this.visibleHealth = this.health;
        this.healthTextBox = new Graphics();
        this.healthText.position.set((this.nameText.width/2) - this.healthText.width/2, 34);
        applyGenericBoxStyle(this.healthTextBox).roundRect(-5,0,this.nameText.width+10,30, 4).stroke().fill();
        applyGenericBoxStyle(this.healthTextBox).roundRect(((this.nameText.width/2) - this.healthText.width/2) - 5,36,this.healthText.width+10,28, 4).stroke().fill();
        this.healthTextBox.addChild(this.healthText, this.nameText);
    }

    public update(dt: number): void {
        super.update(dt);
        if (this.destroyed) {
            // TODO: Feels totally unnessacery.
            return;
        }
        if (!this.healthTextBox.destroyed) {
            // Nice and simple parenting :Z
            this.healthTextBox.rotation = 0;
            this.healthTextBox.position.set((this.sprite.x - (this.healthTextBox.width/2)) + (this.sprite.width/2), this.sprite.y - 100);
        }

        if (this.healthChangeTensionTimer) {
            this.wireframe.setDebugText(`tension: ${this.healthChangeTensionTimer}`);
        }
        

        // TODO: Settling code.
        // if (!this.physObject.body.isMoving() && this.wasMoving) {
        //     this.wasMoving = false;
        //     this.physObject.body.setRotation(0, false);
        //     this.physObject.body.setTranslation(add(this.physObject.body.translation(), new Vector2(0, -0.25)), false);

        // }
        
        // Complex logic ahead, welcome to the health box tension timer!
        // Whenever the entity takes damage, `healthChangeTensionTimer` is set to a unit of time before
        // we can render the damage to the player.

        // Only decrease the timer when we have come to a standstill.
        if (!this.gameWorld.areEntitiesMoving() && this.healthChangeTensionTimer) {
            this.healthChangeTensionTimer -= dt;
        }

        // If the timer has run out, set to null to indiciate it has expired.
        if (this.healthChangeTensionTimer && this.healthChangeTensionTimer <= 0) {
            if (this.visibleHealth === 0 && !this.isSinking) {
                this.explode();
                return;
            }
            this.healthChangeTensionTimer = null;
        } 

        // If the timer is null, decrease the rendered health if nessacery.
        if (this.healthChangeTensionTimer === null) {
            if (this.visibleHealth > this.health) {
                this.visibleHealth--;
                this.healthText.text = this.visibleHealth;
                this.healthText.position.set((this.nameText.width/2) - this.healthText.width/2, 34);
            }

            // If we are dead, set a new timer to decrease to explode after a small delay.
            if (this.visibleHealth === 0) {
                this.healthChangeTensionTimer = HEALTH_TENSION_MS;
            }
        }

    }

    public explode() {
        const point = this.physObject.body.translation();
        handleDamageInRadius(this.gameWorld, this.parent, point, this.opts.explosionRadius, { maxDamage: SELF_EXPLODE_MAX_DAMAGE });
        this.destroy();
    }

    public onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2): boolean {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.wormIdent.health = 0;
                this.healthTextBox.destroy();
                this.physObject.body.setRotation(DEG_TO_RAD*180, false);
            }
            return true;
        }
        return false;
    }

    public onDamage(point: Vector2, radius: MetersValue, opts: OnDamageOpts): void {
        // TODO: Animate damage taken.
        const bodyTranslation = this.physObject.body.translation();
        const forceMag = radius.value/magnitude(sub(point,this.physObject.body.translation()));
        const damage = Math.min(opts.maxDamage ?? 100, Math.round((forceMag/20)*this.opts.damageMultiplier));
        this.health = Math.max(0, this.health - damage);
        const force = mult(sub(point, bodyTranslation), new Vector2(-forceMag, -forceMag));
        this.physObject.body.applyImpulse(force, true)
    }

    public recordState() {
        return {
            ...super.recordState(),
            wormIdent: this.wormIdent.uuid,
        }
    }

    public destroy(): void {
        super.destroy();
        if (!this.healthTextBox.destroyed) {
            this.healthTextBox.destroy();
        }
    }
}