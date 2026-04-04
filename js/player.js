import { Character } from "./character.js";
import { GameItem } from "./game_item.js";

export class Player extends Character {
    constructor(world_pos, image_library, sprite_image_name) {
        super(world_pos, "Player");

        this.selectedSlot = 0;

        this.initializeSprite(image_library, sprite_image_name);
        this.initializeDefaultItems();
    }

    initializeDefaultItems() {
        const woodenSword = new GameItem({ id: "wooden_sword", name: "Wooden Sword", type: "weapon", icon: "🗡️", damage: 5, durability: 60, description: "A crude but effective beginner weapon." });
        const stonePickaxe = new GameItem({ id: "stone_pickaxe", name: "Stone Pickaxe", type: "tool", icon: "⛏️", damage: 3, description: "Good for breaking rocks." });
        const ironAxe = new GameItem({ id: "iron_axe", name: "Iron Axe", type: "tool", icon: "🪓", damage: 7 });
        const bow = new GameItem({ id: "bow", name: "Bow", type: "weapon", icon: "🏹", damage: 6 });
        const apple = new GameItem({ id: "apple", name: "Apple", type: "consumable", icon: "🍎", healAmount: 4, maxStack: 64, description: "A fresh red apple." });
        const shield = new GameItem({
            id: "wooden_shield",
            name: "Wooden Shield",
            type: "armor",
            icon: "🛡️",
            defense: 3,
            description: "Basic protection.",
            equipSlot: "chest"
        });
        const torch = new GameItem({ id: "torch", name: "Torch", type: "misc", icon: "🔥", description: "Provides light." });

        // These directly fill the first row (hotbar) because hotbar points at the same memory
        this.inventorySlots[0] = { item: woodenSword, count: 1 };
        this.inventorySlots[1] = { item: stonePickaxe, count: 1 };
        this.inventorySlots[2] = { item: ironAxe, count: 1 };
        this.inventorySlots[3] = { item: null, count: 0 };
        this.inventorySlots[4] = { item: bow, count: 1 };
        this.inventorySlots[5] = { item: null, count: 0 };
        this.inventorySlots[6] = { item: apple, count: 32 };
        this.inventorySlots[7] = { item: shield, count: 1 };
        this.inventorySlots[8] = { item: torch, count: 1 };
        this.inventorySlots[9]  = { item: null, count: 0 };

        // Rest of backpack
        this.inventorySlots[10]  = { item: apple.clone(), count: 12 };
        this.inventorySlots[11] = { item: woodenSword.clone(), count: 1 };
        this.inventorySlots[12] = { item: new GameItem({ id: "stone", name: "Stone", type: "resource", icon: "🪨", maxStack: 99 }), count: 64 };
    }

    swapHotbarSlots(index1, index2) {
        if (index1 >= 0 && index1 < 10 || index2 >= 0 || index2 < 10)
            this.swapInventorySlots(index1, index2);
    }

    get inventory() {
        return this.inventorySlots.filter(s => s.item !== null);
    }
}