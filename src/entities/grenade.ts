import { SpriteEntity } from "./spriteEntity";
import { Assets, Container, Text, Ticker } from 'pixi.js';
import grenadeSrc from "../assets/grenade.png";
import grenadePaths from "../assets/grenade.svg";
import { Body, Bodies, Composite, Vertices, Svg, Vector } from "matter-js";

function loadSvg(url: string) {
    return fetch(url)
        .then(function(response) { return response.text(); })
        .then(function(raw) { return (new DOMParser()).parseFromString(raw, 'image/svg+xml'); });
};

const select = function(root: Document, selector: string) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
};

export class Grenade extends SpriteEntity {
    private static readonly FRICTION = 0.5;
    private static readonly RESITITUTION = 0.85;
    public static texture = Assets.get(grenadeSrc);
    private static bodyVertices = loadSvg(grenadePaths).then(root =>  
        select(root, 'path').map(path => 
            Vertices.scale(Svg.pathToVertices(path, 30), 1, 1, Vector.create(0.0, 0.0))
        )
    )
    private body?: Body;
    private parent?: Composite;
    private timer = Ticker.targetFPMS * 5000;

    private timerText: Text;

    private get timerTextValue() {
        return `${(this.timer / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }

    constructor(position: { x: number, y: number }, private readonly initialForce: { x: number, y: number}) {
        super(Grenade.texture);
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
        setTimeout(() => console.log("5s of actual elapsed time"), 5000);
    }
    
    async create(parent: Container, composite: Composite) {
        super.create(parent, composite);
        this.body = Bodies.fromVertices(this.sprite.x + 50, this.sprite.y, await Grenade.bodyVertices);
        this.body.friction = Grenade.FRICTION;
        this.body.restitution = Grenade.RESITITUTION;
        Composite.add(composite, this.body);
        this.parent = composite;
        Body.applyForce(this.body, Vector.create(this.body.position.x - 5, this.body.position.y - 5), Vector.create(this.initialForce.x, this.initialForce.y));
    }

    update(dt: number): void {
        if (!this.body || this.sprite.destroyed) {
            return;
        }
        this.sprite.position = this.body.position;
        this.sprite.rotation = this.body.angle;
        this.timerText.rotation = -this.body.angle;
        this.timerText.text = this.timerTextValue;
        this.timer -= dt;
        console.log(dt);

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
        console.log('elapsed');
        this.destroy();
    }
}