import {PLAYER_ANIM_FRAME_SIZE, PLAYER_TILE_ORIGIN, MOVE_TARGET_TOL} from "./constants.js";
import {vec2D, add, sub, mult, setAdd, norm, div, intersect, dist, mag, dot} from './vec2D.js';
import {cartesianToIso, getMixedDist, getTileCoordFromXY, isoCompare} from './util.js';
import {SpriteSheet} from './sprite_sheet.js';
import {GameItemInst} from "./game_item.js";

export const PlayerFacing = Object.freeze({
    face_nw: 0,   // North-West
    face_n:  1,   // North
    face_ne: 2,   // North-East
    face_e:  3,   // East
    face_se: 4,   // South-East
    face_s:  5,   // South
    face_sw: 6,   // South-West
    face_w:  7    // West
});

export const FACING_VECTORS = new Map([
    [PlayerFacing.face_e,  vec2D(1,     0)],
    [PlayerFacing.face_se, vec2D(0.7071, 0.7071)],
    [PlayerFacing.face_s,  vec2D(0,     1)],
    [PlayerFacing.face_sw, vec2D(-0.7071, 0.7071)],
    [PlayerFacing.face_w,  vec2D(-1,    0)],
    [PlayerFacing.face_nw, vec2D(-0.7071, -0.7071)],
    [PlayerFacing.face_n,  vec2D(0,    -1)],
    [PlayerFacing.face_ne, vec2D(0.7071, -0.7071)]
]);

export class Character {
    #pos_xy = {x: 0, y: 0};
    #z = 0;

    constructor(world_pos, display_name, item_library) {
        this.display_name = display_name;
        this.item_library = item_library;
        
        this.sprite_image_name = null;
        this.spriteSheet = null;

        this.size = { w: PLAYER_ANIM_FRAME_SIZE.w, h: PLAYER_ANIM_FRAME_SIZE.h };
        this.origin = { x: PLAYER_TILE_ORIGIN.x, y: PLAYER_TILE_ORIGIN.y };

        this.speed = .7;
        this.fall_speed = 1.5;
        this.curFacing = 4; // face_se

        this.imageCoord = {row: 0, col: 0};

        this.waypoints = [];
        this.currentWaypointIndex = 0;

        this.follow_target = null;
        this.follow_success = false;
        this.follow_cache = null;

        this.inventorySlots = Array.from({ length: 40 }, () => (null));
        this.equipment = {
            head: null,
            neck: null,
            chest: null,
            legs: null,
            feet: null,
            hand_1: null,
            hand_2: null,
            trinket_1: null,
            trinket_2: null
        };

        this.gold = 100;

        this.setPositionXY(vec2D(world_pos.x, world_pos.y));
        this.setZ(world_pos.z);
    }

    resetDisplayName(display_name) {
        this.display_name = display_name;
    }

    initializeSprite(image_library, sprite_image_name) {
        if (!sprite_image_name) {
            throw new Error("Cannot initialize sprite without sprite_image_name");
        }

        this.sprite_image_name = sprite_image_name;

        const sprite_image = image_library.get(sprite_image_name);
        if (!sprite_image) {
            throw new Error(`Sprite image "${sprite_image_name}" not found in ImageLibrary`);
        }

        this.spriteSheet = new SpriteSheet(sprite_image);
        //console.log(`✅ SpriteSheet initialized for ${sprite_image_name}`);
    }

    isWalking() {
        return this.waypoints.length > 0;
    }

    getZ() {
        return this.#z;
    }

