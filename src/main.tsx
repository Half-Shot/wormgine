import { render } from "preact";
import "./index.css";
import { App } from "./components/app";
import { loadAssets } from "./assets";

void loadAssets();

render(<App />, document.getElementById("app") as HTMLElement);
