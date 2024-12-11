import { Container, Sprite, Text, Texture, Ticker } from "pixi.js";
import { TimedExplosive } from "./timedExplosive";
import { IPhysicalEntity } from "../entity";
import { IMediaInstance, Sound } from "@pixi/sound";
import { collisionGroupBitmask, CollisionGroups, GameWorld } from "../../world";
import {
  ActiveEvents,
  Collider,
  ColliderDesc,
  RigidBodyDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { AssetPack } from "../../assets";
import { BitmapTerrain } from "../bitmapTerrain";
import { DefaultTextStyle } from "../../mixins/styles";
import { EntityType } from "../type";

/**
 * Proximity mine.
 */
export class Mine extends TimedExplosive {
  public static readAssets(assets: AssetPack) {
    Mine.texture = assets.textures.mine;
    Mine.textureActive = assets.textures.mineActive;
    Mine.beep = assets.sounds.mineBeep;
  }

  private static MineTriggerRadius = new MetersValue(5);

  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Terrain, CollisionGroups.WorldObjects],
  );
  private static readonly sensorCollisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Player],
  );
  private static texture: Texture;
  private static textureActive: Texture;
  private static beep: Sound;
  private readonly sensor: Collider;
  private beeping?: Promise<IMediaInstance>;
  private readonly timerText: Text;

  static create(parent: Container, world: GameWorld, position: Coordinate) {
    const ent = new Mine(position, world, parent);
    parent.addChild(ent.sprite, ent.wireframe.renderable);
    return ent;
  }

  private get timerTextValue() {
    return `${((this.timer ?? 0) / (Ticker.targetFPMS * 1000)).toFixed(1)}`;
  }
  public bounceSoundPlayback?: IMediaInstance;

  private constructor(
    position: Coordinate,
    world: GameWorld,
    parent: Container,
  ) {
    const sprite = new Sprite(Mine.texture);
    sprite.scale.set(0.15);
    sprite.anchor.set(0.5);
    const body = world.createRigidBodyCollider(
      ColliderDesc.roundCuboid(0.05, 0.05, 0.5)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(Mine.collisionBitmask)
        .setSolverGroups(Mine.collisionBitmask)
        .setMass(0.5),
      RigidBodyDesc.dynamic().setTranslation(position.worldX, position.worldY),
    );

    sprite.position = body.body.translation();
    super(sprite, body, world, parent, {
      explosionRadius: new MetersValue(4),
      explodeOnContact: false,
      timerSecs: 5,
      autostartTimer: false,
      maxDamage: 40,
    });
    this.sensor = world.rapierWorld.createCollider(
      ColliderDesc.ball(Mine.MineTriggerRadius.value)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(Mine.sensorCollisionBitmask)
        .setSolverGroups(Mine.sensorCollisionBitmask)
        .setSensor(true),
    );
    this.gameWorld.addBody(this, this.sensor);
    this.timerText = new Text({
      text: "",
      style: {
        ...DefaultTextStyle,
        fontSize: 100,
        align: "center",
      },
    });
    sprite.addChild(this.timerText);
  }

  update(dt: number): void {
    super.update(dt);
    if (this.sprite.destroyed) {
      return;
    }

    if (this.timer) {
      this.sprite.texture =
        this.timer % 20 > 10 ? Mine.texture : Mine.textureActive;
    }

    if (!this.timerText.destroyed && this.timer) {
      this.timerText.rotation = -this.physObject.body.rotation();
      this.timerText.text = this.timerTextValue;
    }
    this.sensor.setTranslation(this.physObject.body.translation());
  }

  onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
    if (super.onCollision(otherEnt, contactPoint)) {
      if (this.isSinking) {
        this.timerText.destroy();
        this.beeping?.then((b) => {
          b.stop();
          this.beeping = Promise.resolve(
            Mine.beep.play({ speed: 0.5, volume: 0.25 }),
          );
        });
      }
      return true;
    }
    if (otherEnt instanceof BitmapTerrain || otherEnt === this) {
      // Meh.
      return false;
    }

    if (this.timer === undefined) {
      this.startTimer();
      this.beeping = Promise.resolve(Mine.beep.play({ loop: true }));
    }
    return false;
  }

  recordState() {
    return {
      ...super.recordState(),
      type: EntityType.Mine,
    };
  }

  destroy(): void {
    this.beeping?.then((b) => {
      b.stop();
    });
    super.destroy();
    this.gameWorld.rapierWorld.removeCollider(this.sensor, false);
  }
}
