import { Rectangle } from "pixi.js";
import { Vector } from "@dimforge/rapier2d-compat";
import { Coordinate, magnitude, sub } from "../utils";

interface SpawnerOpts {
    waterLevel: number;
    wormHeightBuffer: number;
    hazardPoints: Vector[];
}

export function determineLocationsToSpawn(quads: Rectangle[], {wormHeightBuffer, waterLevel, hazardPoints}: SpawnerOpts): Coordinate[] {
    const filteredQuads = quads.filter(quad => 
        quad.y < waterLevel, // Less tahn the water level.
    );
    const columns: Map<number, number[]> = new Map();

    for (const quads of filteredQuads) {
        // Add some clearance above the ground (-15)
        if (columns.has(quads.x)) {
            columns.get(quads.x)?.push(quads.y - 15);
        } else {
            columns.set(quads.x, [quads.y - 15]);
        }
    }

    const allowedPoints: Vector[] = [];
    let lastValue: Vector = {x: Infinity, y: Infinity};
    // Skip edges
    for (const [x, yvalues] of [...columns.entries()].slice(0)) {
        let yValue: number;
        while (yValue = yvalues.pop()!) {
            // Ignore if worm doesn't fit.
            if (yvalues.some(otherY => yValue-otherY <= wormHeightBuffer)) {
                continue;
            }
            if (allowedPoints.some(s => Math.abs(magnitude(sub({x, y: yValue}, s))) <= 80)) {
                // Ignore if position is too close to previous above.
                continue;
            }
            if (hazardPoints.some(hazard => Math.abs(magnitude(sub({x, y: yValue}, hazard))) <= 30)) {
                // Ignore if position is too close to previous above.
                continue;
            }
            lastValue = {x, y: yValue}
            allowedPoints.push(lastValue);
        }
    }

    return allowedPoints.map(v => Coordinate.fromScreen(v.x, v.y));
}