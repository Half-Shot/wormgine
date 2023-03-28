import { SpriteEntity } from "./spriteEntity";
import { Assets, Container, Text, Ticker } from 'pixi.js';
import grenadeSrc from "../assets/grenade.png";
import grenadePaths from "../assets/grenade.svg";
import { Body, Bodies, Composite, Vertices, Svg, Vector, Collision, Contact } from "matter-js";
import { Terrain } from "./terrain";
import { IMatterEntity } from "./entity";

function loadSvg(url: string) {
    return fetch(url)
        .then(function(response) { return response.text(); })
        .then(function(raw) { return (new DOMParser()).parseFromString(raw, 'image/svg+xml'); });
};

const select = function(root: Document, selector: string) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
};

export class BazookaShell extends SpriteEntity {
    public static texture = Assets.get(grenadeSrc);
    private static bodyVertices = loadSvg(grenadePaths).then(root => { 
        console.log(root);
        return select(root, 'path#collision').map(path => 
            Vertices.scale(Svg.pathToVertices(path, 30), 1, 1, Vector.create(0.5, 0.5))
        )
    });
    private body?: Body;
    private parent?: Composite;
    private timer = Ticker.targetFPMS * 5000;

    private static explosionRadius = 45;

    private timerText: Text;

    private get timerTextValue() {
        return `${(this.timer / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }

    get bodies() {
        return [this.body];
    }

    private readonly force: Vector;

    constructor(position: { x: number, y: number }, private readonly initialAngle: number, initialForce: number, private readonly wind: number) {
        super(BazookaShell.texture);
        this.force = Vector.create(initialForce, initialForce / 10);
        
        this.sprite.x = position.x;
        this.sprite.y = position.y;
        // this.sprite.scale.set(0.5, 0.5);
        this.sprite.anchor.set(0.5, 0.5);
        this.timerText = new Text(this.timerTextValue, {
            fontFamily: 'Arial',
            fontSize: 24,
            fill: 0xFFFFFF,
            align: 'center',
        });
        this.sprite.addChild(this.timerText);
    }
    
    async create(parent: Container, composite: Composite) {
        super.create(parent, composite);
        this.body = Bodies.fromVertices(this.sprite.x, this.sprite.y, await BazookaShell.bodyVertices);
        this.body.frictionAir = 0.05;
        Composite.add(composite, this.body);
        this.parent = composite;
        this.body.angle = this.initialAngle;
    }

    update(dt: number): void {
        if (!this.body || this.sprite.destroyed) {
            return;
        }
        // Fix for other angles.
        this.force.x *= dt * 3;
        this.force.y *= dt * 3;
        if (this.force.x > 0.001) {
            console.log(this.force.x);
        }
        Body.applyForce(this.body, Vector.create(this.body.position.x, this.body.position.y), this.force);
        this.sprite.position = this.body.position;
        this.sprite.rotation = this.body.angle;
        this.timerText.rotation = -this.body.angle;
        this.timerText.text = this.timerTextValue;
        this.timer -= dt;

        if (this.timer <= 0) {
            this.onExplode();
        }
    }

    destroy(): void {
        if (this.body && this.parent) {
            Composite.remove(this.parent, this.body);
        }
        super.destroy();
    }

    onExplode() {
        this.destroy();
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Contact) {
        if (!contactPoint) {
            console.warn('onCollision without contact point');
            return;
        }
        console.log(otherEnt);
        if (otherEnt instanceof Terrain) {
            // Create a circle around the area, see what hits
            this.onExplode();
            otherEnt.onDamage(contactPoint.vertex, BazookaShell.explosionRadius);
        } else {
            // Later...
        }
    }
}