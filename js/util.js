import {ISO} from "./constants.js";
import {vec2D, sub} from './vec2D.js';

export function cartesianToIso(x, y, z) {
    return {
        x: (x - y) * ISO.HALF_W,
        y: (x + y) * ISO.HALF_H - (z * ISO.TILE_Z)
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

export function getTileIndicesFromPosition(pos) {
    return vec2D(Math.floor(pos.x), Math.floor(pos.y));
}

export function isoCompare(world_pos1, world_pos2) {
        return world_pos1.x + world_pos1.y + world_pos1.z - 
            (world_pos2.x + world_pos2.y + world_pos2.z);
};

export function getMixedDist(xy_1, z_1, xy_2, z_2) {
    const xy_error = sub(xy_1, xy_2);
    const z_error = z_1 - z_2;
    return Math.hypot(xy_error.x, xy_error.y, z_error);
};