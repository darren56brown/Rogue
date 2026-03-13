import { APP_SIZE } from "./constants.js";
import { PLAYER_ANIM_FRAME_SIZE, PLAYER_SHEET_DIMS } from "./constants.js";
import { PLAYER_ANIM_FPS } from "./constants.js";

export class Player {
    constructor() {
        this.size = {
            w: PLAYER_ANIM_FRAME_SIZE.w,
            h: PLAYER_ANIM_FRAME_SIZE.h
        }
        this.pos = {
            x: (APP_SIZE.w - this.size.w) / 2,
            y: (APP_SIZE.h - this.size.h) / 2
        }

        this.speed = 25;

        this.curImageRow = 10;
        this.numAnimFrames = 8;
        this.curAnimFrame = 0;
        this.animTimer = 0;

    }
    updatePhysics(dt, keys) {
        let dx = 0, dy = 0;

        if (keys['w'] || keys['arrowup']) {
            dy -= 1;
            this.curImageRow = 8;
        }
        if (keys['s'] || keys['arrowdown']) {
            dy += 1;
            this.curImageRow = 10;
        }
        if (keys['a'] || keys['arrowleft']) {
            dx -= 1;
            this.curImageRow = 9;
        }
        if (keys['d'] || keys['arrowright']) {
            dx += 1;
            this.curImageRow = 11;
        }

        if (dx || dy) {
            if (dx && dy) {
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;
            }

            this.pos.x += dx * this.speed * dt;
            this.pos.y += dy * this.speed * dt;
        }

        this.pos.x = Math.max(0, Math.min(APP_SIZE.w - this.size.w, this.pos.x));
        this.pos.y = Math.max(0, Math.min(APP_SIZE.h - this.size.h, this.pos.y));

        this.animTimer += dt;
        if (this.animTimer > 1 / PLAYER_ANIM_FPS) {
            this.animTimer = 0;
            this.curAnimFrame = (this.curAnimFrame + 1) % this.numAnimFrames;
        }


    }
}