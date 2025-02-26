import { Point, Rectangle, Texture } from "pixi.js";
import { Vector } from "@dimforge/rapier2d-compat";
import { Coordinate, magnitude, shuffle, sub } from "../utils";
import {
  imageDataToTerrainBoundaries,
  generateQuadsFromTerrain,
  imageDataToAlpha,
} from ".";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import { Scenario } from "../levels/scenarioParser";
import { TeamDefinition, TeamGroup } from "../logic/teams";
import { WormSpawnRecordedState } from "../entities/state/wormSpawn";
import { GameDebugOverlay } from "../overlays/debugOverlay";

interface SpawnerOpts {
  waterLevel: number;
  wormHeightBuffer: number;
  hazardPoints: Vector[];
}

export function determineLocationsToSpawn(
  quads: Rectangle[],
  alpha: ReturnType<typeof imageDataToAlpha>,
  { wormHeightBuffer, waterLevel, hazardPoints }: SpawnerOpts,
): Coordinate[] {
  const columns: Map<number, number[]> = new Map();

  for (const q of quads.filter(
    (quad) => quad.y < waterLevel, // Less than the water level.
  )) {
    // Add some clearance above the ground (-15)
    if (columns.has(q.x)) {
      columns.get(q.x)?.push(q.y - 15);
    } else {
      columns.set(q.x, [q.y - 15]);
    }
  }

  const allowedPoints: Vector[] = [];
  for (const [x, yvalues] of columns.entries()) {
    let yValue: number;
    while ((yValue = yvalues.pop()!)) {
      // Ignore if worm doesn't fit.
      if (yvalues.some((otherY) => yValue - otherY <= wormHeightBuffer)) {
        continue;
      }
      if (
        allowedPoints.some(
          (s) => Math.abs(magnitude(sub({ x, y: yValue }, s))) <= 80,
        )
      ) {
        // Ignore if position is too close to previous above.
        continue;
      }
      if (
        hazardPoints.some(
          (hazard) => Math.abs(magnitude(sub({ x, y: yValue }, hazard))) <= 30,
        )
      ) {
        // Ignore if position is too close to a hazard.
        continue;
      }
      if (alpha.get(yValue)?.get(x)) {
        // Point is inside terrain.
        continue;
      }
      // Check for ground clerance.
      const leftSide = new Rectangle(x - 120, yValue, 40, 30);
      if (!quads.some((q) => q.intersects(leftSide))) {
        continue;
      }
      const rightSide = new Rectangle(x + 120, yValue, 40, 30);
      if (!quads.some((q) => q.intersects(rightSide))) {
        continue;
      }

      allowedPoints.push({ x, y: yValue });
    }
  }

  return allowedPoints.map((v) => Coordinate.fromScreen(v.x, v.y));
}

export function getSpawnPoints(
  bitmap: Texture,
  objects: Scenario["objects"],
  teams: TeamDefinition[],
): WormSpawnRecordedState[] {
  const waterHeight = objects.find((o) => o.type === "wormgine.water")?.tra.y;
  if (!waterHeight) {
    throw Error("Map contains no water height marker");
  }
  const tmpCanvas = BitmapTerrain.drawToCanvas(bitmap);
  const context = tmpCanvas.getContext("2d")!;
  const imgData = context.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);

  const alphas = imageDataToAlpha(0, 0, imgData);
  const { boundaries } = imageDataToTerrainBoundaries(alphas, imgData);
  tmpCanvas.remove();
  // Turn it into a quadtree of rects
  const quadtreeRects = generateQuadsFromTerrain(
    boundaries,
    tmpCanvas.width,
    tmpCanvas.height,
    0,
    0,
  );
  const allSpawns = shuffle(
    determineLocationsToSpawn(quadtreeRects, alphas, {
      wormHeightBuffer: 40,
      waterLevel: waterHeight,
      hazardPoints: objects
        .filter((o) => o.type === "wormgine.mine")
        .map((o) => o.tra),
    }),
  );

  GameDebugOverlay.registerDebugData("spawns", "0x666600").push(
    ...allSpawns.map((c) => new Point(c.screenX, c.screenY)),
  );

  const spawns: { uuid: string; group: TeamGroup; x: number; y: number }[] = [];
  for (const worm of teams.flatMap((t) =>
    t.worms.map((w) => ({ ...w, group: t.group })),
  )) {
    if (!worm.uuid) {
      throw Error("Worm must have a uuid");
    }
    const nextSpawn = allSpawns.find(
      (nextSpawn) =>
        spawns.some(
          (existingSpawn) =>
            magnitude(sub(nextSpawn.toWorldVector(), existingSpawn)) < 5,
        ) === false,
    );
    if (!nextSpawn) {
      console.log(spawns, nextSpawn);
      throw Error("No place to spawn worm");
    }
    spawns.push({
      uuid: worm.uuid,
      group: worm.group,
      x: nextSpawn.worldX,
      y: nextSpawn.worldY,
    });
  }

  return spawns.map(
    (w) =>
      new WormSpawnRecordedState({
        type: "wormgine.worm_spawn",
        x: w.x,
        y: w.y,
        properties: {
          "wormgine.worm_uuid": w.uuid,
        },
      }),
  );
}