    getPositionXY() {
        return { x: this.#pos_xy.x, y: this.#pos_xy.y };
    }

    setPositionXY(pos) {
        this.#pos_xy.x = pos.x;
        this.#pos_xy.y = pos.y;
    }

    setZ(z) {
        this.#z = z;
    }
    
    moveX(dx) {
        this.#pos_xy.x += dx;
    }

    moveY(dy) {
        this.#pos_xy.y += dy;
    }

    moveZ(dz) {
        this.#z += dz;
    }

    moveXYZ(dx, dy, dz) {
        this.#pos_xy.x += dx;
        this.#pos_xy.y += dy;
        this.#z += dz;
    }

    movePosition(delta) {
        setAdd(this.#pos_xy, delta);
    }

    compareToOther(other) {
        return this.compareToSortInfo(other.#pos_xy, other.#z + 0.5);
    }

    compareToSortInfo(xy_sort, z_sort) {
        return isoCompare(this.#pos_xy, this.#z + 0.5, xy_sort, z_sort);
    }

    getIsoPosition() {
        return cartesianToIso(this.#pos_xy.x, this.#pos_xy.y, this.#z);
    }

    getShadowIsoPosition() {
        const zOnGround = Math.floor(this.#z);
        return cartesianToIso(this.#pos_xy.x, this.#pos_xy.y, zOnGround);
    }

    updatePhysics(dt, game_map) {
        if (!this.spriteSheet || !game_map) return;

        if (this.follow_target) this._updateFollow(game_map);

        let world_move_vec = {x: 0, y: 0, z: 0};
        let world_move_mag = 0;

        if (this.currentWaypointIndex < this.waypoints.length) {
            const target_xyz = this.waypoints[this.currentWaypointIndex];
            world_move_vec = {
                x: target_xyz.x - this.#pos_xy.x,
                y: target_xyz.y - this.#pos_xy.y,
                z: target_xyz.z - this.#z
            };
            world_move_mag = Math.sqrt(
                world_move_vec.x * world_move_vec.x +
                world_move_vec.y * world_move_vec.y +
                world_move_vec.z * world_move_vec.z
            );

            if (world_move_mag < MOVE_TARGET_TOL) {
                world_move_vec = {x: 0, y: 0, z: 0};
                world_move_mag = 0;
                this.currentWaypointIndex++;
                if (this.currentWaypointIndex >= this.waypoints.length) {
                    this.clearPath();
                }
            }
        }

        if (world_move_mag > 0) {
            const unit_move_vec = {
                x: world_move_vec.x / world_move_mag,
                y: world_move_vec.y / world_move_mag,
                z: world_move_vec.z / world_move_mag
            };

            this.curFacing = this._getNearestFacing(unit_move_vec);
            let speed = this.speed;
            if (Math.abs(unit_move_vec.z) > 0.2) speed = this.fall_speed;

            const actual_move_mag = Math.min(world_move_mag, speed * dt);
            const delta_vec = {
                x: unit_move_vec.x * actual_move_mag,
                y: unit_move_vec.y * actual_move_mag,
                z: unit_move_vec.z * actual_move_mag
            };

            this.moveXYZ(delta_vec.x, delta_vec.y, delta_vec.z);

            this.spriteSheet.setAction("Walk");
            this.spriteSheet.setIsIdle(false);
        } else {
            this.spriteSheet.setAction("Walk");
            this.spriteSheet.setIsIdle(true);
        }

        this.spriteSheet.setCharacterFacing(this.curFacing);
        this.spriteSheet.update(dt);

        const coord = this.spriteSheet.getCurrentImageCoord();
        this.imageCoord.row = coord.row;
        this.imageCoord.col = coord.col;
    }

    setWaypoints(waypoints) {
        this.currentWaypointIndex = waypoints.length ? 1 : 0;
        this.waypoints = waypoints;
    }

    clearPath() {
        this.waypoints = [];
        this.currentWaypointIndex = 0;
    }

    buildPathToPosition(game_map, goal_pos_xy, goal_z) {
        const start_pos_xy = this.getPositionXY();
        const startZ = this.getZ();

        const tilePath = game_map.findPath(start_pos_xy, startZ, goal_pos_xy, goal_z);

        if (!tilePath.length) {
            this.clearPath();
            return;
        }

        let waypoints = [];
        this._pushWaypoint(waypoints, start_pos_xy.x, start_pos_xy.y, startZ);
        for (let i = 1; i < tilePath.length - 1; ++i) {
            const pathPoint = tilePath[i];
            this._pushWaypoint(waypoints, pathPoint.x + 0.5, pathPoint.y + 0.5, pathPoint.z);
        }
        this._pushWaypoint(waypoints, goal_pos_xy.x, goal_pos_xy.y, goal_z);
        this.setWaypoints(waypoints);
    }
    
    _pushWaypoint(waypoints, x, y, z) {
        if (waypoints.length === 0) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const last_waypoint = waypoints[waypoints.length - 1];
        const step_down = last_waypoint.z - z;

        if (Math.abs(step_down) < 0.1) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const from_tile_center = add(getTileCoordFromXY(last_waypoint.x, last_waypoint.y), vec2D(0.5, 0.5));
        const to_tile_center = add(getTileCoordFromXY(x, y), vec2D(0.5, 0.5));
        const unit_tile_to_tile_dir = norm(sub(to_tile_center, from_tile_center));
        const along_edge = vec2D(-unit_tile_to_tile_dir.y, unit_tile_to_tile_dir.x);
        const tile_to_tile_midpoint = div(add(from_tile_center, to_tile_center), 2.0);

        const xy_pos = vec2D(x, y);
        const cliff_edge_point = intersect(last_waypoint, xy_pos,
            tile_to_tile_midpoint, add(tile_to_tile_midpoint, along_edge));

        if (!cliff_edge_point) {
            waypoints.push({x: x, y: y, z: z});
            return;
        }
        
        if (step_down > .1) {
            const step_xy_dist = dist(cliff_edge_point, xy_pos);
            if (step_xy_dist < .45) {
                waypoints.push({x: tile_to_tile_midpoint.x, y: tile_to_tile_midpoint.y, z: last_waypoint.z});
                waypoints.push({x: to_tile_center.x, y: to_tile_center.y, z: z});
                waypoints.push({x: x, y: y, z: z});
                return;
            }

            waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: last_waypoint.z});
            if (step_xy_dist > .55) {
                const along_unit = norm(sub(xy_pos, cliff_edge_point));
                const extra_point = add(cliff_edge_point, mult(along_unit, 0.5));
                waypoints.push({x: extra_point.x, y: extra_point.y, z: z}); 
            }
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        const step_xy_dist = dist(last_waypoint, cliff_edge_point);
        if (step_xy_dist < .45) {
            waypoints.push({x: from_tile_center.x, y: from_tile_center.y, z: last_waypoint.z});
            waypoints.push({x: tile_to_tile_midpoint.x, y: tile_to_tile_midpoint.y, z: z});
            waypoints.push({x: x, y: y, z: z});
            return;
        }

        if (step_xy_dist > .55) {
            const along_unit = norm(sub(last_waypoint, cliff_edge_point));
            const jump_point = add(cliff_edge_point, mult(along_unit, 0.5));
            waypoints.push({x: jump_point.x, y: jump_point.y, z: last_waypoint.z}); 
        }
        waypoints.push({x: cliff_edge_point.x, y: cliff_edge_point.y, z: z});
        waypoints.push({x: x, y: y, z: z}); 
    }

    startFollowing(target) {
        if (!target || target == this || target == this.follow_target) return;
        this.clearPath();
        this.follow_target = target;
        this.follow_success = false;
        this.follow_cache = null;
    }

    stopFollowing() {
        this.clearPath();
        this.follow_target = null;
        this.follow_success = false;
        this.follow_cache = null;
    }

    moveTo(game_map, world_pos) {
        this.stopFollowing();
        this.buildPathToPosition(game_map, vec2D(world_pos.x, world_pos.y), world_pos.z);
    }

    _updateFollow(game_map) {
        const target_xy = this.follow_target.getPositionXY();
        const target_z = this.follow_target.getZ();
        const target_is_walking = this.follow_target.isWalking();
        this.follow_success = false;

        //If we're close to the target and they're walking,
        //stop moving, face them, and see what happens.
        if (target_is_walking) {
            if (getMixedDist(this.getPositionXY(), this.getZ(),
                target_xy, target_z) <= 1.5) {
                this.clearPath();
                this._turnToFollowTarget();
                return;
            }
        }

        //Throw away cache if the target has moved or turned.
        if (this.follow_cache) {
            if (target_is_walking != this.follow_cache.target_is_walking ||
                getMixedDist(target_xy, target_z, this.follow_cache.target_xy,
                this.follow_cache.target_z) > 0.1) {
                this.follow_cache = null;
            }
        }

        //If we still have a cache, test it and see if we are good.
        if (this.follow_cache) {
            if (this._isCloseEnoughToTarget(this.follow_cache.target_xy,
                this.follow_cache.target_z)) {
                this.clearPath();
                this.follow_success = !target_is_walking;
            }
            this._turnToFollowTarget();
            return;
        }

        if (this._isCloseEnoughToTarget(target_xy, target_z)) {
            this.clearPath();
            this.follow_success = !target_is_walking;
            this._turnToFollowTarget();
            return;
        }

        this.buildPathToPosition(game_map, target_xy, target_z);
        if (this.waypoints.length > 0) {
            this.follow_cache = {
                target_xy: target_xy,
                target_z: target_z,
                target_is_walking: target_is_walking
            };
            this._turnToFollowTarget();
            return;
        }

        this.follow_cache = {
            target_xy: target_xy,
            target_z: target_z,
            target_is_walking: target_is_walking,
        };
        this._turnToFollowTarget();
    }

    _getNearestFacing(move_vec) {
        let best_proj = -Infinity;
        let best_facing = this.curFacing;
        for (const [facing, face_vec] of FACING_VECTORS) {
            const proj = dot(move_vec, face_vec);
            if (proj > best_proj) {
                best_proj = proj;
                best_facing = facing;
            }
        }
        return best_facing;
    }

    _isCloseEnoughToTarget(target_xy, target_z) {
        return getMixedDist(this.getPositionXY(), this.getZ(),
                target_xy, target_z) <= 0.9;
    }

    _turnToFollowTarget() {
        if (!this.follow_target) return;
        //Don't ever turn if we are walking.
        if (this.isWalking()) return;
        const to_target = sub(this.follow_target.getPositionXY(),
            this.getPositionXY());
        this.curFacing = this._getNearestFacing(to_target);
    }

    addToInventory(item_inst) {
        if (!item_inst || !(item_inst instanceof GameItemInst)) return;

        for (let old_item_inst of this.inventorySlots) {
            if (!old_item_inst) continue;
            if (old_item_inst.canStackWith(item_inst) &&
                old_item_inst.count < old_item_inst.maxStack) {
                const space = slot.maxStack - slot.count;
                const addAmt = Math.min(item_inst.count, space);
                slot.count += addAmt;
                item_inst.count -= addAmt;
                if (item_inst.count <= 0) return;
            }
        }

        for (let i = 0; i < this.inventorySlots.length; ++i) {
            if (!this.inventorySlots[i]) {
                this.inventorySlots[i] = item_inst;
                return;
            }
        }
        console.warn("Inventory full for", this.constructor.name);
    }

    swapInventorySlots(this_index, other, other_index) {
        if (other == null || this_index < 0 || this_index >= 40 ||
            other_index < 0 || other_index >= 40) return;

        //if (this != other) console.log("Cross-character swap");

        const thisInst = this.inventorySlots[this_index];
        const otherInst = other.inventorySlots[other_index];

        if (!thisInst && !otherInst) return;

        if (thisInst && otherInst && thisInst.canStackWith(otherInst)) {
            const max = thisInst.def.maxStack;
            const total = thisInst.count + otherInst.count;
            if (total <= max) {
                thisInst.count = total;
                other.inventorySlots[other_index] = null;
            } else {
                thisInst.count = max;
                otherInst.count = total - max;
            }
            return;
        }

        const tmp = this.inventorySlots[this_index]
        this.inventorySlots[this_index] = other.inventorySlots[other_index];
        other.inventorySlots[other_index] = tmp;
    }

    swapInventoryAndEquipmentSlots(inventory_index, equip_slot_name) {
        if (inventory_index < 0 || inventory_index >= 40) return;

        const equip_slot_filter = equip_slot_name.includes('_') ?
            equip_slot_name.split('_')[0] : equip_slot_name;

        const tmp = this.inventorySlots[inventory_index];
        if (tmp && tmp.def.equipSlot != equip_slot_filter) return;

        this.inventorySlots[inventory_index] = this.equipment[equip_slot_name];
        this.equipment[equip_slot_name] = tmp;
    }

    swapEquipmentAndEquipmentSlots(equip_slot_1, equip_slot_2) {
        const equip_slot_filter_1 = equip_slot_1.includes('_') ?
            equip_slot_1.split('_')[0] : equip_slot_1;
        const equip_slot_filter_2 = equip_slot_2.includes('_') ?
            equip_slot_2.split('_')[0] : equip_slot_2;
        if (equip_slot_filter_1 != equip_slot_filter_2) return;

        const tmp = this.equipment[equip_slot_1];
        this.equipment[equip_slot_1] = this.equipment[equip_slot_2];
        this.equipment[equip_slot_2] = tmp;
    }

    makeInventoryItem(inventory_index, id, quantity = 1, durability = null) {
        if (inventory_index < 0 || inventory_index >= 40) return;
        const def = this.item_library.get(id);
        if (!def) throw new Error(`Missing item definition: ${id}`);
        this.inventorySlots[inventory_index] =
            new GameItemInst(def, quantity, durability);
    }

    destroyInventoryItem(inventory_index) {
        if (inventory_index < 0 || inventory_index >= 40) return;
        this.inventorySlots[inventory_index] = null;
    }

    splitInventoryItem(num_to_split, index) {
        if (!num_to_split || index < 0 || index >= 40) {
            alert("Invalid split info.");
            return -1;
        }

        const split_item_inst = this.inventorySlots[index];
        if (!split_item_inst || num_to_split < 1 ||
            num_to_split >= split_item_inst.count) {
            return -1;
        }

        // Find first empty slot
        let empt_slot_index = -1;
        for (let i = 0; i < 40; i++) {
            if (!this.inventorySlots[i]) {
                empt_slot_index = i;
                break;
            }
        }

        if (empt_slot_index == -1) {
            alert("No empty slots available to split into.");
            return -1;
        }

        const num_remaining = split_item_inst.count - num_to_split;
        const first_half = split_item_inst.clone();
        first_half.count = num_remaining;
        const second_half = split_item_inst.clone();
        second_half.count = num_to_split;

        this.inventorySlots[index] = first_half;
        this.inventorySlots[empt_slot_index] = second_half;

        return empt_slot_index;
    }

    getFungibleItemCounts() {
        const fungible_items = new Map();
        for (const item_instance of this.inventorySlots) {
            if (!item_instance || !item_instance.isFungible()) continue;
            const map_key = item_instance.def;
            let prev_count = 0;
            if (fungible_items.has(map_key)) {
                prev_count = fungible_items.get(map_key);
            }
            fungible_items.set(map_key, item_instance.count + prev_count);
        }
        return fungible_items;
    }
}

