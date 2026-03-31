import { Character } from "./character.js";
import { GameItem } from "./game_item.js";

export class Player extends Character {
    constructor(world_pos, image_library, sprite_image_name) {
        super(world_pos, image_library, sprite_image_name);

        this.hotbar = [];
        this.selectedSlot = 0;

        this.initializeSprite(image_library, sprite_image_name);
    }

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

    swapHotbarSlots(slotIndex1, slotIndex2) {
        if (slotIndex1 < 0 || slotIndex1 > 8 || slotIndex2 < 0 || slotIndex2 > 8) return;
        
        const temp = this.hotbar[slotIndex1];
        this.hotbar[slotIndex1] = this.hotbar[slotIndex2];
        this.hotbar[slotIndex2] = temp;
    }
}