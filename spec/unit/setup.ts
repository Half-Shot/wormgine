import { mkdir } from "node:fs/promises";

export default async function() {
    await mkdir("./test-out", { recursive: true });
};
