import { Container, Sprite, Text, Texture, Ticker } from 'pixi.js';
import grenadePaths from "../../assets/grenade.svg";
import { Bodies, Vector } from "matter-js";
import { TimedExplosive } from "./timedExplosive";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { IMediaInstance, Sound } from '@pixi/sound';
import { loadSvg } from '../../loadSvg';
import { GameWorld } from '../../world';
       
/**
 * Standard grenade projectile.
 */
export class Grenade extends TimedExplosive {
    private static readonly FRICTION = 0.99;
    private static readonly RESITITUTION = 0;
    private static readonly DENSITY = 35;
    private static bodyVertices = loadSvg(grenadePaths, 50, 1, 1, Vector.create(0.5, 0.5));
    public static texture: Texture;
    public static bounceSoundsLight: Sound;
    public static boundSoundHeavy: Sound;

    static async create(parent: Container, world: GameWorld, position: {x: number, y: number}, initialForce: { x: number, y: number}) {
        const ent = new Grenade(position, await Grenade.bodyVertices, initialForce, world);
        parent.addChild(ent.sprite, ent.wireframe.renderable);
        return ent;
    }

    private timerText: Text;

    private get timerTextValue() {
        return `${(this.timer / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }
    public bounceSoundPlayback?: IMediaInstance;

    private constructor(position: { x: number, y: number }, bodyVerticies: Vector[][], initialForce: { x: number, y: number}, world: GameWorld) {
        const body = Bodies.fromVertices(position.x, position.y, bodyVerticies, {
            sleepThreshold: 60*(5+2),
            friction: Grenade.FRICTION,
            restitution: Grenade.RESITITUTION,
            density: Grenade.DENSITY,
            isSleeping: false,
            isStatic: false,
            label: "Grenade",
        });
        console.log("Created grenade body", body.id);
        const sprite = new Sprite(Grenade.texture);
        sprite.scale.set(0.5, 0.5);
        sprite.anchor.set(0.5, 0.5);
        super(sprite, body, world, {
            explosionRadius: 60,
            explodeOnContact: false,
            timerSecs: 3,
        });
        //Body.applyForce(body, Vector.create(body.position.x - 20, body.position.y), initialForce);
        this.timerText = new Text(this.timerTextValue, {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center',
        });
        this.sprite.addChild(this.timerText);
    }

    update(dt: number): void {
        super.update(dt);
        if (this.sprite.destroyed) {
            return;
        }
        
        // Body.applyForce(this.body, Vector.create(this.body.position.x - 5, this.body.position.y - 5), Vector.create(this.initialForce.x, this.initialForce.y));
        if (!this.timerText.destroyed) {
            this.timerText.rotation = -this.body.angle;
            this.timerText.text = this.timerTextValue;
        }
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector) {
        if (super.onCollision(otherEnt, contactPoint)) {
            this.timerText.destroy();
            return true;
        }
        // We don't explode, but we do make a noise.
        if (otherEnt instanceof BitmapTerrain === false) {
            return false;
        }

        const velocity = Vector.magnitude(this.body.velocity);

        // TODO: can these interrupt?
        if (!this.bounceSoundPlayback?.progress || this.bounceSoundPlayback.progress === 1 && this.timer > 0) {
            // TODO: Hacks
            Promise.resolve(
                (velocity >= 4 ? Grenade.boundSoundHeavy : Grenade.bounceSoundsLight).play()
            ).then((instance) =>{
                this.bounceSoundPlayback = instance;
            })
        }
        return false;
    }

    destroy(): void {
        super.destroy();
    }
}