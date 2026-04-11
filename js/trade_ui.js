import { SlotGridUI } from "./slot_grid_ui.js";

export class TradeUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.player = null;
        this.npc = null;
        this.onOpen = onOpen;
        this.onClose = onClose;

        // Original state (saved when trade window opens)
        this.originalPlayerInventory = [];
        this.originalNpcInventory = [];
        this.originalPlayerGold = 0;
        this.originalNpcGold = 0;

        this.container = document.getElementById('tradeViewer');
        this.closeBtn = document.getElementById('closeTrade');
        this.tradeBtn = document.getElementById('tradeBtn');
        this.cancelBtn = document.getElementById('cancelTradeBtn');
        this.resetBtn = document.getElementById('resetTradeBtn');

        this.player_slot_grid = new SlotGridUI("playerSlotGrid",
            "tradePlayerGoldAmount", "tradeItemDescription",  
            () => this.onGridsChanged());

        this.npc_slot_grid = new SlotGridUI("npcSlotGrid",
            "tradeNpcGoldAmount", "tradeItemDescription",  
            () => this.onGridsChanged());

        this.initEvents();
    }

    initEvents() {
        this.closeBtn.onclick = () => this.cancelTrade();
        this.cancelBtn.onclick = () => this.cancelTrade();
        this.resetBtn.onclick = () => this.resetTrade();
        
        this.tradeBtn.onclick = () => {
            if (!this.tradeBtn.disabled) {
                this.commitTrade();     // ← NEW: make current state the new baseline
                this.deactivate();
            }
        };
    }

    activate(player, npc) {
        if (player == null || this.player != null) return;
        if (npc == null || this.npc != null) return;

        this.player = player;
        this.npc = npc;

        // Save original state for this trade session
        this.originalPlayerInventory = this.player.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );
        this.originalNpcInventory = this.npc.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );
        this.originalPlayerGold = this.player.gold;
        this.originalNpcGold = this.npc.gold;

        this.player_slot_grid.activate(this.player, this.npc, this);
        this.npc_slot_grid.activate(this.npc, this.player, this);

        const headerTitle = document.querySelector('#tradeViewer .inventory-viewer-header h2');
        headerTitle.textContent = `Trade: ${this.npc.display_name}`;

        this.container.classList.add('is-active');
        this.onOpen();

        this.refreshGrids();
        this._updateGoldColors();
        this.updateTradeButton({ hasChanges: false, newPlayerGold: this.player.gold, newNpcGold: this.npc.gold });
    }

    // ==================== NEW: COMMIT SUCCESSFUL TRADE ====================
    commitTrade() {
        if (!this.player || !this.npc) return;

        // Current state becomes the new "original" for the next trade session
        this.originalPlayerInventory = this.player.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );
        this.originalNpcInventory = this.npc.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );
        this.originalPlayerGold = this.player.gold;
        this.originalNpcGold = this.npc.gold;
    }

    deactivate() {
        this.player = null;
        this.npc = null;
        this.originalPlayerInventory = [];
        this.originalNpcInventory = [];
        this.originalPlayerGold = 0;
        this.originalNpcGold = 0;

        this.player_slot_grid.deactivate();
        this.npc_slot_grid.deactivate();

        this.container.classList.remove('is-active');
        this.onClose();
    }

    resetTrade() {
        if (!this.player || !this.npc) return;

        this.player.inventorySlots = this.originalPlayerInventory.map(slot => 
            slot ? slot.clone() : null
        );
        this.npc.inventorySlots = this.originalNpcInventory.map(slot => 
            slot ? slot.clone() : null
        );
        this.player.gold = this.originalPlayerGold;
        this.npc.gold = this.originalNpcGold;

        this.refreshGrids();
        this._updateGoldColors();
        this.updateTradeButton({ hasChanges: false, newPlayerGold: this.player.gold, newNpcGold: this.npc.gold });
    }

    cancelTrade() {
        this.resetTrade();
        this.deactivate();
    }

    refreshGrids() {
        this.player_slot_grid.refreshGrid();
        this.npc_slot_grid.refreshGrid();
    }

    onGridsChanged() {
        const delta = this._computeGoldDelta();

        this.player.gold = delta.newPlayerGold;
        this.npc.gold = delta.newNpcGold;

        this.refreshGrids();
        this._updateGoldColors();
        this.updateTradeButton(delta);
    }

    // ====================== BUTTON STATE ======================
    updateTradeButton(delta) {
        const hasChanges = delta.hasChanges || false;

        // Trade button: needs changes + non-negative gold
        this.tradeBtn.disabled = !(hasChanges && 
                                  delta.newPlayerGold >= 0 && 
                                  delta.newNpcGold >= 0);

        // Reset button: only active if changes were made
        this.resetBtn.disabled = !hasChanges;
    }

    // ====================== GOLD CALCULATION ======================
    _getCountMap(slots) {
        const map = new Map();
        for (const slot of slots) {
            if (slot) {
                const id = slot.def.id;
                map.set(id, (map.get(id) || 0) + slot.count);
            }
        }
        return map;
    }

    _computeGoldDelta() {
        const origPlayerMap = this._getCountMap(this.originalPlayerInventory);
        const currPlayerMap = this._getCountMap(this.player.inventorySlots);

        const defMap = new Map();
        const allInventories = [
            this.originalPlayerInventory,
            this.originalNpcInventory,
            this.player.inventorySlots,
            this.npc.inventorySlots
        ];
        for (const inv of allInventories) {
            for (const item of inv) {
                if (item && !defMap.has(item.def.id)) {
                    defMap.set(item.def.id, item.def);
                }
            }
        }

        let playerPays = 0;
        let npcPays = 0;
        let hasChanges = false;

        const allIds = new Set([...origPlayerMap.keys(), ...currPlayerMap.keys()]);

        for (const id of allIds) {
            const origCount = origPlayerMap.get(id) || 0;
            const currCount = currPlayerMap.get(id) || 0;
            const netToPlayer = currCount - origCount;

            if (netToPlayer !== 0) {
                hasChanges = true;
                const def = defMap.get(id);
                if (def) {
                    if (netToPlayer > 0) {
                        playerPays += netToPlayer * def.ask;
                    } else {
                        npcPays += (-netToPlayer) * def.bid;
                    }
                }
            }
        }

        const newPlayerGold = this.originalPlayerGold - playerPays + npcPays;
        const newNpcGold = this.originalNpcGold + playerPays - npcPays;

        return { newPlayerGold, newNpcGold, hasChanges };
    }

    _updateGoldColors() {
        const playerGoldEl = document.getElementById('tradePlayerGoldAmount');
        const npcGoldEl = document.getElementById('tradeNpcGoldAmount');

        if (playerGoldEl) {
            playerGoldEl.style.color = (this.player.gold < 0) ? '#ff4444' : '#ffeb3b';
        }
        if (npcGoldEl) {
            npcGoldEl.style.color = (this.npc.gold < 0) ? '#ff4444' : '#ffeb3b';
        }
    }

        // Called from SlotGridUI when hovering in trade window
    getTradeHoverInfo(itemInst, isCurrentlyOnNpcSide) {
        if (!itemInst) return null;

        const count = itemInst.count;
        const itemId = itemInst.def.id;

        // Count how many of this item each side had at the start of trade
        const origPlayerCount = this.originalPlayerInventory.reduce((sum, slot) => {
            return sum + (slot && slot.def.id === itemId ? slot.count : 0);
        }, 0);

        const origNpcCount = this.originalNpcInventory.reduce((sum, slot) => {
            return sum + (slot && slot.def.id === itemId ? slot.count : 0);
        }, 0);

        let label, totalPrice, unitPrice, color;

        if (isCurrentlyOnNpcSide) {
            // Currently on NPC side
            const currentNpcCount = this.npc.inventorySlots.reduce((sum, slot) => {
                return sum + (slot && slot.def.id === itemId ? slot.count : 0);
            }, 0);

            if (currentNpcCount > origNpcCount) {
                // NPC has more than originally → player sold some
                label = "Selling";
                totalPrice = itemInst.def.bid * count;
                unitPrice = itemInst.def.bid;
                color = "#ffeb3b";
            } else {
                label = "Buy";
                totalPrice = itemInst.def.ask * count;
                unitPrice = itemInst.def.ask;
                color = "#ffeb3b";
            }
        } 
        else {
            // Currently on Player side
            const currentPlayerCount = this.player.inventorySlots.reduce((sum, slot) => {
                return sum + (slot && slot.def.id === itemId ? slot.count : 0);
            }, 0);

            if (currentPlayerCount > origPlayerCount) {
                // Player has more than originally → bought from NPC
                label = "Buying";
                totalPrice = itemInst.def.ask * count;
                unitPrice = itemInst.def.ask;
                color = "#ffeb3b";
            } else {
                label = "Sell";
                totalPrice = itemInst.def.bid * count;
                unitPrice = itemInst.def.bid;
                color = "#ffeb3b";
            }
        }

        return { label, totalPrice, unitPrice, color };
    }
}
