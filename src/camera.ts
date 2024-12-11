import { Viewport } from "pixi-viewport";
import { Ticker } from "pixi.js";
import { GameWorld } from "./world";
import { PhysicsEntity } from "./entities/phys/physicsEntity";
import { PlayableEntity } from "./entities/playable/playable";
import { MovedEvent } from "pixi-viewport/dist/types";
import Logger from "./log";

const logger = new Logger('ViewportCamera');

export enum CameraLockPriority {
    // Do not lock the camera to this object
    NoLock = 0,
    // Snap the camera to this object if the current player isn't local, but allow the user to move away.
    SuggestedLockNonLocal = 1,
    // Snap the camera to this object, but allow the user to move away.
    SuggestedLockLocal = 2,
    // Lock the camera to this object, but only suggest it to local players.
    LockIfNotLocalPlayer = 3,
    // Always lock the camera to this object.
    AlwaysLock = 4
}

export class ViewportCamera {
    private currentLockTarget: PhysicsEntity|null = null;
    private userWantsControl = false;
    private lastMoveHash = 0;

    constructor(private readonly viewport: Viewport, private readonly world: GameWorld) {
        viewport.on('moved', (event: MovedEvent) => {
            if (event.type === "clamp-y" || event.type === "clamp-x") {
                // Ignore, the director moved us.
                return;
            }
            this.userWantsControl = true;
            logger.debug('Player took control');
        });
    }

    public update(dt: Ticker, currentWorm: PlayableEntity|undefined) {
        let newTarget: PhysicsEntity|null = null;
        let priority: CameraLockPriority = CameraLockPriority.NoLock;
        if (this.currentLockTarget?.destroyed) {
            this.currentLockTarget = null;
        }
        for (const e of this.world.entities.values()) {
            if (e instanceof PhysicsEntity === false) {
                continue;
            }
            if (e.cameraLockPriority > priority) {
                newTarget = e;
                priority = e.cameraLockPriority;
            }
        }
        if (!newTarget) {
            return;
        }


        const isLocal = !currentWorm?.wormIdent.team.playerUserId;
        if (newTarget !== this.currentLockTarget) {
            // Reset user control.
            this.userWantsControl = false;
            logger.debug("New lock target", newTarget);
        }
        this.currentLockTarget = newTarget;

        const targetXY: [number, number] = [this.currentLockTarget.sprite.position.x, this.currentLockTarget.sprite.position.y];
        // Short circuit skip move if it's cheaper not to.
        let newMoveHash = (this.currentLockTarget.sprite.position.x + this.currentLockTarget.sprite.position.y);
        if (this.lastMoveHash === newMoveHash) {
            return;
        }
        this.lastMoveHash = newMoveHash;

        switch (this.currentLockTarget.cameraLockPriority) {
            case CameraLockPriority.SuggestedLockNonLocal:
                if (this.userWantsControl) {
                    return;
                }
                // Need a better way to determine this.
                if (!isLocal) {
                    this.viewport.moveCenter(...targetXY);
                }
                break;
            case CameraLockPriority.SuggestedLockLocal:
                if (this.userWantsControl) {
                    return;
                }
                this.viewport.moveCenter(...targetXY);
                break;
            case CameraLockPriority.LockIfNotLocalPlayer:
                if (!isLocal) {
                    this.viewport.moveCenter(...targetXY);
                } else if (!this.userWantsControl) {
                    this.viewport.moveCenter(...targetXY);
                }
                break;

            case CameraLockPriority.AlwaysLock:
                this.viewport.moveCenter(...targetXY);
                break;
        }
    }
}