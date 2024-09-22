import { IGameEntity, IMatterEntity } from "./entities/entity";
import { Ticker, UPDATE_PRIORITY } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Ball, Collider, ColliderDesc, EventQueue, RigidBody, RigidBodyDesc, Vector2, World } from "@dimforge/rapier2d";

/**
 * Utility class holding the matterjs composite and entity map.
 */

export interface RapierPhysicsObject {
    collider: Collider;
    body: RigidBody
}


export const PIXELS_PER_METER = 20;

export class GameWorld {
    public readonly bodyEntityMap = new Map<number, IMatterEntity>();
    public readonly entities = new Set<IGameEntity>();
    private readonly eventQueue = new EventQueue(true);
    // TODO: Unsure if this is the best location.
    
    constructor(public readonly rapierWorld: World, public readonly ticker: Ticker, public readonly viewport: Viewport) {
        // TODO: Fix.
        // Events.on(this.matterEngine, 'collisionStart', this.onCollision.bind(this));
        // Events.on(this.matterEngine, 'beforeRemove', this.beforeRemove.bind(this));
    }

    public step() {
        this.rapierWorld.step(this.eventQueue);
        this.eventQueue.drainCollisionEvents((collider1, collider2, started) => {
            if (started) {
                this.onCollision(
                    this.rapierWorld.getCollider(collider1),
                    this.rapierWorld.getCollider(collider2)
                );
            }
            console.log('collisionEvent', collider1, collider2, started);
        });
        this.eventQueue.drainContactForceEvents((event) => {
            console.log('contactForceEvents', event);
        });
    }

    // private beforeRemove(event: IEventComposite<Engine>) {
    //     console.log('body being removed', event);
    // }

    private onCollision(collider1: Collider, collider2: Collider) {
        const [entA, entB] = [ this.bodyEntityMap.get(collider1.handle), this.bodyEntityMap.get(collider2.handle)];

        if (!entA || !entB) {
            console.warn(`Untracked collision between ${collider1.handle} (${entA}) and ${collider2.handle}  (${entB})`);
            return;
        }

        const shapeColA = collider1.contactCollider(collider2, 4);

        if (!shapeColA) {
            console.warn(`Collision contactCollider failed after onCollision call for ${entA} and ${entB}`)
            return;
        }


        entA.onCollision?.(entB, shapeColA.point1);
        entB.onCollision?.(entA, shapeColA.point2);
    }

    public addEntity<T extends IGameEntity>(entity: T): T {
        if (this.entities.has(entity)) {
            console.warn(`Tried to add entity twice to game world`, entity);
            return entity;
        }
        this.entities.add(entity);
        const tickerFn = (dt: Ticker) => {
            entity.update?.(dt.deltaTime);
            if (entity.destroyed) {
                this.ticker.remove(tickerFn);
                this.entities.delete(entity);
            }
        };
        this.ticker.add(tickerFn, undefined, entity.priority ? entity.priority : UPDATE_PRIORITY.LOW);
        return entity;
    }

    public createRigidBodyCollider(colliderDesc: ColliderDesc, rigidBodyDesc: RigidBodyDesc): RapierPhysicsObject {
        const body = this.rapierWorld.createRigidBody(rigidBodyDesc);
        const collider = this.rapierWorld.createCollider(
            colliderDesc,
            body
        );
        return { body, collider };
    }

    public addBody<T extends IMatterEntity>(entity: T, ...collider: Collider[]) {
        console.log("Adding body", entity, collider);

        collider.forEach(collider => {
            if (this.bodyEntityMap.has(collider.handle)) {
                console.warn(`Tried to add collider entity twice to game world`, collider.handle, entity);
                return;
            }
            this.bodyEntityMap.set(collider.handle, entity);
        });
    }
    removeBody(obj: RapierPhysicsObject) {
        this.rapierWorld.removeCollider(obj.collider, false);
        this.rapierWorld.removeRigidBody(obj.body);
        this.bodyEntityMap.delete(obj.collider.handle);
    }

    removeEntity(entity: IGameEntity) {
        this.entities.delete(entity);
    }

    public checkCollision(position: Vector2, radius: number, ownCollier: Collider): IMatterEntity|null {
        const result = this.rapierWorld.intersectionWithShape(
            position,
            0,
            new Ball(radius),
            undefined,
            undefined,
            undefined,
            undefined,
            (collider) => {
                if (collider.handle === ownCollier.handle) {
                    return false;
                }
                return this.bodyEntityMap.has(collider.handle);
            }
        );
        return result && this.bodyEntityMap.get(result.handle) || null;
        // const hits = Query.collides(body, this.matterEngine.world.bodies).sort((a,b) => b.depth - a.depth);
        // console.log("hits", hits);
        // for (const hitBody of hits) {
        //     console.log(hits, ownEntity, this.bodyEntityMap);
        //     const ents = [
        //         this.bodyEntityMap.get(hitBody.bodyA),
        //         this.bodyEntityMap.get(hitBody.bodyB)
        //     ].filter(e => e && e !== ownEntity);
        //     console.log("Found hit", ents, this.bodyEntityMap.get(hitBody.bodyB));
        //     // TODO: Cheating massively
        //     if (ents[0]) {
        //         return ents[0];
        //     }
        // }

    }
}