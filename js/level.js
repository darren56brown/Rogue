import { ISO } from "./constants.js";

export class Level {
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
        const level = new Level(levelName);

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
        if (gid <= 0) return null;

        // Find which tileset owns this GID
        let tileset = null;
        for (let i = this.tilesets.length - 1; i >= 0; i--) {
            if (gid >= this.tilesets[i].firstgid) {
                tileset = this.tilesets[i];
                break;
            }
        }
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

    isSolid(x, y, z) {
        if (!this.isLoaded) return false;

        // 1. Snap coordinates to integers for grid/layer lookup
        const gridX = Math.floor(x);
        const gridY = Math.floor(y);
        const gridZ = Math.floor(z); // Or Math.round depending on your jumping logic

        // Boundary check
        if (gridX < 0 || gridX >= this.size.w || gridY < 0 || gridY >= this.size.h) {
            return true; // Treat "out of bounds" as solid/impassable
        }

        // 2. Find the layer(s) matching this snapped z-height
        const layersAtZ = this.layers.filter(l => l.zHeight === gridZ);
        
        for (const layer of layersAtZ) {
            const idx = gridY * this.size.w + gridX;
            const gid = layer.data[idx];

            if (!gid || gid <= 0) continue;

            // 3. Find the tileset
            let tileset = null;
            for (let i = this.tilesets.length - 1; i >= 0; i--) {
                if (gid >= this.tilesets[i].firstgid) {
                    tileset = this.tilesets[i];
                    break;
                }
            }

            if (tileset) {
                const localId = gid - tileset.firstgid;
                if (tileset.solidTiles?.has(localId)) {
                    return true; 
                }
            }
        }

        return false;
    }

}