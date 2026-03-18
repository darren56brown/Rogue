import { ISO } from "./constants.js";

export function cartesianToIso(x, y, z) {
    return {
        x: (x - y) * ISO.HALF_W,
        y: (x + y) * ISO.HALF_H - (z * ISO.TILE_H)
    };
}

export function isoToCartesian(x, y) {
    return {
        x: (x / ISO.HALF_W + y / ISO.HALF_H) / 2,
        y: (-x / ISO.HALF_W + y / ISO.HALF_H) / 2
    };
}