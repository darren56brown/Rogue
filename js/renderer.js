import { APP_SIZE, GRID_SIZE } from "./constants.js";

export class Renderer {
    constructor(canvas, imageLibrary) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.imageLibrary = imageLibrary;
    }

    render(cameraPos, player, level, fpsTracker = null) {
        //this.ctx.fillStyle = "#829e71";
        //this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);
        //this.renderGrid();
        this.renderLevel(cameraPos, level);
        this.renderPlayer(player);

        if (fpsTracker) {
            fpsTracker.render(this.ctx, 20, 20);
        }
    }

    renderLevel(cameraPos, level) {
        if (!level) return;
        if (!level.isLoaded) return;

        const tileSize = level.tileSize;

        for (let y = 0; y < level.size.h; y++) {
            const dy = y * tileSize.h - cameraPos.y;

            if (dy <= -tileSize.h || dy >= this.ctx.canvas.height) continue;

            for (let x = 0; x < level.size.w; x++) {
                const dx = x * tileSize.w - cameraPos.x;
                
                if (dx <= -tileSize.w || dx >= this.ctx.canvas.width) continue;

                const info = level.getTileInfo(x, y);
                if (!info) continue;

                const img = this.imageLibrary.get(info.imageName);
                if (!img) continue;  // image not loaded yet

                this.ctx.drawImage(
                    img,
                    info.sx, info.sy, info.sw, info.sh,   // source rect
                    dx, dy, tileSize.w, tileSize.h            // dest rect
                );
            }
        }
    }

    renderPlayer(player) {

        let ulx = player.pos.x - player.origin.x;
        let uly = player.pos.y - player.origin.y;

        const player_shadow = this.imageLibrary.get('player_shadow');
        if (player_shadow) {
            this.ctx.drawImage(player_shadow,
                0, 0, 64, 32,
                ulx, uly + 42,
                64, 32);
        }

        const player_base = this.imageLibrary.get('player_base');
        if (player_base) {
            this.ctx.drawImage(player_base,
                player.size.w * player.imageCoord.col,
                player.size.h * player.imageCoord.row,
                player.size.w, player.size.h,
                ulx, uly,
                player.size.w, player.size.h);
        }
    }

    renderGrid() {
        this.ctx.strokeStyle = "yellow";
        this.ctx.lineWidth = 1;

        for (let x = 0; x < APP_SIZE.w; x += GRID_SIZE.w) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, APP_SIZE.h);
            this.ctx.stroke();
        }

        for (let y = 0; y < APP_SIZE.h; y += GRID_SIZE.h) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(APP_SIZE.w, y);
            this.ctx.stroke();
        }

    }
}