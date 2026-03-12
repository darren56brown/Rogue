import { APP_SIZE } from "./constants.js";

export class Player {
    constructor(){
        this.width = 48;
        this.height = 48;

        this.x = (APP_SIZE.w - this.width) / 2;
        this.y = (APP_SIZE.h - this.height) / 2;

        this.speed = 300;

        // Multipliers (for upgrades)
        this.speedMultiplier = 1;
    }
    updatePhysics(dt, keys) {
        let dx = 0, dy = 0;

        if (keys['w'] || keys['arrowup']) dy -= 1;
        if (keys['s'] || keys['arrowdown']) dy += 1;
        if (keys['a'] || keys['arrowleft']) dx -= 1;
        if (keys['d'] || keys['arrowright']) dx += 1;

        if (dx || dy) {
            if (dx && dy) {
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;
            }

            this.x += dx * this.speed * this.speedMultiplier * dt;
            this.y += dy * this.speed * this.speedMultiplier * dt;
        }
        // Keep player in bounds
        this.x = Math.max(0, Math.min(APP_SIZE.w - this.width, this.x));
        this.y = Math.max(0, Math.min(APP_SIZE.h - this.height, this.y));

    }
}