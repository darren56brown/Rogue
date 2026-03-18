import { ISO } from "./constants.js";
import { PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN } from "./constants.js";
import { PLAYER_ANIM_FPS } from "./constants.js";
import { vec, add, sub, mult, setAdd } from './vector.js';
import { isoToCartesian } from './util.js';

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
  [PlayerFacing.face_up, 0],
  [PlayerFacing.face_lt, 2],
  [PlayerFacing.face_dn, 0],
  [PlayerFacing.face_rt, 6]
]);

export class Player {
    constructor(pos) {
        this.size = {
            w: PLAYER_ANIM_FRAME_SIZE.w,
            h: PLAYER_ANIM_FRAME_SIZE.h
        };
        this.pos = pos;
        this.origin = {
            x: PLAYER_TILE_ORIGIN.x,
            y: PLAYER_TILE_ORIGIN.y
        };

        this.speed = 25;

        this.curFacing = PlayerFacing.face_dn;
        this.curWalkFrame = AnimWalkSequence.num_frames;
        this.animTimer = 0;

        this.imageCoord = {row: 0, col:0};
    }

    updatePhysics(dt, keys, game_map) {
        let screen_dx = 0;
        let screen_dy = 0;

        if (keys['a'] || keys['arrowleft'])  screen_dx -= 1;
        if (keys['d'] || keys['arrowright']) screen_dx += 1;
        if (keys['w'] || keys['arrowup'])    screen_dy -= 1;
        if (keys['s'] || keys['arrowdown'])  screen_dy += 1;

        const moving = screen_dx !== 0 || screen_dy !== 0;

        if (moving) {
            // Normalize screen movement (consistent speed in any direction)
            const len = Math.hypot(screen_dx, screen_dy);
            if (len > 0) {
                screen_dx /= len;
                screen_dy /= len;
            }

            // Set facing based on screen direction (you can refine later)
            if (Math.abs(screen_dx) > Math.abs(screen_dy)) {
                this.curFacing = screen_dx > 0 ? PlayerFacing.face_rt : PlayerFacing.face_lt;
            } else {
                this.curFacing = screen_dy > 0 ? PlayerFacing.face_dn : PlayerFacing.face_up;
            }

            const world_delta = isoToCartesian(screen_dx, screen_dy);
            setAdd(this.pos, mult(world_delta, this.speed * dt));

            // Was not moving, go to first animation frame
            if (this.curWalkFrame === AnimWalkSequence.num_frames) {
                this.curWalkFrame = AnimWalkSequence.neutral_1;
                this.animTimer = 0;
            }
        } else {
            // No longer moving but don't stop animating unless on neutral frame
            if (this.curWalkFrame === AnimWalkSequence.neutral_1 ||
                this.curWalkFrame === AnimWalkSequence.neutral_2) {
                this.curWalkFrame = AnimWalkSequence.num_frames;
                this.animTimer = 0;
            }
        }

        this.imageCoord.row = PlayerImageRow.get(this.curFacing);

        if (this.curWalkFrame !== AnimWalkSequence.num_frames) {
            this.animTimer += dt;
            if (this.animTimer > 1 / PLAYER_ANIM_FPS) {
                this.animTimer = 0;
                this.curWalkFrame = (this.curWalkFrame + 1) % AnimWalkSequence.num_frames;
            }
            const colOffset = AnimWalkSequenceOffset.get(this.curFacing);
            //One of the sequence of 8 walking images
            this.imageCoord.col = 1 + (this.curWalkFrame + colOffset) % 8;
        } else {
            //Standing image
            this.imageCoord.col = 0;
        }

        //console.log(this.pos);
        if (game_map.isSolid(this.pos.x, this.pos.y, this.pos.z)) {
            console.log("is solid");
            this.imageCoord.row = 15;
            this.imageCoord.col = 0;
        }


    }
}