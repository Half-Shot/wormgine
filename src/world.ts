import { IGameEntity, IMatterEntity } from "./entities/entity";
import { Ticker, UPDATE_PRIORITY } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { Ball, Collider, ColliderDesc, EventQueue, QueryFilterFlags, RigidBody, RigidBodyDesc, Vector2, World } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "./utils/coodinate";

/**
 * Utility class holding the matterjs composite and entity map.
 */

export interface RapierPhysicsObject {
    collider: Collider;
    body: RigidBody
}


export const PIXELS_PER_METER = 20;

export enum CollisionGroups {
    Terrain = 1, // 0001
    WorldObjects = 2, //0010
    Player = 4,
}

export function collisionGroupBitmask(groups: CollisionGroups|CollisionGroups[], collides: CollisionGroups|CollisionGroups[]) {
    // https://rapier.rs/docs/user_guides/javascript/colliders/#collision-groups-and-solver-groups
    groups = Array.isArray(groups) ? groups : [groups];
    collides = Array.isArray(collides) ? groups :[collides];

    const groupsInt = groups.reduce((o, c) => o + c) << 16; 
    const collidesInt = collides.reduce((o, c) => o + c);

    return groupsInt + collidesInt;
}

export class GameWorld {
    public readonly bodyEntityMap = new Map<number, IMatterEntity>();
    public readonly entities = new Set<IGameEntity>();
    private readonly eventQueue = new EventQueue(true);
    // TODO: Unsure if this is the best location.
    
    constructor(public readonly rapierWorld: World, public readonly ticker: Ticker, public readonly viewport: Viewport) {
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
        });
        this.eventQueue.drainContactForceEvents((event) => {
            console.log('contactForceEvents', event);
        });
    }

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
            if (entity.destroyed) {
                this.ticker.remove(tickerFn);
                this.entities.delete(entity);
                return;
            }
            entity.update?.(dt.deltaTime);
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


    public pointInAnyObject(position: Coordinate): boolean {
        // Ensure a unique set of results.
        let found = false;
        this.rapierWorld.intersectionsWithPoint(
            new Vector2(position.worldX, position.worldY),
            () => {
                found = true;
                return false;
            },
            QueryFilterFlags.EXCLUDE_SENSORS,
        );
        return found;
    }

    public checkCollision(position: Coordinate, radius: number|MetersValue, ownCollier: Collider): IMatterEntity[] {
        // Ensure a unique set of results.
        const results = new Set<IMatterEntity>();
        this.rapierWorld.intersectionsWithShape(
            new Vector2(position.worldX, position.worldY),
            0,
            new Ball(radius.valueOf()),
            (collider) => {
                if (collider.handle !== ownCollier.handle) {
                    const entity = this.bodyEntityMap.get(collider.handle);
                    if (entity) {
                        results.add(entity);
                    }
                }
                return true;
            },
        );
        return [...results];
    }
}