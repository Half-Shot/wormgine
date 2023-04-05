import { Container, Graphics, Rectangle, Sprite, Text, Texture, Ticker } from 'pixi.js';
import grenadePaths from "../../assets/grenade.svg";
import { Body, Bodies, Composite, Vector } from "matter-js";
import { TimedExplosive } from "./timedExplosive";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { IMediaInstance, Sound } from '@pixi/sound';
import { loadSvg } from '../../loadSvg';

export class Grenade extends TimedExplosive {
    private static readonly boundingWireframe = false;
    private static readonly FRICTION = 0.5;
    private static readonly RESITITUTION = 0.9;
    public static texture: Texture;

    public static bounceSound: Sound;
    public bounceSoundPlayback?: IMediaInstance;

    private static bodyVertices = loadSvg(grenadePaths, 50, 1, 1, Vector.create(0.5, 0.5));

    private timerText: Text;
    private gfx = new Graphics();

    private get timerTextValue() {
        return `${(this.timer / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }

    static async create(parent: Container, composite: Composite, position: {x: number, y: number}, initialForce: { x: number, y: number}) {
        const ent = new Grenade(position, await Grenade.bodyVertices, initialForce, composite);
        Composite.add(composite, ent.body);
        parent.addChild(ent.sprite);
        return ent;
    }

    private constructor(position: { x: number, y: number }, bodyVerticies: Vector[][], initialForce: { x: number, y: number}, parent: Composite) {
        const body = Bodies.fromVertices(position.x, position.y, bodyVerticies, {
            // sleepThreshold: 60*(5+2),
            position,
        });
        const sprite = new Sprite(Grenade.texture);
        super(sprite, body, parent, {
            explosionRadius: 60,
            explodeOnContact: false,
            timerSecs: 3,
        });
        this.body.friction = Grenade.FRICTION;
        this.body.restitution = Grenade.RESITITUTION;
        Body.applyForce(body, Vector.create(body.position.x - 20, body.position.y), initialForce);
        this.sprite.scale.set(0.5, 0.5);
        this.sprite.anchor.set(0.5, 0.5);
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
        if (Grenade.boundingWireframe) {
            this.gfx.clear();
            this.gfx.lineStyle(1, 0xFFBD01, 1);
            const width = (this.body.bounds.max.x - this.body.bounds.min.x);
            const height = (this.body.bounds.max.y - this.body.bounds.min.y);
            this.gfx.drawShape(new Rectangle(this.body.position.x - width/2, this.body.position.y - height/2,width,height));
        }
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector) {
        if (super.onCollision(otherEnt, contactPoint)) {
            return true;
        }
        // We don't explode, but we do make a noise.
        if (otherEnt instanceof BitmapTerrain === false) {
            return false;
        }


        if (!this.bounceSoundPlayback?.progress || this.bounceSoundPlayback.progress === 1 && this.timer > 0) {
            Promise.resolve(Grenade.bounceSound.play()).then((instance) =>{
                this.bounceSoundPlayback = instance;
            })
        }
        return false;
    }

    destroy(): void {
        super.destroy();
        this.gfx.destroy();
    }
}