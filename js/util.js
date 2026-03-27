import {ISO} from "./constants.js";
import {vec2D} from './vec2D.js';

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

export function getTileCoordFromXY(worldX, worldY) {
    return vec2D(Math.floor(worldX), Math.floor(worldY));
}

export function getTileCoordFromPosition(pos) {
    return vec2D(Math.floor(pos.x), Math.floor(pos.y));
}

export function isoCompare(xy_sort_1, z_sort_1, xy_sort_2, z_sort_2) {
        return xy_sort_1.x + xy_sort_1.y + z_sort_1 - 
            (xy_sort_2.x + xy_sort_2.y + z_sort_2);
};