import { APP_WIDTH, APP_HEIGHT, GRID_SIZE } from "../core/constants.js";

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
    }

    render() {
        this.ctx.fillStyle = "#829e71";
        this.ctx.fillRect(0, 0, APP_WIDTH, APP_HEIGHT);
        this.renderGrid();
    }

    renderGrid() {
        this.ctx.strokeStyle = "yellow";
        this.ctx.lineWidth = 1;

        for (let i = 0; i < APP_WIDTH; i += GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, APP_HEIGHT);
            this.ctx.stroke();
        }

        for (let j = 0; j < APP_HEIGHT; j += GRID_SIZE) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, j);
            this.ctx.lineTo(APP_WIDTH, j);
            this.ctx.stroke();
        }

    }
}