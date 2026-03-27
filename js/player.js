import { Character } from "./character.js";
import { GameItem } from "./game_item.js";

export class Player extends Character {
    constructor(posXY, z) {
        super(posXY, z);

        // Player-specific inventory system
        this.inventory = [];        // Full inventory: array of {item: GameItem, count: number}
        this.hotbar = [];           // Hotbar: exactly 9 slots, can contain null
        this.selectedSlot = 0;      // Currently selected hotbar slot (0-8)

        this.followTarget = null;          // Npc reference or null
        this.followLastTargetPos = null;   // {x, y, z} snapshot when we last built a path
    }

    // Initialize starting items (called from App)
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

    startFollowing(target) {
        if (!target || target === this) return;
        this.followTarget = target;
        this.followLastTargetPos = null;   // force immediate rebuild on next update
        this.clearPath();
    }

    stopFollowing() {
        this.followTarget = null;
        this.followLastTargetPos = null;
    }

    // Override updatePhysics so we can manage follow mode every frame
    updatePhysics(dt, game_map) {
        if (this.followTarget) {
            this._updateFollow(dt, game_map);
        }
        super.updatePhysics(dt, game_map);
    }

    _updateFollow(dt, game_map) {
        if (!this.followTarget || !game_map) return;

        const targetPos = this.followTarget.getPositionXY();
        const targetZ = this.followTarget.getZ();

        const myPos = this.getPositionXY();
        const myZ = this.getZ();

        // Distance to target (full 3D — works even if NPC changes layers)
        const dist = Math.hypot(
            myPos.x - targetPos.x,
            myPos.y - targetPos.y,
            myZ - targetZ
        );

        // Stop moving when we are close
        if (dist <= 1.0) {
            this.clearPath();
            return;                     // stay in follow mode, just idle
        }

        // Only rebuild path when the target has moved meaningfully
        const last = this.followLastTargetPos;
        const moved = last
            ? Math.hypot(
                targetPos.x - last.x,
                targetPos.y - last.y,
                targetZ - last.z
            )
            : Infinity;   // first time = always rebuild

        if (moved > 0.25 || !last) {
            this.buildPathToPosition(game_map, targetPos, targetZ);
            this.followLastTargetPos = { x: targetPos.x, y: targetPos.y, z: targetZ };
        }
    }
}