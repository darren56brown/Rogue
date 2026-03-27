import {ISO, MAX_DROP, MAX_HOP} from "./constants.js";
import { getTileCoordFromPosition, isoCompare} from './util.js';
import { vec2D } from "./vec2D.js";

export class GameMap {
    constructor(name) {
        this.name = name;
        this.size = { w: 0, h: 0 };
        this.tileSize = { w: 0, h: 0 };
        this.tilesets = [];
        this.layers = [];
        this.isLoaded = false;
        this.drawList = [];
    }

    static async load(levelName) {
        const basePath = 'tilemaps/';
        const level = new GameMap(levelName);

        try {
            const mapFilename = `${levelName}.tmj`;
            const mapPath = `${basePath}${mapFilename}`;

            const mapResponse = await fetch(mapPath);
            if (!mapResponse.ok) {
                throw new Error(`Map fetch failed: ${mapPath} → ${mapResponse.status} ${mapResponse.statusText}`);
            }
            const mapData = await mapResponse.json();

            // Basic map properties
            level.size.w = mapData.width;
            level.size.h = mapData.height;
            level.tileSize.w = mapData.tilewidth;
            level.tileSize.h = mapData.tileheight;

            for (const ts of mapData.tilesets) {
                let source = ts.source;

                const filename = source.split('/').pop();
                const baseName = filename.replace(/\.[^.]+$/, "");
                const tsFilename = `${baseName}.tsj`;
                const tsPath = `tilesets/${tsFilename}`;

                const tsResponse = await fetch(tsPath);
                if (!tsResponse.ok) {
                    throw new Error(`Failed to load tileset: ${tsPath} (status ${tsResponse.status})`);
                }
                const tilesetJson = await tsResponse.json();

                const solidTiles = new Set();
                if (tilesetJson.tiles) {
                    tilesetJson.tiles.forEach(t => {
                        const isSolid = t.properties?.find(p => p.name === "solid" &&
                            p.value === true);
                        if (isSolid) solidTiles.add(t.id);
                    });
                }

                let imageName = tilesetJson.image
                    .split(/[\\/]/)
                    .pop()
                    .replace(/\.[^.]+$/, "");

                level.tilesets.push({
                    firstgid:    ts.firstgid,
                    name:        tilesetJson.name,
                    imageName:   imageName,
                    columns:     tilesetJson.columns,
                    tilecount:   tilesetJson.tilecount,
                    tilewidth:   tilesetJson.tilewidth,
                    tileheight:  tilesetJson.tileheight,
                    imagewidth:  tilesetJson.imagewidth,
                    imageheight: tilesetJson.imageheight,
                    solidTiles:  solidTiles
                });
            }
            level.tilesets.sort((a, b) => a.firstgid - b.firstgid);

            level.layers = mapData.layers
                .filter(l => l.type === "tilelayer" && l.visible !== false)
                .map(raw => {
                    const offsetX = raw.offsetx !== undefined ? raw.offsetx : 0;
                    console.assert(offsetX === 0, "Error: offsetX should be zero, but found:", offsetX);
                    const offsetY = raw.offsety !== undefined ? raw.offsety : 0;
                    const zHeight = Math.round(-offsetY / ISO.TILE_H);

                    return {
                        name: raw.name,
                        data: raw.data,
                        opacity: raw.opacity !== undefined ? raw.opacity : 1,
                        zHeight
                    };
                })
                .sort((a, b) => a.zHeight - b.zHeight);   // lowest → highest (back to front)

            if (level.layers.length === 0) {
                throw new Error("No visible tile layers found in map");
            }

            level.isLoaded = true;
            //console.log(`Level "${levelName}" loaded — ${level.tilesets.length} tilesets, ${level.layers.length} visible layers`);

            level.drawList = [];
            for (const layer of level.layers) {
                for (let x = 0; x < level.size.w; x++) {
                    for (let y = 0; y < level.size.h; y++) {
                        const info = level.getTileInfoForLayer(x, y, layer);
                        if (!info) continue;
                        level.drawList.push({x: x, y: y, layer: layer});
                    }
                }
            }
            level.drawList.sort((a, b) => isoCompare(
                vec2D(a.x + 0.5, a.y + 0.5), a.layer.zHeight - 0.5,
                vec2D(b.x + 0.5, b.y + 0.5), b.layer.zHeight - 0.5
            ));

            return level;

        } catch (err) {
            console.error("Level load failed:", err);
            throw err;
        }
    }

