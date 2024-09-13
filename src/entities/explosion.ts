import { Vector } from "matter-js";
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

    private readonly gfx: Graphics;
    private timer: number;
    private radiusExpandBy: number;
    private shrapnel: {
        point: Vector,
        speed: Vector,
        accel: Vector,
        radius: number,
        alpha: number,
        kind: "fire"|"pop"
    }[] = []

    static create(parent: Container, point: Vector, initialRadius: number) {
        const ent = new Explosion(point, initialRadius);
        parent.addChild(ent.gfx);
        return ent;
    }

    private constructor(point: Vector, private initialRadius: number, shrapnelMin = 8, shrapnelMax = 25) {
        for (let index = 0; index < (shrapnelMin + Math.ceil(Math.random() * (shrapnelMax-shrapnelMin))); index++) {
            const xSpeed = (Math.random()*7)-3.5;
            const kind = Math.random() >= 0.75 ? "fire" : "pop";
            this.shrapnel.push({
                alpha: 1,
                point: Vector.create(),
                speed: Vector.create(
                    xSpeed,
                    (Math.random()*0.5)-7,
                ),
                accel: Vector.create(
                    // Invert the accel
                    -(xSpeed/120),
                    Math.random(),
                ),
                radius: 2 + Math.random()*(kind === "pop" ? 8.5 : 4.5),
                kind,
            })
            
        };
        this.gfx = new Graphics({ position: Vector.clone(point)});
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

        let anyShrapnelVisible = false;
        for (const shrapnel of this.shrapnel) {
            shrapnel.speed.x += shrapnel.accel.x*dt;
            shrapnel.speed.y += shrapnel.accel.y*dt;
            shrapnel.point.x += shrapnel.speed.x*dt;
            shrapnel.point.y += shrapnel.speed.y*dt;
            shrapnel.alpha = Math.max(0, shrapnel.alpha-(Math.random()*dt*0.03));
            anyShrapnelVisible = anyShrapnelVisible || shrapnel.point.y < 1200 || shrapnel.alpha < 0;
            if (shrapnel.kind === "pop") {
                this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius).fill({ color: 0xEEEEEE, alpha: shrapnel.alpha });
            } else {
                this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius).fill({ color: 0xfd4301, alpha: shrapnel.alpha });
                this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius-3).fill({ color: 0xfde101, alpha: shrapnel.alpha });
            }
            
        }
        if (this.timer > 0) {
            const alphaLarger =  Math.round(ttl * 100) / 150;
            const alphaSmaller = Math.round(ttl * 100) / 100;
            this.gfx.circle(0, 0, radius).fill({ color: 0xFFFFFF, alpha: alphaLarger });
            const outerWidth = ttlInverse*(radius * 2);
            this.gfx.ellipse(0, 0, outerWidth, radius/1.5).fill({color: 0xAAEEFF, alpha: alphaSmaller });
            if (outerWidth - 20 > 0) {
                this.gfx.ellipse(0, 0, outerWidth - 20, radius / 2).cut();
            }
        }
        // Just wait for the shrapnel to leave the stage.

        if (!anyShrapnelVisible) {
            this.destroy();
        }
    }

    destroy(): void {
        this.gfx.destroy();
    }
}