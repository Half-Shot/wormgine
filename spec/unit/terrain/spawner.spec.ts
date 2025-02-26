import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { determineLocationsToSpawn } from "../../../src/terrain/spawner";
import { imageDataToTerrainBoundaries, imageDataToAlpha, generateQuadsFromTerrain } from "../../../src/terrain/index";
import { Canvas, createCanvas, loadImage } from "@napi-rs/canvas";
import { renderTest } from "../../test-utils/graphics-test";
import { Coordinate } from "../../../src/utils";

const img = loadImage('./src/assets/levels/testingGround.png');

async function getImgData() {
  const terrainImg = await img;
  const canvas = createCanvas(terrainImg.width + 10, terrainImg.height + 10);
  const context = canvas.getContext("2d")
  context.drawImage(terrainImg, 10, 10);
  return { imgData: context.getImageData(0, 0, terrainImg.width, terrainImg.height), canvas };
}

describe('determineLocationsToSpawn', () => {
  let imgData: ImageData;
  let canvas: Canvas;
  let points: Coordinate[];
  beforeEach(async () => {
    const res = await getImgData();
    imgData = res.imgData;
    canvas = res.canvas;
    points = [];
  });

  afterEach(async () => {
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'red';
    ctx.fillStyle = 'red';
    ctx.lineWidth = 2;
    for (const point of points) {
      ctx.beginPath();
      ctx.moveTo(0, 600);
      ctx.lineTo(canvas.width, 600);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.screenX, point.screenY, 3, 0, 2 * Math.PI)
      ctx.fill();
    }
    await renderTest(canvas);
  });

  test('it does not choose a position near the water line', async () => {
    const waterLevel = 600;
    const alphas = imageDataToAlpha(0, 0, imgData);
    const quads = generateQuadsFromTerrain(imageDataToTerrainBoundaries(alphas, imgData).boundaries, imgData.width, imgData.height, 0, 0);
    const alpha = imageDataToAlpha(0, 0, imgData);
    points = determineLocationsToSpawn(quads, alpha, { waterLevel, wormHeightBuffer: 30, hazardPoints: [] });
    expect(points.every(p => p.worldY < waterLevel))
  })

  test('positioning is sane', async () => {
    const alphas = imageDataToAlpha(0, 0, imgData);
    const quads = generateQuadsFromTerrain(imageDataToTerrainBoundaries(alphas, imgData).boundaries, imgData.width, imgData.height, 0, 0);
    const alpha = imageDataToAlpha(0, 0, imgData);
    points = determineLocationsToSpawn(quads, alpha, { waterLevel: 600, wormHeightBuffer: 30, hazardPoints: [] });
    expect(points).toMatchSnapshot();
  });
});
