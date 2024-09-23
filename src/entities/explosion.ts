import { Container, Graphics, Point, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";
import { Sound } from "@pixi/sound";
import { MetersValue } from "../utils/coodinate";

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
        point: Point,
        speed: Point,
        accel: Point,
        radius: number,
        alpha: number,
        kind: "fire"|"pop"
    }[] = []

    static create(parent: Container, point: Point, initialRadius: MetersValue, shrapnelMin = 8, shrapnelMax = 25) {
        const ent = new Explosion(point, initialRadius, shrapnelMin, shrapnelMax);
        parent.addChild(ent.gfx);
        return ent;
    }

    private constructor(point: Point, private initialRadius: MetersValue, shrapnelMin: number, shrapnelMax: number) {
        for (let index = 0; index < (shrapnelMin + Math.ceil(Math.random() * (shrapnelMax-shrapnelMin))); index++) {
            const xSpeed = (Math.random()*7)-3.5;
            const kind = Math.random() >= 0.75 ? "fire" : "pop";
            this.shrapnel.push({
                alpha: 1,
                point: new Point(),
                speed: new Point(
                    xSpeed,
                    (Math.random()*0.5)-7,
                ),
                accel: new Point(
                    // Invert the accel
                    -(xSpeed/120),
                    Math.random(),
                ),
                radius: 2 + Math.random()*(kind === "pop" ? 8.5 : 4.5),
                kind,
            })
            
        }
        this.gfx = new Graphics({ position: point.clone()});
        this.timer = Ticker.targetFPMS  * this.explosionMs;
        this.radiusExpandBy = initialRadius.pixels * 0.2;
        const soundIndex = Math.floor(Math.random()*Explosion.explosionSounds.length);
        Explosion.explosionSounds[soundIndex].play();
    }


    update(dt: number): void {
        console.log(this.timer, dt);
        this.timer -= dt;
        const ttl = this.timer / (Ticker.targetFPMS*this.explosionMs);
        const ttlInverse = 1-ttl;

        const expandBy = 1-(this.radiusExpandBy*ttl);
        const radius = this.initialRadius.pixels + expandBy;
        this.gfx.clear();

        let anyShrapnelVisible = true;
        // for (const shrapnel of this.shrapnel) {
        //     shrapnel.speed.x += shrapnel.accel.x*dt;
        //     shrapnel.speed.y += shrapnel.accel.y*dt;
        //     shrapnel.point.x += shrapnel.speed.x*dt;
        //     shrapnel.point.y += shrapnel.speed.y*dt;
        //     shrapnel.alpha = Math.max(0, shrapnel.alpha-(Math.random()*dt*0.03));
        //     anyShrapnelVisible = anyShrapnelVisible || shrapnel.point.y < 1200 || shrapnel.alpha < 0;
        //     if (shrapnel.kind === "pop") {
        //         this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius).fill({ color: 0xEEEEEE, alpha: shrapnel.alpha });
        //     } else {
        //         this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius).fill({ color: 0xfd4301, alpha: shrapnel.alpha });
        //         this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius-3).fill({ color: 0xfde101, alpha: shrapnel.alpha });
        //     }
            
        // }
        console.log(this.timer);
        if (this.timer > 0) {
            const alphaLarger =  Math.round(ttl * 100) / 150;
            const alphaSmaller = Math.round(ttl * 100) / 100;
            this.gfx.circle(0, 0, radius).fill({ color: 0xFFFFFF, alpha: alphaLarger });
            const outerWidth = ttlInverse*(radius * 2);
            this.gfx.ellipse(0, 0, outerWidth, radius/1.5).fill({color: 0xAAEEFF, alpha: alphaSmaller });
            if (outerWidth - 20 > 0) {
                this.gfx.ellipse(0, 0, outerWidth - 20, radius / 2).cut();
            }
            console.log(alphaLarger, alphaSmaller, outerWidth);
        } else {
            this.destroy();
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