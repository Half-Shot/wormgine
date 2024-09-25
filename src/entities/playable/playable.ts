import { Point, Sprite, UPDATE_PRIORITY, Text, DEG_TO_RAD, Graphics } from "pixi.js";
import { PhysicsEntity } from "../phys/physicsEntity";
import { GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../../world";
import { add, Coordinate, magnitude, MetersValue, mult, sub } from "../../utils";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { IPhysicalEntity } from "../entity";
import { Explosion } from "../explosion";
import { teamGroupToColorSet, WormInstance } from "../../logic/teams";
import { applyGenericBoxStyle } from "../../mixins/styles";


interface Opts {
    explosionRadius: MetersValue,
    damageMultiplier: number,
}

/**
 * Entity that can be directly controlled by a player.
 */
export abstract class PlayableEntity extends PhysicsEntity {
    priority = UPDATE_PRIORITY.LOW;

    private wasMoving = true;
    private nameText: Text;
    private healthText: Text;
    protected healthTextBox: Graphics;

    private visibleHealth: number;
    private healthChangeTensionTimer: number|null = null;

    get position() {
        return this.body.body.translation();
    }

    get health() {
        return this.wormIdent.health;
    }

    set health(v: number) {
        this.wormIdent.health = v;
        // Potentially further delay until the player has stopped moving.
        this.healthChangeTensionTimer = 75;
    }

    constructor(sprite: Sprite, body: RapierPhysicsObject, position: Coordinate, world: GameWorld, private readonly wormIdent: WormInstance, private readonly opts: Opts) {
        super(sprite, body, world);
        this.renderOffset = new Point(4, 1);
        const {fg} = teamGroupToColorSet(wormIdent.team.group);
        this.nameText = new Text({
            text: this.wormIdent.name,
            style: {
                fontFamily: 'Arial',
                fontSize: 20,
                lineHeight: 32,
                fill: fg,
                align: 'center',
            },
        });
        this.healthText = new Text({
            text: this.health,
            style: {
                fontFamily: 'Arial',
                fontSize: 20,
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
            this.healthTextBox.rotation = 0;
            this.healthTextBox.position.set(this.sprite.x - 50, this.sprite.y - 100);
        }

        if (this.healthChangeTensionTimer) {
            this.wireframe.setDebugText(`tension: ${this.healthChangeTensionTimer}`);
        }
        

        if (!this.body.body.isMoving() && this.wasMoving) {
            this.wasMoving = false;
            this.body.body.setRotation(0, false);
            this.body.body.setTranslation(add(this.body.body.translation(), new Vector2(0, -0.25)), false);

        }

        if (!this.body.body.isMoving() && !this.wasMoving && this.healthChangeTensionTimer) {
            this.healthChangeTensionTimer -= dt;
        }

        if (this.healthChangeTensionTimer && this.healthChangeTensionTimer <= 0) {
            this.healthChangeTensionTimer = null;
        }  

        if (this.healthChangeTensionTimer === null) {
            if (this.visibleHealth > this.health) {
                this.visibleHealth--;
                this.healthText.text = this.visibleHealth;
            }
            // Delay before this?
            if (this.visibleHealth === 0) {
                this.explode();
            }
        }

    }

    public explode() {
        const point = this.body.body.translation();
        // Detect if anything is around us.
        for (const element of this.gameWorld.checkCollision(new Coordinate(point.x, point.y), this.opts.explosionRadius, this.body.collider)) {
            if (element.onDamage) {
                element.onDamage(point, this.opts.explosionRadius);
            }
        }
        this.gameWorld.addEntity(Explosion.create(this.gameWorld.viewport, new Point(point.x*PIXELS_PER_METER, point.y*PIXELS_PER_METER), this.opts.explosionRadius, {
            shrapnelMax: 35,
            shrapnelMin: 15,
        }));
        this.destroy();
    }

    public onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2): boolean {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.wormIdent.health = 0;
                this.healthTextBox.destroy();
                this.body.body.setRotation(DEG_TO_RAD*180, false);
            }
            return true;
        }
        return false;
    }

    public onDamage(point: Vector2, radius: MetersValue): void {
        // TODO: Animate damage taken.
        const bodyTranslation = this.body.body.translation();
        const forceMag = radius.value/magnitude(sub(point,this.body.body.translation()));
        const damage = Math.round((forceMag/20)*this.opts.damageMultiplier);
        this.health = Math.max(0, this.health - damage);
        const force = mult(sub(point, bodyTranslation), new Vector2(-forceMag, -forceMag));
        this.body.body.applyImpulse(force, true)
        this.wasMoving = true;
    }

    public destroy(): void {
        super.destroy();
        if (!this.healthTextBox.destroyed) {
            this.healthTextBox.destroy();
        }
    }
}