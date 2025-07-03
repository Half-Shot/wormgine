import { IGameEntity, IPhysicalEntity } from "./entities/entity";
import { Ticker, UPDATE_PRIORITY } from "pixi.js";
import {
  Ball,
  Collider,
  ColliderDesc,
  EventQueue,
  QueryFilterFlags,
  Ray,
  RigidBody,
  RigidBodyDesc,
  Shape,
  Vector2,
  World,
} from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "./utils/coodinate";
import { add, mult } from "./utils";
import Logger from "./log";
import globalFlags from "./flags";
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  map,
  Observable,
  skipWhile,
} from "rxjs";
import type { PhysicsEntity } from "./entities/phys/physicsEntity";

const logger = new Logger("World");

/**
 * Utility class holding the matterjs composite and entity map.
 */

export interface RapierPhysicsObject {
  collider: Collider;
  body: RigidBody;
}

export const PIXELS_PER_METER = 20;
export const MAX_WIND = 10;

export enum CollisionGroups {
  Terrain = 1, // 0001
  WorldObjects = 2, //0010
  Player = 4,
}

export function collisionGroupBitmask(
  groups: CollisionGroups | CollisionGroups[],
  collides: CollisionGroups | CollisionGroups[],
) {
  // https://rapier.rs/docs/user_guides/javascript/colliders/#collision-groups-and-solver-groups
  groups = Array.isArray(groups) ? groups : [groups];
  collides = Array.isArray(collides) ? groups : [collides];

  const groupsInt = groups.reduce((o, c) => o + c) << 16;
  const collidesInt = collides.reduce((o, c) => o + c);

  return groupsInt + collidesInt;
}

type WindValue =
  | -10
  | -9
  | -8
  | -7
  | -6
  | -5
  | -4
  | -3
  | -2
  | -1
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

/**
 * Global game world class for handling both entity update loops, and
 * physics operations.
 */
export class GameWorld {
  public readonly bodyEntityMap = new Map<number, IPhysicalEntity>();
  public readonly entities = new Map<string, IGameEntity>();
  private readonly eventQueue = new EventQueue(true);

  private readonly windSubject = new BehaviorSubject<WindValue>(0);
  public readonly wind$ = this.windSubject.asObservable();

  private readonly entitiesMoving = new BehaviorSubject(false);
  public readonly entitiesMoving$: Observable<boolean>;

  private readonly entityUpdatePool = new Map<
    UPDATE_PRIORITY,
    Set<IGameEntity>
  >();

  public waterYPosition = 0;

  private readonly physicsEntitySet = new BehaviorSubject<Set<IPhysicalEntity>>(
    new Set(),
  );
  /**
   * Observer for the current set of physics object in the world.
   */
  public readonly physicsEntitySet$: Observable<
    IteratorObject<IPhysicalEntity>
  > = this.physicsEntitySet.pipe(
    debounceTime(150),
    map((e) => e.values()),
  );

  /**
   * @deprecated Use `this.wind$`
   */
  get wind() {
    return this.windSubject.value;
  }

  /**
   * @deprecated Use `this.entitiesMoving$`
   */
  get entitiesMovingValue() {
    return this.entitiesMoving.value;
  }

  constructor(
    public readonly rapierWorld: World,
    protected readonly ticker: Ticker,
  ) {
    this.entitiesMoving$ = this.entitiesMoving.pipe(
      // When the world is created there will be a lot of entities moving about
      // This segment skips the initial stage.
      skipWhile((moving) => moving === false),
      skipWhile((moving) => moving === true),
      distinctUntilChanged(),
    );
    this.entitiesMoving$.subscribe((entsMoving) => {
      logger.debug(`Entities moving: ${entsMoving}`);
    });
    this.entityUpdatePool.set(UPDATE_PRIORITY.INTERACTION, new Set());
    this.entityUpdatePool.set(UPDATE_PRIORITY.HIGH, new Set());
    this.entityUpdatePool.set(UPDATE_PRIORITY.NORMAL, new Set());
    this.entityUpdatePool.set(UPDATE_PRIORITY.LOW, new Set());
    this.entityUpdatePool.set(UPDATE_PRIORITY.UTILITY, new Set());
  }

  public setWind(windSpeed: number) {
    logger.info(`setWind(${windSpeed})`);
    if (!Number.isInteger(windSpeed) || windSpeed < -10 || windSpeed > 10) {
      throw Error("Wind speed must be between -10 and 10, and be an integer");
    }
    this.windSubject.next(windSpeed as WindValue);
  }

  private areEntitiesMoving() {
    for (const e of this.bodyEntityMap.values()) {
      try {
        if (e.consideredActive) {
          return true;
        }
        if (e.consideredActive === false) {
          continue;
        }
        if (
          !e.destroyed &&
          e.body?.isEnabled?.() &&
          e.body?.isDynamic?.() &&
          e.body?.isMoving?.()
        ) {
          return true;
        }
      } catch (ex) {
        logger.error("Error caught when handing", e);
        throw ex;
      }
    }
    return false;
  }

  public step() {
    if (!globalFlags.simulatePhysics) {
      return;
    }
    this.rapierWorld.step(this.eventQueue);
    this.eventQueue.drainCollisionEvents((collider1, collider2, started) => {
      if (started) {
        this.onCollision(
          this.rapierWorld.getCollider(collider1),
          this.rapierWorld.getCollider(collider2),
        );
      }
    });
    this.eventQueue.drainContactForceEvents((event) => {
      logger.verbose("contactForceEvents", event);
    });
    this.entitiesMoving.next(this.areEntitiesMoving());
  }

