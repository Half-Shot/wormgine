import { Svg, Vector, Vertices } from "matter-js";


const select = function(root: Document, selector: string) {
    return Array.prototype.slice.call(root.querySelectorAll(selector));
};

export async function loadSvg(url: string, sampleLength = 50, scaleX = 1, scaleY = 1, point: Vector) {
    const document = await fetch(url)
        .then(function(response) { return response.text(); })
        .then(function(raw) { return (new DOMParser()).parseFromString(raw, 'image/svg+xml'); });
    return select(document, 'path#collision').map(path => 
        Vertices.scale(Svg.pathToVertices(path, sampleLength), scaleX, scaleY, point)
    )
};
