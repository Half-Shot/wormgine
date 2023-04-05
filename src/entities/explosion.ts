import { Composite, Vector } from "matter-js";
import { Container, Graphics, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";
import { Sound } from "@pixi/sound";

export class Explosion implements IGameEntity {
    public readonly priority: UPDATE_PRIORITY = UPDATE_PRIORITY.HIGH;
    public static explosionSounds: Sound[];
    private explosionMs = 500;

    public get destroyed() {
        return this.gfx.destroyed;
    }

    private gfx = new Graphics;
    private timer: number;
    private radiusExpandBy: number;

    static create(parent: Container, point: Vector, initialRadius: number) {
        const ent = new Explosion(point, initialRadius);
        parent.addChild(ent.gfx);
        return ent;
    }

    private constructor(private readonly point: Vector, private initialRadius: number) {
        this.timer = Ticker.targetFPMS * this.explosionMs;
        this.radiusExpandBy = initialRadius * 0.2;
        const soundIndex = Math.floor(Math.random()*Explosion.explosionSounds.length);
        Explosion.explosionSounds[soundIndex].play();
    }


    update(dt: number): void {
        this.timer -= dt;
        const ttl = this.timer / (this.explosionMs*Ticker.targetFPMS);
        const ttlInverse = 1-ttl;
        const expandBy = 1-(this.radiusExpandBy*ttl);
        const radius = this.initialRadius + expandBy;
        this.gfx.clear();
        const alphaLarger =  Math.round(ttl * 100) / 150;
        const alphaSmaller = Math.round(ttl * 100) / 100;
        this.gfx.beginFill(0xFFFFFF, alphaLarger);
        this.gfx.drawCircle(this.point.x, this.point.y, radius);
        this.gfx.endFill();
        this.gfx.beginFill(0xAAEEFF, alphaSmaller);
        const outerWidth = ttlInverse*(radius * 2);
        this.gfx.drawEllipse(this.point.x, this.point.y, outerWidth, radius/1.5);
        if (outerWidth - 20 > 0) {
            this.gfx.beginHole();
            this.gfx.drawEllipse(this.point.x, this.point.y, outerWidth - 20, radius / 2);
            this.gfx.endHole();
        }
        this.gfx.endFill();

        if (this.timer <= 0) {
            this.destroy();
        }
    }

    destroy(): void {
        this.gfx.destroy();
    }
}