import { Viewport } from "pixi-viewport";
import { WormInstance } from "../../logic/teams";
import { Toaster } from "../../overlays/toaster";
import { StateRecorder } from "../../state/recorder";
import { Coordinate } from "../../utils";
import { GameWorld } from "../../world";
import { FireFn, Worm, WormState } from "./worm";
import { StateWormAction } from "../../state/model";
import { InputKind } from "../../input";

/**
 * An instance of the worm class controlled by a remote (or AI) player.
 */
export class RemoteWorm extends Worm {
    static create(parent: Viewport, world: GameWorld, position: Coordinate, wormIdent: WormInstance, onFireWeapon: FireFn, toaster?: Toaster) {
        const ent = new RemoteWorm(position, world, parent, wormIdent, onFireWeapon, toaster);
        world.addBody(ent, ent.physObject.collider);
        parent.addChild(ent.targettingGfx);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        parent.addChild(ent.healthTextBox);
        return ent;
    }

    private constructor(position: Coordinate, world: GameWorld, parent: Viewport, wormIdent: WormInstance, onFireWeapon: FireFn, toaster?: Toaster) {
        super(position, world, parent, wormIdent, onFireWeapon, toaster, undefined);
    }

    public replayWormAction(remoteAction: StateWormAction) {
        switch (remoteAction) {
            case StateWormAction.MoveLeft:
                this.setMoveDirection(InputKind.MoveLeft);
                break;
            case StateWormAction.MoveRight:
                this.setMoveDirection(InputKind.MoveRight);
                break;
            case StateWormAction.Jump:
                this.onJump();
                break;
            case StateWormAction.Backflip:
                this.onBackflip();
                break;
            case StateWormAction.AimUp:
                this.state = WormState.AimingUp;
                break;
            case StateWormAction.AimDown:
                this.state = WormState.AimingDown;
                break;
            case StateWormAction.Fire:
                this.onBeginFireWeapon();
                break;
            case StateWormAction.EndFire:
                this.onEndFireWeapon();
                break;
            case StateWormAction.Stop:
                this.state = WormState.Idle;
                break;
        }
    }
}