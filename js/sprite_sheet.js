import {vec2D} from './vec2D.js';
import {PLAYER_ANIM_FPS} from "./constants.js";

const facingToDir = {
    0: "Up", 1: "Right", 2: "Right", 3: "Right",
    4: "Down", 5: "Left", 6: "Left", 7: "Left"
};

export class SpriteSheet {
    constructor(image) {
        this.image = image;
        this.spriteSize = vec2D(64, 64);
        this.frameRate = PLAYER_ANIM_FPS;

        this.animations = [
            { action: "Cast",   direction: "Up",    hasIdle: true,  numColumns: 7, row: 0 },
            { action: "Cast",   direction: "Left",  hasIdle: true,  numColumns: 7, row: 1 },
            { action: "Cast",   direction: "Down",  hasIdle: true,  numColumns: 7, row: 2 },
            { action: "Cast",   direction: "Right", hasIdle: true,  numColumns: 7, row: 3 },

            { action: "Thrust",   direction: "Up",    hasIdle: true,  numColumns: 8, row: 4 },
            { action: "Thrust",   direction: "Left",  hasIdle: true,  numColumns: 8, row: 5 },
            { action: "Thrust",   direction: "Down",  hasIdle: true,  numColumns: 8, row: 6 },
            { action: "Thrust",   direction: "Right", hasIdle: true,  numColumns: 8, row: 7 },

            { action: "Walk",   direction: "Up",    hasIdle: true,  numColumns: 9, row: 8 },
            { action: "Walk",   direction: "Left",  hasIdle: true,  numColumns: 9, row: 9 },
            { action: "Walk",   direction: "Down",  hasIdle: true,  numColumns: 9, row: 10 },
            { action: "Walk",   direction: "Right", hasIdle: true,  numColumns: 9, row: 11 },

            { action: "Slash",   direction: "Up",    hasIdle: true,  numColumns: 6, row: 12 },
            { action: "Slash",   direction: "Left",  hasIdle: true,  numColumns: 6, row: 13 },
            { action: "Slash",   direction: "Down",  hasIdle: true,  numColumns: 6, row: 14 },
            { action: "Slash",   direction: "Right", hasIdle: true,  numColumns: 6, row: 15 },

            { action: "Shoot",   direction: "Up",    hasIdle: true,  numColumns: 13, row: 16 },
            { action: "Shoot",   direction: "Left",  hasIdle: true,  numColumns: 13, row: 17 },
            { action: "Shoot",   direction: "Down",  hasIdle: true,  numColumns: 13, row: 18 },
            { action: "Shoot",   direction: "Right", hasIdle: true,  numColumns: 13, row: 19 },

            { action: "Die",   direction: "Down", hasIdle: false,  numColumns: 6, row: 20 },
            { action: "Climb",   direction: "Up", hasIdle: false,  numColumns: 6, row: 21 },

            { action: "Stand",   direction: "Up",    hasIdle: false,  numColumns: 2, row: 22 },
            { action: "Stand",   direction: "Left",  hasIdle: false,  numColumns: 2, row: 23 },
            { action: "Stand",   direction: "Down",  hasIdle: false,  numColumns: 2, row: 24 },
            { action: "Stand",   direction: "Right", hasIdle: false,  numColumns: 2, row: 25 },

            { action: "Jump",   direction: "Up",    hasIdle: false,  numColumns: 5, row: 26 },
            { action: "Jump",   direction: "Left",  hasIdle: false,  numColumns: 5, row: 27 },
            { action: "Jump",   direction: "Down",  hasIdle: false,  numColumns: 5, row: 28 },
            { action: "Jump",   direction: "Right", hasIdle: false,  numColumns: 5, row: 29 }
        ];

        const actionSet = new Set();
        this.uniqueActions = [];
        for (const anim of this.animations) {
            if (!actionSet.has(anim.action)) {
                actionSet.add(anim.action);
                this.uniqueActions.push(anim.action);
            }
        }

        // Default state
        this.currentActionIndex = this.uniqueActions.indexOf("Walk") ?? 0;
        this.currentDirection = "Right";
        this.isIdle = true;
        this.currentFrame = 0;
        this.accumTime = 0;
    }

    // ====================== STATE ======================
    getCurrentAnimation() {
        const action = this.uniqueActions[this.currentActionIndex];
        let match = this.animations.find(a =>
            a.action === action &&
            (a.direction === this.currentDirection || a.direction === null)
        );
        return match || this.animations[0];
    }

    getCurrentAction() {
        return this.uniqueActions[this.currentActionIndex];
    }

    setDirection(dir) {
        this.currentDirection = dir;
        this.currentFrame = 0;
    }

    setAction(actionName) {
        const idx = this.uniqueActions.indexOf(actionName);
        if (idx == -1 || idx == this.currentActionIndex) return;

        this.currentActionIndex = idx;
        this.isIdle = false;
        this.currentFrame = 0;
    }

    setCharacterFacing(facing) {
        this.currentDirection = facingToDir[facing];
    }

    changeAction(dir) {
        this.currentActionIndex = (this.currentActionIndex + dir + this.uniqueActions.length) % this.uniqueActions.length;
        this.currentFrame = 0;
        this.isIdle = false;
    }

    setIsIdle(state) {
        const current = this.getCurrentAnimation();
        if (!current.hasIdle) return;
        if (this.isIdle == state) return;
        this.isIdle = state;
        this.currentFrame = 0;
    }

    update(dt) {
        if (!dt) return;

        const frameIntervalSec = 1 / this.frameRate;
        this.accumTime += dt;

        while (this.accumTime >= frameIntervalSec) {
            const anim = this.getCurrentAnimation();

            let numFrames;
            if (this.isIdle && anim.hasIdle) {
                numFrames = 1;
            } else if (anim.hasIdle) {
                numFrames = anim.numColumns - 1;   // columns 1 → end
            } else {
                numFrames = anim.numColumns;       // full row
            }

            this.currentFrame = (this.currentFrame + 1) % Math.max(1, numFrames);
            this.accumTime -= frameIntervalSec;
        }
    }

    getCurrentImageCoord() {
        const anim = this.getCurrentAnimation();
        let col;
        if (this.isIdle && anim.hasIdle) {
            col = 0;
        } else if (anim.hasIdle) {
            col = 1 + this.currentFrame;
        } else {
            col = this.currentFrame;
        }
        return { row: anim.row, col };
    }

    draw(ctx, destX, destY, destW, destH) {
        const coord = this.getCurrentImageCoord();
        const sx = coord.col * this.spriteSize.x;
        const sy = coord.row * this.spriteSize.y;
        ctx.drawImage(this.image, sx, sy, this.spriteSize.x, this.spriteSize.y, destX, destY, destW, destH);
    }
}