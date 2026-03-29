export class Conversation {
  constructor(jsonPath) {
    this.jsonPath = jsonPath;
    this.nodes = {};          // all sub-conversation nodes
    this.roots = [];          // possible starting node IDs
    this.currentNodeId = null;
    this.visited = new Set(); // tracks completed sub-conversations (persistent across talks)
    this.loaded = false;
  }

  /**
   * Load the conversation tree from JSON (async because we use fetch in browser games).
   */
  async load() {
    try {
      const response = await fetch(this.jsonPath);
      if (!response.ok) throw new Error(`Failed to load ${this.jsonPath}`);
      const data = await response.json();

      this.roots = data.roots || [Object.keys(data.nodes)[0]];
      this.nodes = data.nodes || {};
      this.loaded = true;
      console.log(`✅ Loaded conversation: ${data.id || this.jsonPath}`);
    } catch (error) {
      console.error("❌ Conversation load failed:", error);
      throw error;
    }
  }

  /**
   * Start a new conversation session.
   * You can pass a specific root ID (for multiple entry points) or omit it to use the first root.
   * Pass a saved state object if you want to restore previously completed sub-conversations.
   */
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
    console.log(`💬 Started conversation at node: ${startId}`);
  }

  /**
   * Get the NPC's current statement.
   */
  getCurrentNpcText() {
    if (!this.currentNodeId || !this.nodes[this.currentNodeId]) return null;
    return this.nodes[this.currentNodeId].npcText;
  }

  /**
   * Get only the choices that haven't been taken yet (next node not visited).
   * This automatically retires choices you've already asked and prevents looping.
   */
  getAvailableChoices() {
    if (!this.currentNodeId || !this.nodes[this.currentNodeId]) return [];

    const node = this.nodes[this.currentNodeId];
    return node.choices.filter((choice) => {
      const nextId = choice.next;
      // Only show choices leading to unvisited sub-conversations
      return !this.visited.has(nextId);
    });
  }

  /**
   * Player selects a choice by index (0-based) from the available choices list.
   * Returns true if successful, false otherwise.
   */
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

    console.log(`➡️ Player chose: "${chosen.playerText}" → node: ${nextId}`);
    return true;
  }

  /**
   * Check if the conversation has ended (no more available choices).
   */
  isEnded() {
    if (!this.currentNodeId) return true;
    return this.getAvailableChoices().length === 0;
  }

  /**
   * Get the current state so you can save it (e.g. to localStorage, game save file, etc.).
   * Call this after the player finishes talking to persist which sub-conversations are completed.
   */
  getState() {
    return {
      visited: Array.from(this.visited)
    };
  }

  /**
   * Optional: Reset everything (useful for testing or new-game-plus).
   */
  reset() {
    this.currentNodeId = null;
    this.visited.clear();
  }
}

// ==================== EXAMPLE USAGE ====================
// (Put this in your game when an NPC is interacted with)

async function talkToBob() {
  const bobChat = new Conversation("talk_to_bob.json");
  await bobChat.load();

  // Optional: restore previously saved state
  const saved = localStorage.getItem("conversation_talk_to_bob");
  if (saved) bobChat.start(null, JSON.parse(saved));
  else bobChat.start();

  // Game loop for this conversation (you'll wire this into your UI)
  while (!bobChat.isEnded()) {
    console.log("NPC:", bobChat.getCurrentNpcText());
    const choices = bobChat.getAvailableChoices();
    console.log("Choices:", choices.map((c, i) => `${i}: ${c.playerText}`));

    // Simulate player picking choice 0 (replace with your UI click handler)
    const playerPicked = 0; // <-- your game decides this
    bobChat.selectChoice(playerPicked);
  }

  console.log("NPC:", bobChat.getCurrentNpcText()); // final line
  console.log("Conversation ended.");

  // Save state for next time the player talks to Bob
  localStorage.setItem("conversation_talk_to_bob", JSON.stringify(bobChat.getState()));
}
