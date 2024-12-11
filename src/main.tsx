import { render } from "preact";
import "./index.css";
import { App } from "./components/app";

render(<App />, document.getElementById("app") as HTMLElement);
