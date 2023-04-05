import vert from "./gradient.vert?raw";
import frag from "./gradient.frag?raw";
import { Program } from "pixi.js";

 
export default Program.from(vert,frag,'gradient-renderer');