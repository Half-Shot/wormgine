import vertex from "./gradient.vert?raw";
import fragment from "./gradient.frag?raw";
import { GlProgram } from "pixi.js";

export default GlProgram.from({
  vertex,
  fragment,
  name: "rain",
});
