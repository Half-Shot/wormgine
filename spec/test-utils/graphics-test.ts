import { expect } from "@jest/globals";
import { Canvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function renderTest(canvas: Canvas) {
    const { currentTestName } = expect.getState();
    const testName = currentTestName?.replaceAll(/\s/g, '_') ?? "unknown";
    const filename = resolve(`./test-out/${testName}.webp`);
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.font = "12pt monospace";
    context.fillText(testName, 10, 20);
    const buffer = await canvas.encode("webp", 100);
    const ui32 = new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Uint32Array.BYTES_PER_ELEMENT);
    await writeFile(filename, ui32);
    return filename;
}
