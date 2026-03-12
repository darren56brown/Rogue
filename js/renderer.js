import { APP_SIZE, GRID_SIZE } from "./constants.js";

export class Renderer {
    constructor(canvas, imageLibrary) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.imageLibrary = imageLibrary;
    }

    render(player, fpsTracker = null) {
        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_SIZE.w, APP_SIZE.h);
        this.renderGrid();
        this.renderPlayer(player);

        if (fpsTracker) {
            fpsTracker.draw(this.ctx, 20, 20);
        }
    }

    renderPlayer(player){
        const playerImage = this.imageLibrary.get('player');

        if (playerImage){
            this.ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
        } else {
            // fallback
            this.ctx.fillStyle = "#1a1a2e";
            this.ctx.fillRect(player.x, player.y, player.width, player.height);
            this.ctx.strokeStyle = "white";
            this.ctx.strokeRect(player.x, player.y, player.width, player.height);
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