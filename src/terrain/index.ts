import { Vector2 } from "@dimforge/rapier2d-compat";
import { Rectangle } from "pixi.js";

export function imageDataToAlpha(
  boundaryX: number,
  boundaryY: number,
  imgData: ImageData,
): Map<number, Map<number, number>> {
  const data: Map<number, Map<number, number>> = new Map();
  const lengthOfOneRow = imgData.width * 4;
  for (let i = 0; i < imgData.data.length; i += 4) {
    const x = (i % lengthOfOneRow) / 4;
    const y = Math.ceil(i / lengthOfOneRow);
    const realX = x + boundaryX;
    const realY = y + boundaryY;
    const [, , , a] = imgData.data.slice(i, i + 4);
    if (!data.has(realY)) {
      data.set(realY, new Map());
    }
    data.get(realY)?.set(realX, a);
  }
  return data;
}

export function imageDataToTerrainBoundaries(
  alphas: ReturnType<typeof imageDataToAlpha>,
  imgData: ImageData,
): { boundaries: Vector2[]; boundingBox: Rectangle } {
  const boundingBox = new Rectangle(
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    0,
    0,
  );
  const boundaries: Array<Vector2> = [];
  const xBoundaryTracker = new Array(imgData.width);
  const yBoundaryTracker = new Array(imgData.height);

  for (const [y, xValues] of alphas.entries()) {
    for (const [x, a] of xValues.entries()) {
      if (a > 5) {
        if (!xBoundaryTracker[x] || !yBoundaryTracker[y]) {
          // This is to stop us from drawing straight lines down
          // when we have a boundary, but I don't know why this works.
          if (x > 1 && y > 1) {
            boundaries.push(new Vector2(x, y));
          }
          xBoundaryTracker[x] = true;
          yBoundaryTracker[y] = true;

          boundingBox.x = Math.min(boundingBox.x, x);
          boundingBox.y = Math.min(boundingBox.y, y);
          boundingBox.width = Math.max(boundingBox.width, x);
          boundingBox.height = Math.max(boundingBox.height, y);
        }
      } else if (a === 0) {
        if (xBoundaryTracker[x] || yBoundaryTracker[y]) {
          boundaries.push(new Vector2(x, y));
          xBoundaryTracker[x] = false;
          yBoundaryTracker[y] = false;
        }
      }
    }
  }
  boundingBox.width -= boundingBox.x;
  boundingBox.height -= boundingBox.y;
  return {
    boundaries,
    boundingBox,
  };
}

export const QuadtreeCutoff = 4;

export function generateQuadsFromTerrain(
  boundaries: Vector2[],
  width: number,
  height: number,
  x: number,
  y: number,
): Rectangle[] {
  function inner(
    boundaries: Vector2[],
    width: number,
    height: number,
    x: number,
    y: number,
  ): Rectangle[] | Rectangle {
    // For performance, we just quad anything that's too small.
    if (width < QuadtreeCutoff || height < QuadtreeCutoff) {
      return new Rectangle(x, y, width, height);
    }

    // Are there any points within this quad?
    const interestedBoundaries = boundaries.filter(
      (v) => v.x >= x && v.x < x + width && v.y >= y && v.y < y + height,
    );

    // No? Turn it into a quad and stop recursing.
    if (interestedBoundaries.length === 0) {
      return new Rectangle(x, y, width, height);
    }

    // Split the quad into 4
    const newWidth = Math.round(width / 2);
    const newHeight = Math.round(height / 2);

    const rects: Rectangle[] = [];
    for (const opts of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ]) {
      const newX = x + (opts[0] ? newWidth : 0);
      const newY = y + (opts[1] ? newHeight : 0);
      const newRects = inner(
        interestedBoundaries,
        newWidth,
        newHeight,
        newX,
        newY,
      );
      // For each inner quad, delete any that contain none of the terrain.
      if (Array.isArray(newRects)) {
        rects.push(...newRects);
      } else if (boundaries.some((s) => newRects.contains(s.x, s.y))) {
        rects.push(newRects);
      }
    }
    return rects;
  }
  const result = inner(boundaries, width, height, x, y);
  return Array.isArray(result) ? result : [result];
}
