import { Character } from "./character.js";
import { GameItem } from "./game_item.js";
import { PlayerFacing } from "./character.js";
import {vec2D} from './vec2D.js';

export class Player extends Character {
    constructor(world_pos, image_library, sprite_image_name) {
        super(world_pos, image_library, sprite_image_name);

        // Player-specific inventory system
        this.inventory = [];        // Full inventory: array of {item: GameItem, count: number}
        this.hotbar = [];           // Hotbar: exactly 9 slots, can contain null
        this.selectedSlot = 0;      // Currently selected hotbar slot (0-8)

        // === FOLLOW MODE (improved) ===
        this.followTarget = null;          // Npc reference or null
        this.followLastDesiredPos = null;  // {x, y, z} of the exact spot we last built a path to
    }

    // Initialize starting items (unchanged)
    initializeDefaultItems() {
        const woodenSword = new GameItem({
            id: "wooden_sword",
            name: "Wooden Sword",
            type: "weapon",
            icon: "🗡️",
            damage: 5,
            durability: 60,
            description: "A crude but effective beginner weapon."
        });

        const stonePickaxe = new GameItem({
            id: "stone_pickaxe",
            name: "Stone Pickaxe",
            type: "tool",
            icon: "⛏️",
            damage: 3,
            description: "Good for breaking rocks."
        });

        const apple = new GameItem({
            id: "apple",
            name: "Apple",
            type: "consumable",
            icon: "🍎",
            healAmount: 4,
            maxStack: 64,
            description: "A fresh red apple."
        });

        const shield = new GameItem({
            id: "wooden_shield",
            name: "Wooden Shield",
            type: "armor",
            icon: "🛡️",
            defense: 3,
            description: "Basic protection."
        });

        const torch = new GameItem({
            id: "torch",
            name: "Torch",
            type: "misc",
            icon: "🔥",
            description: "Provides light."
        });

        // Set up hotbar (9 slots)
        this.hotbar = [
            { item: woodenSword, count: 1 },
            { item: stonePickaxe, count: 1 },
            { item: new GameItem({id:"iron_axe", name:"Iron Axe", type:"tool", icon:"🪓", damage:7}), count: 1 },
            { item: null, count: 0 },
            { item: new GameItem({id:"bow", name:"Bow", type:"weapon", icon:"🏹", damage:6}), count: 1 },
            { item: null, count: 0 },
            { item: apple, count: 32 },
            { item: shield, count: 1 },
            { item: torch, count: 1 }
        ];

        // Starting full inventory (some overlap with hotbar)
        this.inventory = [
            { item: apple.clone(), count: 12 },
            { item: woodenSword.clone(), count: 1 },
            { item: new GameItem({id:"stone", name:"Stone", type:"resource", icon:"🪨", maxStack: 99}), count: 64 }
        ];
    }

    // Get currently selected hotbar item
    getSelectedItem() {
        const slot = this.hotbar[this.selectedSlot];
        return slot && slot.item ? slot : null;
    }

    // Swap two hotbar slots (used for drag & drop)
    swapHotbarSlots(slotIndex1, slotIndex2) {
        if (slotIndex1 < 0 || slotIndex1 > 8 || slotIndex2 < 0 || slotIndex2 > 8) return;
        
        const temp = this.hotbar[slotIndex1];
        this.hotbar[slotIndex1] = this.hotbar[slotIndex2];
        this.hotbar[slotIndex2] = temp;
    }

    // Add item to inventory (with stacking)
    addToInventory(gameItem, count = 1) {
        if (!gameItem) return;

        // Try to stack with existing item
        for (let entry of this.inventory) {
            if (entry.item.id === gameItem.id) {
                entry.count += count;
                return;
            }
        }

        // Add as new entry
        this.inventory.push({ item: gameItem.clone(), count });
    }

    // ====================== IMPROVED FOLLOW MODE ======================
    startFollowing(target) {
        if (!target || target == this || target == this.followTarget) return;
        this.clearPath();
        this.followTarget = target;
        this.followLastDesiredPos = null;
    }

    stopFollowing() {
        this.clearPath();
        this.followTarget = null;
        this.followLastDesiredPos = null;
    }

    moveTo(game_map, world_pos) {
        this.stopFollowing();
        this.buildPathToPosition(game_map, vec2D(world_pos.x, world_pos.y), world_pos.z);
    }

    // Override so we can inject follow logic before the normal movement code
    updatePhysics(dt, game_map) {
        if (this.followTarget) {
            this._updateFollow(dt, game_map);
        }
        super.updatePhysics(dt, game_map);
    }

    _updateFollow(dt, game_map) {
        if (!this.followTarget || !game_map) return;

        const npc = this.followTarget;
        const npcPos = npc.getPositionXY();
        const npcZ   = npc.getZ();
        const facing = npc.curFacing;

        // Offsets = exactly 3/4 tile directly in front of the NPC
        // (based on the same coordinate system the pathfinding and movement use)
        const CARDINAL_OFFSET = 0.75;
        const DIAG_OFFSET = CARDINAL_OFFSET / Math.SQRT2;   // ≈ 0.530

        const offsets = {
            [PlayerFacing.face_nw]: { x: -DIAG_OFFSET, y: -DIAG_OFFSET },
            [PlayerFacing.face_n ]: { x:  0.00,        y: -CARDINAL_OFFSET },
            [PlayerFacing.face_ne]: { x:  DIAG_OFFSET, y: -DIAG_OFFSET },
            [PlayerFacing.face_e ]: { x:  CARDINAL_OFFSET, y:  0.00 },
            [PlayerFacing.face_se]: { x:  DIAG_OFFSET, y:  DIAG_OFFSET },
            [PlayerFacing.face_s ]: { x:  0.00,        y:  CARDINAL_OFFSET },
            [PlayerFacing.face_sw]: { x: -DIAG_OFFSET, y:  DIAG_OFFSET },
            [PlayerFacing.face_w ]: { x: -CARDINAL_OFFSET, y:  0.00 }
        };

        const offset = offsets[facing] || { x: 0, y: 0 };

        const desiredPos = {
            x: npcPos.x + offset.x,
            y: npcPos.y + offset.y
        };
        const desiredZ = npcZ;

        // How close are we to the perfect “in-front” spot?
        const myPos = this.getPositionXY();
        const myZ   = this.getZ();
        const distToDesired = Math.hypot(
            myPos.x - desiredPos.x,
            myPos.y - desiredPos.y,
            myZ   - desiredZ
        );

        const CLOSE_ENOUGH = 0.25;   // once inside this radius we stop moving and just face the NPC

        if (distToDesired <= CLOSE_ENOUGH) {
            this.clearPath();

            // Face directly toward the NPC (opposite of their facing)
            const oppositeFacing = (facing + 4) % 8;
            this.curFacing = oppositeFacing;

            return;   // we are perfectly positioned — no more movement this frame
        }

        // Not close enough → we need to walk toward the desired spot.
        // Only rebuild the full A* path when the desired spot has moved significantly
        // (this is the performance win you asked for)
        const last = this.followLastDesiredPos;
        let needsRebuild = !last;

        if (last) {
            const moved = Math.hypot(
                desiredPos.x - last.x,
                desiredPos.y - last.y,
                desiredZ   - last.z
            );
            if (moved > 0.25) needsRebuild = true;
        }

        if (needsRebuild) {
            this.buildPathToPosition(game_map, desiredPos, desiredZ);
            this.followLastDesiredPos = { x: desiredPos.x, y: desiredPos.y, z: desiredZ };
        }
    }
}