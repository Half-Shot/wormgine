import { describe, test } from "@jest/globals";
import { determineLocationsToSpawn } from "../../../src/terrain/spawner";
import { imageDataToTerrainBoundaries, imageDataToAlpha, generateQuadsFromTerrain } from "../../../src/terrain/index";
import { createCanvas, loadImage } from "@napi-rs/canvas";


async function getImgData() {
  const terrainImg = await loadImage('./src/assets/levels/testingGround.png');
  const canvas = createCanvas(terrainImg.width + 10, terrainImg.height + 10);
  const context = canvas.getContext("2d")
  context.drawImage(terrainImg, 10, 10);
  return context.getImageData(0, 0, terrainImg.width,terrainImg.height);
}

describe('determineLocationsToSpawn', () => {
    test('gets some positions', async () => {
        const imgData = await getImgData();
        const quads = generateQuadsFromTerrain(imageDataToTerrainBoundaries(0,0, imgData).boundaries, imgData.width, imgData.height, 0, 0);
        const alpha = imageDataToAlpha(0,0, imgData);
        const points = determineLocationsToSpawn(quads, alpha, { waterLevel: 900, wormHeightBuffer: 30, hazardPoints: [] });
        console.log(points.slice(0,10));
    });
});
