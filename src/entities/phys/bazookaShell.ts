import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import grenadePaths from "../../assets/bazooka.svg";
import { Body, Bodies, Composite, Vector } from "matter-js";
import { TimedExplosive } from "./timedExplosive";
import { loadSvg } from '../../loadSvg';

// TODO: This is buggy as all hell.

export class BazookaShell extends TimedExplosive {
    private static readonly boundingWireframe = true;
    public static texture: Texture;
    private static bodyVertices = loadSvg(grenadePaths, 50, 1.75, 1.75, Vector.create(0.5, 0.5));

    private readonly force: Vector = Vector.create(0);
    private readonly gfx = new Graphics();
    
    static async create(parent: Container, composite: Composite, position: {x: number, y: number}, initialAngle: number, initialForce: number, wind: number) {
        const ent = new BazookaShell(position, await BazookaShell.bodyVertices, initialAngle, composite, initialForce, wind);
        Composite.add(composite, ent.body);
        parent.addChild(ent.sprite);
        console.log("New zooka", ent.body);
        console.log(ent.sprite.x, ent.sprite.position.x);
        return ent;
    }

    private constructor(position: { x: number, y: number }, bodyVerticies: Vector[][], initialAngle: number, composite: Composite, initialForce: number, private readonly wind: number) {
        const body = Bodies.fromVertices(position.x, position.y, bodyVerticies, {
            position,
        });
        const sprite = new Sprite(BazookaShell.texture);
        super(sprite, body, composite, {
            explosionRadius: 100,
            explodeOnContact: true,
            timerSecs: 30,
        });
        body.frictionAir = 0.05;
        body.angle = initialAngle;
        this.force = Vector.create(initialForce / 10, initialForce / 100);
        this.sprite.x = position.x;
        this.sprite.y = position.y;
        this.sprite.scale.set(0.5, 0.5);
        this.sprite.anchor.set(0.5, 0.5);
    }
    

    update(dt: number): void {
        super.update(dt);
        if (!this.body || this.sprite.destroyed) {
            return;
        }
        // Fix for other angles.
        this.force.x *= Math.min(1, dt * 3);
        this.force.y *= Math.min(1, dt * 3);
        Body.applyForce(this.body, Vector.create(this.body.position.x, this.body.position.y), this.force);
        if (BazookaShell.boundingWireframe) {
            this.gfx.clear();
            this.gfx.lineStyle(1, 0xFFBD01, 1);
            const width = (this.body.bounds.max.x - this.body.bounds.min.x);
            const height = (this.body.bounds.max.y - this.body.bounds.min.y);
            this.gfx.drawShape(new Rectangle(this.body.position.x - width/2, this.body.position.y - height/2,width,height));
        }
    }

    destroy(): void {
        super.destroy();
        this.gfx.destroy();
    }
}