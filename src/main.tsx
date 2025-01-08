import { render } from "preact";
import "./index.css";
import { App } from "./frontend/components/app";
import { loadAssets } from "./assets";
import "core-js/actual/typed-array/from-base64"

void loadAssets();

render(<App />, document.getElementById("app") as HTMLElement);
