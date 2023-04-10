import { Container, Graphics, Rectangle, Sprite, Text, Texture, Ticker } from 'pixi.js';
import grenadePaths from "../../assets/grenade.svg";
import { Body, Bodies, Composite, Vector, Vertices, Svg } from "matter-js";
import { TimedExplosive } from "./timedExplosive";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { IMediaInstance, Sound } from '@pixi/sound';
function loadSvg(url: string) {
        return fetch(url)
            .then(function(response) { return response.text(); })
            .then(function(raw) { return (new DOMParser()).parseFromString(raw, 'image/svg+xml'); });
    };
    
    const select = function(root: Document, selector: string) {
        return Array.prototype.slice.call(root.querySelectorAll(selector));
    };
    
        
export class Grenade extends TimedExplosive {
    private static readonly boundingWireframe = true;
    private static readonly FRICTION = 0.5;
    private static readonly RESITITUTION = 0.9;
    private static readonly density = 0.005;
    private static bodyVertices = loadSvg(grenadePaths).then(root => { 
        console.log(root);
        return select(root, 'path#collision').map(path => 
            Vertices.scale(Svg.pathToVertices(path, 50), 1, 1, Vector.create(0.5, 0.5))
        )
    });
    public static texture: Texture;
    public static bounceSound: Sound;

    static async create(parent: Container, composite: Composite, position: {x: number, y: number}, initialForce: { x: number, y: number}) {
        const ent = new Grenade(position, await Grenade.bodyVertices, initialForce, composite);
        Composite.add(composite, ent.body);
        console.log(ent.body);
        parent.addChild(ent.sprite);
        parent.addChild(ent.gfx);
        return ent;
    }

    private timerText: Text;
    private gfx = new Graphics();

    private get timerTextValue() {
        return `${(this.timer / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }
    public bounceSoundPlayback?: IMediaInstance;

    private constructor(position: { x: number, y: number }, bodyVerticies: Vector[][], initialForce: { x: number, y: number}, parent: Composite) {
        const body = Bodies.fromVertices(position.x, position.y, bodyVerticies, {
            sleepThreshold: 60*(5+2),
            friction: Grenade.FRICTION,
            restitution: Grenade.RESITITUTION,
            density: Grenade.density,
        });
        const sprite = new Sprite(Grenade.texture);
        sprite.scale.set(0.5, 0.5);
        sprite.anchor.set(0.5, 0.5);
        super(sprite, body, parent, {
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
        console.log("Grenade collision");
        if (super.onCollision(otherEnt, contactPoint)) {
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
        this.gfx.destroy();
    }
}