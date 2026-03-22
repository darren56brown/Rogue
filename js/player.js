import { ISO } from "./constants.js";
import { PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN } from "./constants.js";
import { PLAYER_ANIM_FPS } from "./constants.js";
import { vec, mult, setAdd, setDiv } from './vector.js';
import { cartesianToIso, isoToCartesian } from './util.js';

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
    #pos = {x: 0, y: 0, z: 0};
    constructor(pos) {
        this.size = {
            w: PLAYER_ANIM_FRAME_SIZE.w,
            h: PLAYER_ANIM_FRAME_SIZE.h
        };

        this.origin = {
            x: PLAYER_TILE_ORIGIN.x,
            y: PLAYER_TILE_ORIGIN.y
        };

        this.speed = 30;
        this.falling = true;
        this.fall_speed = .5;

        this.curFacing = PlayerFacing.face_dn;
        this.curWalkFrame = AnimWalkSequence.num_frames;
        this.animTimer = 0;

        this.imageCoord = {row: 0, col:0};

        this.setPosition(pos);
    }

    getPosition() {
        return { x: this.#pos.x, y: this.#pos.y, z: this.#pos.z };
    }

    setPosition(pos) {
        this.#pos = pos;
    }

    moveX(dx) {
        this.#pos.x += dx;
    }
    moveY(dy) {
        this.#pos.y += dy;
    }
    moveZ(dz) {
        this.#pos.z += dz;
    }
    movePosition(delta) {
        setAdd(this.#pos, delta);
    }

    getIsoPosition() {
        return cartesianToIso(this.#pos.x, this.#pos.y, this.#pos.z);
    }

    getShadowIsoPosition() {
        const zOnGround = Math.floor(this.#pos.z);
        return cartesianToIso(this.#pos.x, this.#pos.y, zOnGround);
    }

    updatePhysics(dt, keys, game_map) {
        this.current_map = game_map;

        if (this.falling) {
            const obstruction = this.getObstruction();
            if (obstruction.type == "drop") {
                const fallDistance = this.fall_speed * dt;
                if (fallDistance >= obstruction.dist) {
                    this.moveZ(-obstruction.dist);
                    this.falling = false;
                } else {
                    this.moveZ(-fallDistance);
                }  
            } else {
                this.falling = false;
            }
        }

        let unit_move = vec(0, 0);

        if (keys) {
            if (keys['a'] || keys['arrowleft']) unit_move.x -= 1;
            if (keys['d'] || keys['arrowright']) unit_move.x += 1;
            if (keys['w'] || keys['arrowup']) unit_move.y -= 1;
            if (keys['s'] || keys['arrowdown']) unit_move.y += 1;
        }

        const moving = unit_move.x !== 0 || unit_move.y !== 0;

        if (moving) {
            // If moving diagonally, tweak the vector to match the 2:1 iso slope
            if (unit_move.x !== 0 && unit_move.y !== 0) {
                unit_move.x *= 2.0; 
            }
            const len = Math.hypot(unit_move.x, unit_move.y);
            if (len > 0) setDiv(unit_move, len);

            // Set facing based on screen direction (you can refine later)
            if (Math.abs(unit_move.x) > Math.abs(unit_move.y)) {
                this.curFacing = unit_move.x > 0 ? PlayerFacing.face_rt : PlayerFacing.face_lt;
            } else {
                this.curFacing = unit_move.y > 0 ? PlayerFacing.face_dn : PlayerFacing.face_up;
            }

            const unitDelta = isoToCartesian(unit_move.x, unit_move.y);
            const deltaVec = mult(unitDelta, this.speed * dt);
            this.movePosition(deltaVec);
            const fullMoveObstruction = this.getObstruction();
            if (fullMoveObstruction.type == "drop") {
                this.falling = true;
            } else if (fullMoveObstruction.type != "none") {
                this.movePosition(mult(deltaVec, -1.0));

                const deltaVecMag = Math.hypot(deltaVec.x, deltaVec.y);

                this.moveX(deltaVec.x);
                const xObstruction = this.getObstruction();
                this.moveX(-deltaVec.x);

                this.moveY(deltaVec.y);
                const yObstruction = this.getObstruction();
                this.moveY(-deltaVec.y);

                if (xObstruction.type == "none") {
                    const slow = deltaVecMag / 5;
                    deltaVec.x = Math.sign(deltaVec.x) * slow;
                    deltaVec.y = 0;
                    this.movePosition(deltaVec);
                } else if (yObstruction.type == "none") {
                    const slow = deltaVecMag / 5;
                    deltaVec.x = 0;
                    deltaVec.y = Math.sign(deltaVec.y) * slow;
                    this.movePosition(deltaVec);
                }
            } 

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
    }

    getObstruction()
    {
        const gridX = Math.floor(this.#pos.x);
        const gridY = Math.floor(this.#pos.y);
        return this.current_map.getObstruction(gridX, gridY, this.#pos.z);
    }
}