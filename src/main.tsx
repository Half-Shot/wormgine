// Ensure we load the video early.
import "./frontend/components/atoms/loading";
import { render } from "preact";
import "./index.css";
import { loadAssets } from "./assets";
import { useEffect, useState } from "preact/hooks";
import { Preloader } from "./frontend/components/preloader";
import type { App as AppType } from "./frontend/components/app";



function Main() {
    const [AppImport, setApp] = useState<{ App: typeof AppType }>();
    useEffect(() => {
        void loadAssets();
        // TODO: Error state.
        import("./frontend/components/app").then((_app) => setApp(_app));
    }, []);

    return <>
        <Preloader />
        {AppImport ? <AppImport.App /> : null}
    </>;
}

render(<Main />, document.getElementById("app") as HTMLElement);
