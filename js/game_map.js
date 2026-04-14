import {ISO, MAX_DROP, MAX_HOP} from "./constants.js";
import { getTileIndicesFromPosition, isoCompare} from './util.js';
import { vec2D } from "./vec2D.js";
import { Npc } from "./npc.js";
import { GameItemDef } from "./game_item.js";

export class GameMap {
    constructor(name) {
        this.name = name;
        this.size = { w: 0, h: 0 };
        this.tileSize = { w: 0, h: 0 };
        this.tilesets = [];
        this.layers = [];
        this.isLoaded = false;
        this.drawList = [];

        this.displayName = name;
        this.playerStart = {x: 0, y: 0, z: 0};
        this.npcs = [];
        this.portals = [];
    }

    async loadAll(image_library, item_library) {
        try {
            const tmjPath  = `maps/${this.name}/map.tmj`;
            const metadataPath = `maps/${this.name}/map.json`;

             const [tmjResponse, metaResponse] = await Promise.all([
                fetch(tmjPath),
                fetch(metadataPath)
            ]);

            if (!tmjResponse.ok || !metaResponse.ok) {
                throw new Error(`Failed to load map files for ${this.name}`);
            }

            const [mapData, metadata] = await Promise.all([
                tmjResponse.json(),
                metaResponse.json()
            ]);

            if (metadata.itemDefs && Array.isArray(metadata.itemDefs)) {
                for (const data of metadata.itemDefs) {
                    try {
                        const def = new GameItemDef(data);
                        item_library.set(def.id, def);
                    } catch (e) {
                        console.error(`Failed to register itemDef ${data.id || 'unknown'}`, e);
                    }
                }
            }

            this.displayName = metadata.displayName;
            this.playerStart = metadata.playerStart;
            this.portals = metadata.portals || [];

            this.npcs = [];
            for (const npc_data of metadata.npcs) {
                const startingPos = {x: npc_data.x, y: npc_data.y, z: npc_data.z};
                const npc = new Npc(startingPos, image_library, item_library,
                    this.name, npc_data.name);

                await npc.load();
                this.npcs.push(npc);
            }

            this.size.w = mapData.width;
            this.size.h = mapData.height;
            this.tileSize.w = mapData.tilewidth;
            this.tileSize.h = mapData.tileheight;

            for (const ts of mapData.tilesets) {
                const tsPath = `maps/tilesets/${ts.source}`;
                const tsResponse = await fetch(tsPath);
                if (!tsResponse.ok) {
                    throw new Error(`Failed to load tileset: ` +
                        `${tsPath} (status ${tsResponse.status})`);
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

                this.tilesets.push({
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
            this.tilesets.sort((a, b) => a.firstgid - b.firstgid);

            this.layers = mapData.layers
                .filter(l => l.type === "tilelayer" && l.visible !== false)
                .map(raw => {
                    const offsetX = raw.offsetx !== undefined ? raw.offsetx : 0;
                    console.assert(offsetX === 0, "Error: offsetX should be zero, but found:", offsetX);
                    const offsetY = raw.offsety !== undefined ? raw.offsety : 0;
                    const zHeight = Math.round(-offsetY / ISO.TILE_Z);

                    return {
                        name: raw.name,
                        data: raw.data,
                        opacity: raw.opacity !== undefined ? raw.opacity : 1,
                        zHeight
                    };
                })
                .sort((a, b) => a.zHeight - b.zHeight);   // lowest → highest (back to front)

            if (this.layers.length === 0) {
                throw new Error("No visible tile layers found in map");
            }

            this.isLoaded = true;
            //console.log(`Level "${levelName}" loaded — ${this.tilesets.length} ` +
            //    `tilesets, ${this.layers.length} visible layers`);

            this.drawList = [];
            for (const layer of this.layers) {
                for (let x = 0; x < this.size.w; x++) {
                    for (let y = 0; y < this.size.h; y++) {
                        const info = this.getTileInfoForLayer(x, y, layer);
                        if (!info) continue;
                        this.drawList.push({x: x, y: y, layer: layer});
                    }
                }
            }
            this.drawList.sort((a, b) => isoCompare(
                {x: a.x + 0.5, y: a.y + 0.5, z: a.layer.zHeight - 0.5},
                {x: b.x + 0.5, y: b.y + 0.5, z: b.layer.zHeight - 0.5}
            ));
        } catch (err) {
            console.error("Level load failed:", err);
            throw err;
        }
    }

    getPortalAt(world_position) {
        if (this.portals.length == 0) return null;

        const tileX = Math.floor(world_position.x);
        const tileY = Math.floor(world_position.y);
        const tileZ = Math.floor(world_position.z);

        for (const portal of this.portals) {
            if (portal.tileX == tileX &&
                portal.tileY === tileY &&
                portal.tileZ === tileZ) {
                return portal;
            }
        }
        return null;
    }

    getVisibleTileLayers() {
        if (!this.isLoaded) return [];
        return this.layers; // already sorted by zHeight
    }

    getTileInfoForLayer(x, y, layer) {
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

    getDropDistance(tile_indices) {
        if (!this.isLoaded) return 0;

        if (tile_indices.x < 0 || tile_indices.x >= this.size.w ||
            tile_indices.y < 0 || tile_indices.y >= this.size.h) {
            return 0;
        }

        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            if (layer.zHeight > tile_indices.z) continue;

            const tileInfo =
                this.getTileInfoForLayer(tile_indices.x, tile_indices.y, layer);
            if (!tileInfo) continue;

            return tile_indices.z - layer.zHeight;
        }

        return Infinity;
    }

    getHopDistance(tile_indices) {
        if (!this.isLoaded) return 0;

        if (tile_indices.x < 0 || tile_indices.x >= this.size.w ||
            tile_indices.y < 0 || tile_indices.y >= this.size.h) {
            return 0;
        }

        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (layer.zHeight <= tile_indices.z) continue;

            const tileInfo =
                this.getTileInfoForLayer(tile_indices.x, tile_indices.y, layer);
            if (!tileInfo) continue;

            let obstructed_above = false;
            for (let j = i + 1; j < this.layers.length; j++) {
                const layer_above = this.layers[i + 1];
                const height_gap = layer_above.zHeight - layer.zHeight;
                if (height_gap < 0.1) continue; 
                if (height_gap > 1.9) break;

                const tileInfoAbove =
                    this.getTileInfoForLayer(tile_indices.x, tile_indices.y, layer_above);
                if (tileInfoAbove) {
                    obstructed_above = true;
                    break;
                }
            }

            if (!obstructed_above) return layer.zHeight - tile_indices.z;
        }

        return Infinity;
    }

    isTileObstructed(tile_indices) {
        if (!this.isLoaded) return true;

        if (tile_indices.x < 0 || tile_indices.x >= this.size.w ||
            tile_indices.y < 0 || tile_indices.y >= this.size.h) {
            return true;
        }

        const zToFind = tile_indices.z + 1.0;

        const idx = tile_indices.y * this.size.w + tile_indices.x;
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

    isPositionObstructed(world_pos) {
        const tile_indices_xy = getTileIndicesFromPosition(vec2D(world_pos.x, world_pos.y));
        const tile_index_z = Math.floor(world_pos.z);
        const tile_indices = {x: tile_indices_xy.x, y: tile_indices_xy.y, z: tile_index_z};
        return this.isTileObstructed(tile_indices);
    }

    findPath(start_world_pos, goal_world_pos) {
        if (this.isPositionObstructed(start_world_pos) ||
            this.isPositionObstructed(goal_world_pos)) {
            return [];
        }

        const startTile = {
            x: Math.floor(start_world_pos.x),
            y: Math.floor(start_world_pos.y),
            z: Math.round(start_world_pos.z)
        };
        const goalTile = {
            x: Math.floor(goal_world_pos.x),
            y: Math.floor(goal_world_pos.y),
            z: Math.round(goal_world_pos.z)
        };
        
        if (startTile.x == goalTile.x &&
            startTile.y == goalTile.y &&
            startTile.z == goalTile.z) {
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
        const openCardinal = new Set();

        const cardinalDirs = [
            vec2D(0, 1), vec2D(1, 0),
            vec2D(0, -1), vec2D(-1, 0)
        ]; 
        for (const cardinalDir of cardinalDirs) {
            const neighbor_idx = {
                x: tile_coord.x + cardinalDir.x,
                y: tile_coord.y + cardinalDir.y,
                z: tile_coord.z
            }
            if (neighbor_idx.x < 0 || neighbor_idx.x >= this.size.w ||
                neighbor_idx.y < 0 || neighbor_idx.y >= this.size.h) continue;

            if (this.isTileObstructed(neighbor_idx)) {
                const hop = this.getHopDistance(neighbor_idx);
                if (hop <= MAX_HOP) {
                    neighbors.push({
                        x: neighbor_idx.x,
                        y: neighbor_idx.y,
                        z: tile_coord.z + hop
                    });
                }    
            } else {
                const drop = this.getDropDistance(neighbor_idx);
                if (drop < 0.1) openCardinal.add(`${cardinalDir.x},${cardinalDir.y}`);

                if (drop <= MAX_DROP) {
                    neighbors.push({
                        x: neighbor_idx.x,
                        y: neighbor_idx.y,
                        z: tile_coord.z - drop
                    });
                }     
            }
        }

        const diagonalDirs = [
            vec2D(1, 1), vec2D(1, -1),
            vec2D(-1, 1), vec2D(-1, -1)
        ];
        for (const diagonalDir of diagonalDirs) {
            const neighbor_idx = {
                x: tile_coord.x + diagonalDir.x,
                y: tile_coord.y + diagonalDir.y,
                z: tile_coord.z
            }
            if (neighbor_idx.x < 0 || neighbor_idx.x >= this.size.w ||
                neighbor_idx.y < 0 || neighbor_idx.y >= this.size.h) continue;

            const cardinalA = `${diagonalDir.x},0`;
            const cardinalB = `0,${diagonalDir.y}`;

            if (openCardinal.has(cardinalA) && openCardinal.has(cardinalB)) {
                if (!this.isTileObstructed(neighbor_idx)) {
                    neighbors.push({
                        x: neighbor_idx.x,
                        y: neighbor_idx.y,
                        z: neighbor_idx.z
                    });
                }
            }
        }

        return neighbors;
    }
}