    getVisibleTileLayers() {
        if (!this.isLoaded) return [];
        return this.layers; // already sorted by zHeight
    }

    getTileInfoForLayer(x, y, layer) {
        if (!this.isLoaded || !layer?.data) return null;

        if (x < 0 || x >= this.size.w ||
            y < 0 || y >= this.size.h) return null;

        const idx = y * this.size.w + x;
        if (idx < 0 || idx >= layer.data.length) return null;

        const gid = layer.data[idx];
        return this.getTileInfo(gid);
    }

    getTileInfo(gid) {
        const tileset = this.getTileSetFromGid(gid);
        if (!tileset) return null;

        const localId = gid - tileset.firstgid;
        const col = localId % tileset.columns;
        const row = Math.floor(localId / tileset.columns);

        return {
            imageName: tileset.imageName,
            sx: col * tileset.tilewidth,
            sy: row * tileset.tileheight,
            sw: tileset.tilewidth,
            sh: tileset.tileheight
        };
    }

    getTileSetFromGid(gid) {
        if (!gid || gid <= 0) return null;
        for (let i = this.tilesets.length - 1; i >= 0; i--) {
            if (gid >= this.tilesets[i].firstgid) return this.tilesets[i];
        }
        return null;
    }

    getDropDistance(xy_pos, z) {
        if (!this.isLoaded) return 0;

        const xy_coord = getTileCoordFromPosition(xy_pos);
        if (xy_coord.x < 0 || xy_coord.x >= this.size.w ||
            xy_coord.y < 0 || xy_coord.y >= this.size.h) {
            return 0;
        }

        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.zHeight > z) continue;

            const tileInfo =
                this.getTileInfoForLayer(xy_coord.x, xy_coord.y, layer);
            if (!tileInfo) continue;

