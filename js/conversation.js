
export class Conversation {
    #current_node = null;

    constructor(map_name, npc_base_name) {
        this.jsonPath = `maps/${map_name}/${npc_base_name}_conv.json`;
        this.nodes = {};
        this.loaded = false;
    }

    async ensureLoaded() {
        if (this.loaded) return;
        await this.load();
    }

    async load() {
        try {
            const response = await fetch(this.jsonPath);
            if (!response.ok) {
                throw new Error(`Failed to load conversation: ${this.jsonPath}`);
            }
            const data = await response.json();
            this.nodes = data.nodes || {};

            //Add the key back to the value as an id
            Object.keys(this.nodes).forEach(key => {
                const node = this.nodes[key];
                node.id = key;
                node.visited = false;
            });

            this.loaded = true;
        } catch (error) {
            console.error("❌ Conversation load failed:", error);
            throw error;
        }
    }

    setCurrentNodeId(id) {
        this.#current_node = this.nodes[id];
        if (!this.#current_node) return null;
        this.#current_node.visited = true;
        return this.#current_node;
    }

    start() {
        if (!this.loaded) throw new Error("Call load() first!");

        const greeting_node = this.setCurrentNodeId("_greeting");
        if (!greeting_node) {
            throw new Error(`Must define greeting node named ${"_greeting"}`);
        }
    }

    getCurrentNpcText() {
        if (!this.#current_node) return null;
        return this.#current_node.npcText;
    }

    getAvailableChoices() {
        if (!this.#current_node) return [];

        return this.#current_node.choices.filter((choice) => {
            const next_id = choice.next;
            const next_node = this.nodes[next_id];
            if (!next_node) return false;
            return !next_node.visited;
        });
    }

    selectChoice(choiceIndex) {
        const available = this.getAvailableChoices();
        if (choiceIndex < 0 || choiceIndex >= available.length) {
            console.warn("Invalid choice index");
            return false;
        }

        const chosen = available[choiceIndex];
        this.setCurrentNodeId(chosen.next);

        return true;
    }
}

 