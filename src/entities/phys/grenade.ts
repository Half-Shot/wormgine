import { Container, Sprite, Text, Texture, Ticker } from 'pixi.js';
import grenadePaths from "../../assets/grenade.svg";
import { Body, Bodies, Composite, Vector } from "matter-js";
import { TimedExplosive } from "./timedExplosive";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { IMediaInstance, Sound } from '@pixi/sound';
import { loadSvg } from '../../loadSvg';
import { Game } from '../../game';
       
/**
 * Standard grenade projectile.
 */
export class Grenade extends TimedExplosive {
    private static readonly FRICTION = 0.5;
    private static readonly RESITITUTION = 0.1;
    private static readonly density = 0.005;
    private static bodyVertices = loadSvg(grenadePaths, 50, 1, 1, Vector.create(0.5, 0.5));
    public static texture: Texture;
    public static bounceSound: Sound;

    static async create(game: Game, parent: Container, composite: Composite, position: {x: number, y: number}, initialForce: { x: number, y: number}) {
        const ent = new Grenade(game, position, await Grenade.bodyVertices, initialForce, composite);
        Composite.add(composite, ent.body);
        parent.addChild(ent.sprite, ent.wireframe.renderable);
        return ent;
    }

    private timerText: Text;

    private get timerTextValue() {
        return `${(this.timer / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }
    public bounceSoundPlayback?: IMediaInstance;

    private constructor(game: Game, position: { x: number, y: number }, bodyVerticies: Vector[][], initialForce: { x: number, y: number}, parent: Composite) {
        const body = Bodies.fromVertices(position.x, position.y, bodyVerticies, {
            sleepThreshold: 60*(5+2),
            friction: Grenade.FRICTION,
            restitution: Grenade.RESITITUTION,
            density: Grenade.density,
            isSleeping: false,
            isStatic: false,
        });
        console.log(body);
        const sprite = new Sprite(Grenade.texture);
        sprite.scale.set(0.5, 0.5);
        sprite.anchor.set(0.5, 0.5);
        super(game, sprite, body, parent, {
            explosionRadius: 60,
            explodeOnContact: false,
            timerSecs: 3,
        });
        Body.applyForce(body, Vector.create(body.position.x - 20, body.position.y), initialForce);
        this.timerText = new Text(this.timerTextValue, {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center',
        });
        this.sprite.addChild(this.timerText);
        this.wireframe.enabled = true;
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


        if (!this.bounceSoundPlayback?.progress || this.bounceSoundPlayback.progress === 1 && this.timer > 0) {
            // TODO: Hacks
            Promise.resolve(Grenade.bounceSound.play()).then((instance) =>{
                this.bounceSoundPlayback = instance;
            })
        }
        return false;
    }

    destroy(): void {
        super.destroy();
    }
}