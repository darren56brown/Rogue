
export class Level {
    constructor(name) {
        this.name = name;
        this.size = { w: 0, h: 0 };
        this.tileSize = { w: 64, h: 64};
        this.tilesets = [];           // { firstgid, name, imageName, columns, tilecount, imagewidth, ... }
        this.mapData = [];            // 2D array [y][x] with raw GIDs
        this.isLoaded = false;
    }

    static async load(levelName) {
        const basePath = 'tilemaps/';
        const level = new Level(levelName);

        try {
            const mapFilename = `${levelName}.tmj`;
            const mapPath = `${basePath}${mapFilename}`;

            //console.log(`Fetching map from: ${mapPath}`);

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

            // 2. Load all tilesets
            for (const ts of mapData.tilesets) {
                let source = ts.source;  // e.g. "water.tsx" or "../tilesets/dirt_to_water.tsx"

                // Extract just the filename part
                const filename = source.split('/').pop();                     // "water.tsx"
                const baseName = filename.replace(/\.[^.]+$/, "");            // "water"
                
                // Force .tsj extension (change to .json if your files are named that way)
                const tsFilename = `${baseName}.tsj`;
                
                // Build path — assuming tilesets/ folder next to levels/
                const tsPath = `tilesets/${tsFilename}`;

                //console.log(`Attempting to load tileset: ${tsPath} (original source was ${source})`);

                const tsResponse = await fetch(tsPath);
                if (!tsResponse.ok) {
                    throw new Error(`Failed to load tileset: ${tsPath} (status ${tsResponse.status})`);
                }
                const tilesetJson = await tsResponse.json();

                // Extract image name more robustly
                let imageName = tilesetJson.image
                    .split(/[\\/]/)           // handles both / and \
                    .pop()
                    .replace(/\.[^.]+$/, ""); // remove extension

                level.tilesets.push({
                    firstgid:    ts.firstgid,
                    name:        tilesetJson.name,
                    imageName:   imageName,
                    columns:     tilesetJson.columns,
                    tilecount:   tilesetJson.tilecount,
                    tilewidth:   tilesetJson.tilewidth,
                    tileheight:  tilesetJson.tileheight,
                    imagewidth:  tilesetJson.imagewidth,
                    imageheight: tilesetJson.imageheight
                });
            }

            // Sort tilesets by firstgid (good practice, though usually already ordered)
            level.tilesets.sort((a, b) => a.firstgid - b.firstgid);

            // 3. Get the main tile layer (assuming first visible tilelayer)
            const layer = mapData.layers.find(l => l.type === "tilelayer" && l.visible !== false);
            if (!layer) throw new Error("No visible tile layer found");

            // Convert 1D data → 2D array
            level.mapData = [];
            for (let y = 0; y < level.size.h; y++) {
                const start = y * level.size.w;
                level.mapData[y] = layer.data.slice(start, start + level.size.w);
            }

            level.isLoaded = true;
            //console.log(`Level "${levelName}" loaded — ${level.tilesets.length} tilesets`);
            return level;

        } catch (err) {
            console.error("Level load failed:", err);
            throw err;
        }
    }

    getTileInfo(x, y) {
        if (!this.isLoaded || y < 0 || y >= this.size.h || x < 0 || x >= this.size.w) {
            return null;
        }

        let gid = this.mapData[y][x];
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

        const localId = gid - tileset.firstgid;           // 0-based index in this tileset
        const col = localId % tileset.columns;
        const row = Math.floor(localId / tileset.columns);

        return {
            imageName: tileset.imageName,   // key to look up in ImageLibrary
            sx: col * tileset.tilewidth,
            sy: row * tileset.tileheight,
            sw: tileset.tilewidth,
            sh: tileset.tileheight
        };
    }
}