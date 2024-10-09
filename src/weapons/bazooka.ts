import { Container } from "pixi.js";
import { FireOpts, IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { add, Coordinate, mult } from "../utils";
import { BazookaShell } from "../entities/phys/bazookaShell";
import { AssetPack } from "../assets";
import { Sound } from "@pixi/sound";

let fireSound: Sound;

export const WeaponBazooka: IWeaponDefiniton = {
    code: IWeaponCode.Bazooka,
    maxDuration: 80,
    timerAdjustable: false,
    showTargetGuide: true,
    loadAssets(assets: AssetPack) {
        fireSound = assets.sounds.bazookafire;
    },
    fireFn(parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) {
        if (opts.duration === undefined) {
            throw Error('Duration expected but not given');
        }
        if (opts.angle === undefined) {
            throw Error('Angle expected but not given');
        }
        fireSound.play();
        const forceComponent = Math.log(opts.duration/10)*3;
        const x = forceComponent*Math.cos(opts.angle);
        const y = forceComponent*Math.sin(opts.angle);
        const force = mult(new Vector2(1.5 * forceComponent, forceComponent), { x, y });
        // TODO: Refactor ALL OF THIS
        const position = Coordinate.fromWorld(add(worm.position, {x, y: -0.5})); 
        return BazookaShell.create(parent, world, position, force, worm.wormIdent);
    },
}