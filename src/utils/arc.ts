
function yIntercept(a: [number, number], b: [number, number]): number {
    // returns the y intercept of the perpendicular bisector of the line from point A to B
    let m = inverseSlope(a, b);
    let p = midpoint(a, b);
    let x = p[0];
    let y = p[1];
    return y - m * x;
  }

function inverseSlope(a: [number, number], b: [number, number]): number {
    // returns the inverse of the slope of the line from point A to B
    // which is the slope of the perpendicular bisector 
    return -1 * (1 / slope(a, b));
}

function slope(a: [number, number], b: [number, number]): number {
    // returns the slope of the line from point A to B
    return (b[1] - a[1]) / (b[0] - a[0]);
}

function getP3(a: [number, number], b: [number, number], frac: number): [number, number] {
    let mid = midpoint(a, b);
    let m = inverseSlope(a, b);
    // check if B is below A
    let bLower = b[1] < a[1] ? -1 : 1;
  
    // distance from midpoint along slope: between 0 and half the distance between the two points
    let d = 0.5 * dist(a, b) * frac;
  
    let x = d / Math.sqrt(1 + Math.pow(m, 2));
    let y = m * x;
    return [bLower * x + mid[0], bLower * y + mid[1]];
    // return [mid[0] + d, mid[1] - (d * (b[0] - a[0])) / (b[1] - a[1])];
}

function dist(a: [number, number], b: [number, number]): number {
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function getCenter(a: [number, number], b: [number, number], frac: number): [number, number] {
    let c = getP3(a, b, frac);
    let b1 = yIntercept(a, b);
    let b2 = yIntercept(a, c);
    let m1 = inverseSlope(a, b);
    let m2 = inverseSlope(a, c);
  
    // find the intersection of the two perpendicular bisectors
    // i.e. solve m1 * x + b2 = m2 * x + b2 for x
    let x = (b2 - b1) / (m1 - m2);
    // sub x back into one of the linear equations to get y
    let y = m1 * x + b1;
  
    return [x, y];
}

export function arcPoints(a: [number, number], b: [number, number], r_frac: number): [number, number][] {
    // a: origin point
    // b: destination point
    // r_frac: arc radius as a fraction of half the distance between a and b
    // -- 1 results in a semicircle arc, the arc flattens out the closer to 0 the number is set, 0 is invalid
    // n: number of points to sample from arc
    
    let invert = a[0] > b[0];
    let c = getCenter(a, b, r_frac);
    let r = dist(c, a);

    const n = Math.round(r / 2);
  
    let aAngle, bAngle = 0;

    if (invert) {
        aAngle = Math.atan2(b[1] - c[1], b[0] - c[0]);
        bAngle = Math.atan2(a[1] - c[1], a[0] - c[0]);
    } else {
        aAngle = Math.atan2(a[1] - c[1], a[0] - c[0]);
        bAngle = Math.atan2(b[1] - c[1], b[0] - c[0]);
    }
  
    if (aAngle > bAngle) {
      bAngle += 2 * Math.PI;
    }

    const increments = (bAngle - aAngle) / n;
    const samples: [number, number][] = Array.from({length: n}).map((_v, index) => aAngle + (increments*index))
      .map((d) => [Math.cos(d) * r + c[0], Math.sin(d) * r + c[1]]);

    if (invert) {
        return samples.reverse();
    }
    return samples;
  }