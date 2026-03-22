import { ISO } from "./constants.js";
import { PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN } from "./constants.js";
import { PLAYER_ANIM_FPS, MOVE_TARGET_TOL2 } from "./constants.js";
import { vec, sub, mult, setAdd, setDiv, magSq } from './vector.js';
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

export class Character {
    #pos = {x: 0, y: 0, z: 0};
    #y_sort = 0;
    #z_sort = 0;

    constructor(pos) {
        this.size = {
            w: PLAYER_ANIM_FRAME_SIZE.w,
            h: PLAYER_ANIM_FRAME_SIZE.h
        };

        this.origin = {
            x: PLAYER_TILE_ORIGIN.x,
            y: PLAYER_TILE_ORIGIN.y
        };

        this.speed = .35;
        this.falling = true;
        this.fall_speed = .5;

        this.curFacing = PlayerFacing.face_dn;
        this.curWalkFrame = AnimWalkSequence.num_frames;
        this.animTimer = 0;

        this.imageCoord = {row: 0, col:0};

        this.setPosition(pos);

        this.targetPos = null;
    }

    getPosition() {
        return { x: this.#pos.x, y: this.#pos.y, z: this.#pos.z };
    }

    setPosition(pos) {
        this.#pos = pos;
        this.#computeSortInfo();
    }
    moveX(dx) {
        this.#pos.x += dx;
        this.#computeSortInfo();
    }
    moveY(dy) {
        this.#pos.y += dy;
        this.#computeSortInfo();
    }
    moveZ(dz) {
        this.#pos.z += dz;
        this.#computeSortInfo();
    }
    movePosition(delta) {
        setAdd(this.#pos, delta);
        this.#computeSortInfo();
    }

    #computeSortInfo() {
        const y_sort_point = this.getIsoPosition();
        this.#y_sort = y_sort_point.y;
        this.#z_sort = this.#pos.z + 0.5; //character center is up in z
    }

    compareToOther(other) {
        return this.compareToSortInfo(other.#y_sort, other.#z_sort);
    };

    compareToSortInfo(y_sort, z_sort) {
        //If we are close to one layer apart, sort by z
        if (Math.abs(this.#z_sort - z_sort) > 0.99) {
            return this.#z_sort - z_sort;
        }
        return this.#y_sort - y_sort;
    };

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

        let world_move_vec = vec(0, 0);
        let world_move_mag = 0;
        let iso_move_vec =  vec(0, 0);
        
        const hasKeyboardInput = keys && (
            keys['a'] || keys['arrowleft'] ||
            keys['d'] || keys['arrowright'] ||
            keys['w'] || keys['arrowup'] ||
            keys['s'] || keys['arrowdown']
        );

        if (hasKeyboardInput) {
            this.clearWalkTarget();

            if (keys['a'] || keys['arrowleft']) iso_move_vec.x -= 1;
            if (keys['d'] || keys['arrowright']) iso_move_vec.x += 1;
            if (keys['w'] || keys['arrowup']) iso_move_vec.y -= 1;
            if (keys['s'] || keys['arrowdown']) iso_move_vec.y += 1;

            //Diagonal presses are world moves but
            //single presses are iso screen moves.
            if (iso_move_vec.x !== 0 && iso_move_vec.y !== 0) {
                if (iso_move_vec.x > 0 && iso_move_vec.y > 0) {
                    world_move_vec = vec(1, 0);
                } else if (iso_move_vec.x > 0 && iso_move_vec.y < 0) {
                    world_move_vec = vec(0, -1);
                } else if (iso_move_vec.x < 0 && iso_move_vec.y > 0) {
                    world_move_vec = vec(0, 1);
                } else if (iso_move_vec.x < 0 && iso_move_vec.y < 0) {
                    world_move_vec = vec(-1, 0);
                }
            } else {
                world_move_vec = isoToCartesian(iso_move_vec.x, iso_move_vec.y);
            }
        } 
        else if (this.targetPos) {
            const worldDistSq = magSq(vec(this.targetPos.x - this.#pos.x,
                this.targetPos.y - this.#pos.y));
            if (worldDistSq < MOVE_TARGET_TOL2) {
                this.clearWalkTarget();
            } else {
                world_move_vec = sub(this.targetPos, vec(this.#pos.x, this.#pos.y));
            }
        }

        world_move_mag = Math.hypot(world_move_vec.x, world_move_vec.y);
        if (world_move_mag > 0) {
            setDiv(world_move_vec, world_move_mag);
            world_move_mag = 1;
        }
        iso_move_vec = cartesianToIso(world_move_vec.x, world_move_vec.y, 0);

        if (world_move_mag > 0) {
            // Set facing based on screen direction
            if (Math.abs(iso_move_vec.x) > Math.abs(iso_move_vec.y)) {
                this.curFacing = iso_move_vec.x > 0 ? PlayerFacing.face_rt : PlayerFacing.face_lt;
            } else {
                this.curFacing = iso_move_vec.y > 0 ? PlayerFacing.face_dn : PlayerFacing.face_up;
            }

            const deltaVec = mult(world_move_vec, this.speed * dt);
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

    setWalkTarget(worldPos) {
        this.targetPos = { x: worldPos.x, y: worldPos.y };
    }

    clearWalkTarget() {
        this.targetPos = null;
    }
}