import { Composite, Engine, Events, IEventCollision, Body, IEventComposite, Query } from "matter-js";
import { IGameEntity, IMatterEntity } from "./entities/entity";
import { Ticker, UPDATE_PRIORITY } from "pixi.js";
import { Viewport } from "pixi-viewport";

/**
 * Utility class holding the matterjs composite and entity map.
 */
export class GameWorld {
    public readonly bodyEntityMap = new Map<Body, IMatterEntity>();
    public readonly entities = new Set<IGameEntity>();
    // TODO: Unsure if this is the best location.
    
    constructor(public readonly matterEngine: Engine, public readonly ticker: Ticker, public readonly viewport: Viewport) {
        Events.on(this.matterEngine, 'collisionStart', this.onCollision.bind(this));
        Events.on(this.matterEngine, 'beforeRemove', this.beforeRemove.bind(this));
    }

    private beforeRemove(event: IEventComposite<Engine>) {
        console.log('body being removed', event);
    }

    private onCollision(event: IEventCollision<Engine>) {
        const [pairA] = event.pairs;
        const [entA, entB] = [ this.bodyEntityMap.get(pairA.bodyA), this.bodyEntityMap.get(pairA.bodyB)];

        console.log(pairA.bodyB);

        if (!entA || !entB) {
            console.warn(`Untracked collision between ${pairA.bodyA.id} ${pairA.bodyA.label} (${entA}) and ${pairA.bodyB.id} ${pairA.bodyB.label} (${entB})`);
            return;
        }

        const contact = pairA.contacts[0];

        entA.onCollision?.(entB, contact.vertex);
        entB.onCollision?.(entA, contact.vertex);
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

    public addBody<T extends IMatterEntity>(entity: T, ...body: Body[]) {
        Composite.add(this.matterEngine.world, body);

        console.log("Adding body", entity, body[0].id);

        body.forEach(b => {
            if (this.bodyEntityMap.has(b)) {
                console.warn(`Tried to add body twice to game world`, b, entity);
                return;
            }
            this.bodyEntityMap.set(b, entity)
            if (b.parts.length) {
                b.parts.forEach((part) => this.bodyEntityMap.set(part, entity));
            }
        });
    }
    removeBody(body: Body) {
        Composite.remove(this.matterEngine.world, body);
        this.bodyEntityMap.delete(body);
        body.parts.forEach((part) => this.bodyEntityMap.delete(part));
    }

    removeEntity(entity: IGameEntity) {
        this.entities.delete(entity);
    }

    public checkCollision(body: Body, ownEntity: IMatterEntity): IMatterEntity|undefined {
        const hits = Query.collides(body, this.matterEngine.world.bodies).sort((a,b) => b.depth - a.depth);
        console.log("hits", hits);
        for (const hitBody of hits) {
            console.log(hits, ownEntity, this.bodyEntityMap);
            const ents = [
                this.bodyEntityMap.get(hitBody.bodyA),
                this.bodyEntityMap.get(hitBody.bodyB)
            ].filter(e => e && e !== ownEntity);
            console.log("Found hit", ents, this.bodyEntityMap.get(hitBody.bodyB));
            // TODO: Cheating massively
            if (ents[0]) {
                return ents[0];
            }
        }

    }
}