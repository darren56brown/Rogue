export class GameItem {
    constructor(data) {
        this.id = data.id;                    // unique string identifier, e.g. "wooden_sword"
        this.name = data.name;                // display name
        this.type = data.type || "misc";      // "weapon", "tool", "consumable", "armor", "resource", etc.
        this.rarity = data.rarity || "common"; // common, uncommon, rare, epic...
        
        this.icon = data.icon;                // emoji for now, later: image path or sprite info
        this.maxStack = data.maxStack || 64;  // how many can stack in one slot
        
        // Core stats (expand as needed)
        this.damage = data.damage || 0;
        this.defense = data.defense || 0;
        this.healAmount = data.healAmount || 0;
        this.durability = data.durability || Infinity; // Infinity = unbreakable for now
        
        this.description = data.description || "";
        
        // Future-proof fields
        this.value = data.value || 0;         // gold/trade value
        this.weight = data.weight || 0;
        this.tags = data.tags || [];          // e.g. ["metal", "sharp", "edible"]
        this.equipSlot = data.equipSlot || null; // "helmet", "chest", "legs", "boots"
    }

    // Helper methods
    canStackWith(otherItem) {
        return this.id === otherItem.id;
    }

    isStackable() {
        return this.maxStack > 1;
    }

    clone() {
        return new GameItem({
            id: this.id,
            name: this.name,
            type: this.type,
            rarity: this.rarity,
            icon: this.icon,
            maxStack: this.maxStack,
            damage: this.damage,
            defense: this.defense,
            healAmount: this.healAmount,
            durability: this.durability,
            description: this.description,
            value: this.value,
            weight: this.weight,
            tags: [...this.tags],
            equipSlot: this.equipSlot
        });
    }

    toJSON() {
        return {
            id: this.id,
            count: this.count || 1   // we'll add count when in inventory
        };
    }
}
