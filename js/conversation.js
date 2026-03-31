
export class Conversation {
    constructor(map_name, npc_base_name) {
        this.jsonPath = `maps/${map_name}/${npc_base_name}_conv.json`;

        this.nodes = {};
        this.roots = [];
        this.currentNodeId = null;
        this.visited = new Set();
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

            this.roots = data.roots || [Object.keys(data.nodes)[0]];
            this.nodes = data.nodes || {};
            this.loaded = true;
        } catch (error) {
            console.error("❌ Conversation load failed:", error);
            throw error;
        }
    }

    start(rootId = null, savedState = null) {
        if (!this.loaded) throw new Error("Call load() first!");

        // Restore persistent visited state (so choices retire permanently across multiple talks)
        if (savedState && savedState.visited) {
            this.visited = new Set(savedState.visited);
        }

        const startId = rootId || this.roots[0];
        if (!this.nodes[startId]) {
            throw new Error(`Invalid root node: ${startId}`);
        }

        this.currentNodeId = startId;
        this.visited.add(startId); // Mark the starting sub-conversation as completed (you just heard it)
        //console.log(`💬 Started conversation at node: ${startId}`);
    }

    getCurrentNpcText() {
        if (!this.currentNodeId || !this.nodes[this.currentNodeId]) return null;
        return this.nodes[this.currentNodeId].npcText;
    }

    getAvailableChoices() {
        if (!this.currentNodeId || !this.nodes[this.currentNodeId]) return [];

        const node = this.nodes[this.currentNodeId];
        return node.choices.filter((choice) => {
            const nextId = choice.next;
            // Only show choices leading to unvisited sub-conversations
            return !this.visited.has(nextId);
        });
    }

    selectChoice(choiceIndex) {
        const available = this.getAvailableChoices();
        if (choiceIndex < 0 || choiceIndex >= available.length) {
            console.warn("Invalid choice index");
            return false;
        }

        const chosen = available[choiceIndex];
        const nextId = chosen.next;

        // Move to the next sub-conversation
        this.currentNodeId = nextId;
        this.visited.add(nextId); // Mark it completed immediately (you just heard it)

        //console.log(`➡️ Player chose: "${chosen.playerText}" → node: ${nextId}`);
        return true;
    }

    isEnded() {
        if (!this.currentNodeId) return true;
        return this.getAvailableChoices().length === 0;
    }

    getState() {
        return {
            visited: Array.from(this.visited)
        };
    }

    reset() {
        this.currentNodeId = null;
        this.visited.clear();
    }
}

 