  public updateEntities(ticker: Ticker) {
    // TODO: Skip update of lower pools if we're behind time.
    for (const pool of this.entityUpdatePool.values()) {
      for (const ent of pool) {
        if (!ent.destroyed) {
          // Always defined.
          ent.update?.(ticker.deltaTime, ticker.deltaMS);
        }
      }
    }
  }

  private onCollision(collider1: Collider, collider2: Collider) {
    const [entA, entB] = [
      this.bodyEntityMap.get(collider1.handle),
      this.bodyEntityMap.get(collider2.handle),
    ];

    if (!entA || !entB) {
      console.warn(
        `Untracked collision between ${collider1.handle} (${entA}) and ${collider2.handle}  (${entB})`,
      );
      return;
    }

    const shapeColA = collider1.contactCollider(collider2, 4);

    if (!shapeColA) {
      console.warn(
        `Collision contactCollider failed after onCollision call for ${entA} and ${entB}`,
      );
      return;
    }

    entA.onCollision?.(entB, shapeColA.point1);
    entB.onCollision?.(entA, shapeColA.point2);
  }

  /**
   * Add an entity to the world. If the entity is coming from a remote source, provide the uuid.
   * @param entity
   * @param uuid
   * @returns
   */
  public addEntity<T extends IGameEntity>(entity: T, uuid?: string): T {
    if ([...this.entities.values()].includes(entity)) {
      console.warn(`Tried to add entity twice to game world`, entity);
      return entity;
    }
    const entUuid = uuid ?? globalThis.crypto.randomUUID();
    this.entities.set(entUuid, entity);
    if (entity.update) {
      this.entityUpdatePool.get(entity.priority)?.add(entity);
    }
    return entity;
  }

  public createRigidBodyCollider(
    colliderDesc: ColliderDesc,
    rigidBodyDesc: RigidBodyDesc,
  ): RapierPhysicsObject {
    const body = this.rapierWorld.createRigidBody(rigidBodyDesc);
    const collider = this.rapierWorld.createCollider(colliderDesc, body);
    return { body, collider };
  }

  public addBody<T extends IPhysicalEntity>(
    entity: T,
    ...colliders: Collider[]
  ) {
    if (colliders.length === 0) {
      throw Error("Must provide at least one collider");
    }
    colliders.forEach((collider) => {
      if (this.bodyEntityMap.has(collider.handle)) {
        console.warn(
          `Tried to add collider entity twice to game world`,
          collider.handle,
          entity,
        );
        return;
      }
      this.bodyEntityMap.set(collider.handle, entity);
    });
    this.physicsEntitySet.next(this.physicsEntitySet.value.add(entity));
  }

  removeBody(obj: RapierPhysicsObject) {
    if (this.bodyEntityMap.delete(obj.collider.handle)) {
      this.rapierWorld.removeCollider(obj.collider, false);
      this.rapierWorld.removeRigidBody(obj.body);
    } else {
      logger.error("Entity already deleted!");
    }
  }

  removeEntity(entity: IGameEntity) {
    const key = [...this.entities.entries()].find(
      ([_k, v]) => v === entity,
    )?.[0];
    if (!key) {
      throw Error("Entity not found in world");
    }
    this.entities.delete(key);
    this.entityUpdatePool.forEach((p) => p.delete(entity));
    if (this.physicsEntitySet.value.delete(entity as PhysicsEntity)) {
      this.physicsEntitySet.next(this.physicsEntitySet.value);
    }
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

  public checkCollisionShape(
    position: Coordinate,
    shape: Shape,
    ownCollier: Collider,
  ): { collider: Collider; entity: IPhysicalEntity }[] {
    // Ensure a unique set of results.
    const results = new Array<{
      collider: Collider;
      entity: IPhysicalEntity;
    }>();
    this.rapierWorld.intersectionsWithShape(
      new Vector2(position.worldX, position.worldY),
      0,
      shape,
      (collider) => {
        if (collider.handle !== ownCollier.handle) {
          const entity = this.bodyEntityMap.get(collider.handle);
          if (entity) {
            results.push({ entity, collider });
          }
        }
        return true;
      },
    );
    return [...results];
  }

  public checkCollision(
    position: Coordinate,
    radius: number | MetersValue,
    ownCollier?: Collider,
  ): IPhysicalEntity[] {
    // Ensure a unique set of results.
    const results = new Set<IPhysicalEntity>();
    this.rapierWorld.intersectionsWithShape(
      new Vector2(position.worldX, position.worldY),
      0,
      new Ball(radius.valueOf()),
      (collider) => {
        if (!ownCollier || collider.handle !== ownCollier.handle) {
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

  public rayTrace(
    position: Coordinate,
    direction: Vector2,
    ignore: Collider,
  ): { entity: IPhysicalEntity; hitLoc: Coordinate } | null {
    const hit = this.rapierWorld.castRay(
      new Ray(position.toWorldVector(), direction),
      1000,
      true,
      undefined,
      undefined,
      ignore,
    );
    logger.debug("rayTrace results", hit);
    if (hit?.collider) {
      const entity = this.bodyEntityMap.get(hit.collider.handle);
      if (!entity) {
        throw new Error("Hit collider but no mapped entity");
      }
      return {
        entity,
        hitLoc: Coordinate.fromWorld(
          add(position.toWorldVector(), mult(direction, hit.timeOfImpact)),
        ),
      };
    }
    return null;
  }
}