            return z - layer.zHeight;
        }

        return Infinity;
    }

    getHopDistance(xy_pos, z) {
        if (!this.isLoaded) return 0;

        const xy_coord = getTileCoordFromPosition(xy_pos);
        if (xy_coord.x < 0 || xy_coord.x >= this.size.w ||
            xy_coord.y < 0 || xy_coord.y >= this.size.h) {
            return 0;
        }

        for (const layer of this.layers) {
            if (layer.zHeight <= z) continue;

            const tileInfo =
                this.getTileInfoForLayer(xy_coord.x, xy_coord.y, layer);
            if (!tileInfo) continue;

            return layer.zHeight - z;
        }

        return Infinity;
    }

    isObstructed(xy_pos, z) {
        if (!this.isLoaded) return 0;

        const xy_coord = getTileCoordFromPosition(xy_pos);

        if (xy_coord.x < 0 || xy_coord.x >= this.size.w ||
            xy_coord.y < 0 || xy_coord.y >= this.size.h) {
            return 0; //Don't fall off the edge?
        }

        const zToFind = Math.floor(z + 1.0);

        const idx = xy_coord.y * this.size.w + xy_coord.x;
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.zHeight != zToFind) continue;
            const gid = layer.data[idx];
            const tileset = this.getTileSetFromGid(gid);
            if (!tileset) continue;

            const localId = gid - tileset.firstgid;
            //More checks later
            return true;
        }

        return false;
    }

    isTileWalkable(tileX, tileY, z) {
        if (tileX < 0 || tileX >= this.size.w || tileY < 0 || tileY >= this.size.h) return false;
        const testPos = { x: tileX + 0.5, y: tileY + 0.5 };
        return !this.isObstructed(testPos, z);
    }

    findPath(startWorldPos, startZ, goalWorldPos, goalZ) {
        const startTile = { ...getTileCoordFromPosition(startWorldPos), z: Math.round(startZ) };
        const goalTile  = { ...getTileCoordFromPosition(goalWorldPos), z: Math.round(goalZ) };

        if (!this.isTileWalkable(startTile.x, startTile.y, startTile.z) ||
            !this.isTileWalkable(goalTile.x, goalTile.y, goalTile.z)) {
            return [];
        }

        if (startTile.x === goalTile.x && startTile.y === goalTile.y && startTile.z === goalTile.z) {
            return [startTile];
        }

        const openSet = [];
        const cameFrom = {};
        const gScore = {};
        const fScore = {};
        const nodeKey = n => `${n.x},${n.y},${n.z}`;

        const startKey = nodeKey(startTile);
        gScore[startKey] = 0;
        fScore[startKey] = this._manhattan(startTile, goalTile);

        openSet.push(startTile);

        while (openSet.length > 0) {
            let lowestIndex = 0;
            for (let i = 1; i < openSet.length; i++) {
                const keyA = nodeKey(openSet[lowestIndex]);
                const keyB = nodeKey(openSet[i]);
                if ((fScore[keyB] ?? Infinity) < (fScore[keyA] ?? Infinity)) {
                    lowestIndex = i;
                }
            }

            const current = openSet[lowestIndex];
            const currKey = nodeKey(current);

            if (current.x === goalTile.x &&
                current.y === goalTile.y &&
                current.z === goalTile.z) {
                return this._reconstructPath(cameFrom, current);
            }

            openSet.splice(lowestIndex, 1);

            for (const neighbor of this._getNeighbors3D(current)) {
                const neighKey = nodeKey(neighbor);
                const tentativeG = (gScore[currKey] ?? Infinity) +
                    this._getMovementCost(current, neighbor);

                if (tentativeG < (gScore[neighKey] ?? Infinity)) {
                    cameFrom[neighKey] = current;
                    gScore[neighKey] = tentativeG;
                    fScore[neighKey] = tentativeG + this._manhattan(neighbor, goalTile);

                    if (!openSet.some(n => nodeKey(n) === neighKey)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        return [];
    }

    _manhattan(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) * 0.5;
    }

    _getMovementCost(from, to) {
        const dx = Math.abs(from.x - to.x);
        const dy = Math.abs(from.y - to.y);
        let cost = (dx + dy === 2) ? 1.414 : 1.0;

        // Discourage level changes — prefer ramps / staying on same layer
        if (from.z !== to.z) {
            cost += 3.0;
        }

        return cost;
    }

    _reconstructPath(cameFrom, current) {
        const path = [current];
        let curr = current;
        while (cameFrom[`${curr.x},${curr.y},${curr.z}`]) {
            curr = cameFrom[`${curr.x},${curr.y},${curr.z}`];
            path.unshift(curr);
        }
        return path;
    }

    _getNeighbors3D(tile_coord) {
        const neighbors = [];
        const cardinalDirs = [
            [ 0,  1], [ 1,  0],
            [ 0, -1], [-1,  0]
        ];
        const diagonalDirs = [
            [ 1,  1], [ 1, -1],
            [-1,  1], [-1, -1]
        ];

        const openCardinal = new Set();
        for (const [dx, dy] of cardinalDirs) {
            const nx = tile_coord.x + dx;
            const ny = tile_coord.y + dy;
            if (nx < 0 || nx >= this.size.w || ny < 0 || ny >= this.size.h) continue;
            const neighCenter = { x: nx + 0.5, y: ny + 0.5 };

            if (this.isTileWalkable(nx, ny, tile_coord.z)) {
                const drop = this.getDropDistance(neighCenter, tile_coord.z);
                if (drop < 0.1) openCardinal.add(`${dx},${dy}`);

                if (drop <= MAX_DROP) {
                    const landingZ = tile_coord.z - drop;
                    neighbors.push({ x: nx, y: ny, z: landingZ });
                }
            } else {
                const hop = this.getHopDistance(neighCenter, tile_coord.z);
                if (hop <= MAX_DROP) {
                    const landingZ = tile_coord.z + hop;
                    neighbors.push({ x: nx, y: ny, z: landingZ });
                }
            }

        }

        for (const [dx, dy] of diagonalDirs) {
            const nx = tile_coord.x + dx;
            const ny = tile_coord.y + dy;
            if (nx < 0 || nx >= this.size.w || ny < 0 || ny >= this.size.h) continue;

            const cardinalA = `${dx},0`;
            const cardinalB = `0,${dy}`;

            if (openCardinal.has(cardinalA) && openCardinal.has(cardinalB)) {
                if (this.isTileWalkable(nx, ny, tile_coord.z)) {
                    neighbors.push({ x: nx, y: ny, z: tile_coord.z });
                }
            }
        }

        return neighbors;
    }
}