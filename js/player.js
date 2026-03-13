import { APP_SIZE } from "./constants.js";
import { PLAYER_ANIM_FRAME_SIZE, PLAYER_SHEET_DIMS } from "./constants.js";
import { PLAYER_ANIM_FPS } from "./constants.js";

const AnimWalkSequence = Object.freeze({
    neutral_1: 0,
    left_half_1: 1,
    left_forward: 2,
    left_half_2: 3,
    neutral_2: 4,
    right_half_1: 5,
    right_forward : 6,
    right_half_2: 7,
    num_frames: 8
});

const PlayerFacing = Object.freeze({
    face_up: 0,
    face_lt: 1,
    face_dn: 2,
    face_rt: 3
});

const PlayerImageRow = new Map([
  [PlayerFacing.face_up, 8],
  [PlayerFacing.face_lt, 9],
  [PlayerFacing.face_dn, 10],
  [PlayerFacing.face_rt, 11]
]);

const AnimWalkSequenceOffset = new Map([
  [PlayerFacing.face_up, 1],
  [PlayerFacing.face_lt, 3],
  [PlayerFacing.face_dn, 1],
  [PlayerFacing.face_rt, 7]
]);

export class Player {
    constructor() {
        this.size = {
            w: PLAYER_ANIM_FRAME_SIZE.w,
            h: PLAYER_ANIM_FRAME_SIZE.h
        };
        this.pos = {
            x: (APP_SIZE.w - this.size.w) / 2,
            y: (APP_SIZE.h - this.size.h) / 2
        };

        this.speed = 25;

        this.curFacing = PlayerFacing.face_dn;
        this.curWalkFrame = AnimWalkSequence.num_frames;
        this.animTimer = 0;

        this.imageCoord = {row: 0, col:0};
    }

    updatePhysics(dt, keys) {
        let dx = 0, dy = 0;

        if (keys['w'] || keys['arrowup']) {
            dy -= 1;
            this.curFacing = PlayerFacing.face_up;
        }
        if (keys['s'] || keys['arrowdown']) {
            dy += 1;
            this.curFacing = PlayerFacing.face_dn;
        }
        if (keys['a'] || keys['arrowleft']) {
            dx -= 1;
            this.curFacing = PlayerFacing.face_lt;
        }
        if (keys['d'] || keys['arrowright']) {
            dx += 1;
            this.curFacing = PlayerFacing.face_rt;
        }

        if (dx || dy) {
            //Moving
            if (this.curWalkFrame == AnimWalkSequence.num_frames) {
                //Transition to animating
                this.curWalkFrame = AnimWalkSequence.neutral_1;
                this.animTimer = 0;
            }

            if (dx && dy) {
                const len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;
            }

            this.pos.x += dx * this.speed * dt;
            this.pos.y += dy * this.speed * dt;

            //this.pos.x = Math.max(0, Math.min(APP_SIZE.w - this.size.w, this.pos.x));
            //this.pos.y = Math.max(0, Math.min(APP_SIZE.h - this.size.h, this.pos.y));
        } else {
            //Not moving
            if (this.curWalkFrame == AnimWalkSequence.neutral_1 ||
                this.curWalkFrame == AnimWalkSequence.neutral_2) {
                //Transition to not animating
                this.curWalkFrame = AnimWalkSequence.num_frames;
                this.animTimer = 0;
            }
        }

        this.imageCoord.row = PlayerImageRow.get(this.curFacing);

        if (this.curWalkFrame == AnimWalkSequence.num_frames) {
            this.imageCoord.col = 0;
        } else {
            this.animTimer += dt;
            if (this.animTimer > 1 / PLAYER_ANIM_FPS) {
                this.animTimer = 0;
                this.curWalkFrame = (this.curWalkFrame + 1) %
                    AnimWalkSequence.num_frames;
            }

            let colOffset = AnimWalkSequenceOffset.get(this.curFacing);
            this.imageCoord.col = (this.curWalkFrame + colOffset) % 9;
        }
    }
}