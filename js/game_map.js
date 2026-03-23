import { ISO } from "./constants.js";

export class GameMap {
    constructor(name) {
        this.name = name;
        this.size = { w: 0, h: 0 };
        this.tileSize = { w: 64, h: 64 };     // will be overwritten by map
        this.tilesets = [];                   // array of tileset metadata
        this.layers = [];                     // ← NEW: will hold visible tile layer objects
        this.isLoaded = false;
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

            // Load all tilesets (your original logic – unchanged)
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

    /**
     * Get tile drawing info for a specific layer at grid position (x,y)
     * @param {number} x - tile column
     * @param {number} y - tile row
     * @param {object} layer - one of the layer objects from this.layers
     */
    getTileInfoForLayer(x, y, layer) {
        if (!this.isLoaded || !layer?.data) return null;

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

    getTileCoordFromXY(worldX, worldY) {
        return { x: Math.floor(worldX), y: Math.floor(worldY) };
    }

    getTileCoordFromPosition(pos) {
        return { x: Math.floor(pos.x), y: Math.floor(pos.y) };
    }

    getDropDistance(xy_pos, z) {
        if (!this.isLoaded) return 0;

        const xy_coord = this.getTileCoordFromPosition(xy_pos);

        if (xy_coord.x < 0 || xy_coord.x >= this.size.w ||
            xy_coord.y < 0 || xy_coord.y >= this.size.h) {
            return 0; //Don't fall off the edge?
        }

        const idx = xy_coord.y * this.size.w + xy_coord.x;
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.zHeight > z) continue;

            const gid = layer.data[idx];
            const tileset = this.getTileSetFromGid(gid);
            if (!tileset) continue;

            const localId = gid - tileset.firstgid;
            //More checks later
            return z - layer.zHeight;
        }

        return Infinity;
    }

    isObstructed(xy_pos, z) {
        if (!this.isLoaded) return 0;

        const xy_coord = this.getTileCoordFromPosition(xy_pos);

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

    findPath(startWorldPos, goalWorldPos, z) {
        const startTile = this.getTileCoordFromPosition(startWorldPos);
        const goalTile  = this.getTileCoordFromPosition(goalWorldPos);

        if (!this.isTileWalkable(startTile.x, startTile.y, z) ||
            !this.isTileWalkable(goalTile.x, goalTile.y, z)) {
            return [];
        }

        if (startTile.x === goalTile.x && startTile.y === goalTile.y) {
            return [startTile];
        }

        const openSet = [];
        const cameFrom = {};
        const gScore = {};
        const fScore = {};
        const nodeKey = n => `${n.x},${n.y}`;

        const startKey = nodeKey(startTile);
        gScore[startKey] = 0;
        fScore[startKey] = this._heuristic(startTile, goalTile);

        openSet.push(startTile);

        while (openSet.length > 0) {
            // Find node with lowest fScore
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

            if (current.x === goalTile.x && current.y === goalTile.y) {
                return this._reconstructPath(cameFrom, current);
            }

            // Remove current from openSet
            openSet.splice(lowestIndex, 1);

            for (const neighbor of this._getNeighbors(current.x, current.y, z)) {
                const neighKey = nodeKey(neighbor);
                const tentativeG = (gScore[currKey] ?? Infinity) + this._getMovementCost(current, neighbor);

                if (tentativeG < (gScore[neighKey] ?? Infinity)) {
                    cameFrom[neighKey] = current;
                    gScore[neighKey] = tentativeG;
                    fScore[neighKey] = tentativeG + this._heuristic(neighbor, goalTile);

                    // Add to openSet if not already present
                    if (!openSet.some(n => nodeKey(n) === neighKey)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return []; // no path found
    }

    _heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    _getMovementCost(fromTile, toTile) {
        const dx = Math.abs(fromTile.x - toTile.x);
        const dy = Math.abs(fromTile.y - toTile.y);
        return (dx + dy === 2) ? 1.414 : 1.0; // diagonal cost slightly higher
    }

    _reconstructPath(cameFrom, current) {
        const path = [current];
        let curr = current;
        while (cameFrom[`${curr.x},${curr.y}`]) {
            curr = cameFrom[`${curr.x},${curr.y}`];
            path.unshift(curr);
        }
        return path;
    }

    _heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan (works great with 8-dir)
    }

    _getNeighbors(tileX, tileY, z) {
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
            const nx = tileX + dx;
            const ny = tileY + dy;
            if (this.isTileWalkable(nx, ny, z)) {
                neighbors.push({ x: nx, y: ny });
                openCardinal.add(`${dx},${dy}`);
            }
        }
        
        for (const [dx, dy] of diagonalDirs) {
            const nx = tileX + dx;
            const ny = tileY + dy;
            const cardinalA = `${dx},0`;
            const cardinalB = `0,${dy}`;

            if (openCardinal.has(cardinalA) && openCardinal.has(cardinalB)) {
                if (this.isTileWalkable(nx, ny, z)) {
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }

        return neighbors;
    }
}