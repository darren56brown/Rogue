import { SlotGridUI } from "./slot_grid_ui.js";

export class TradeUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.player = null;
        this.npc = null;
        this.onOpen = onOpen;
        this.onClose = onClose;

        // Original state
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
                this.deactivate();
            }
        };
    }

    activate(player, npc) {
        if (player == null || this.player != null) return;
        if (npc == null || this.npc != null) return;

        this.player = player;
        this.npc = npc;

        // Save original state
        this.originalPlayerInventory = this.player.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );
        this.originalNpcInventory = this.npc.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );
        this.originalPlayerGold = this.player.gold;
        this.originalNpcGold = this.npc.gold;

        this.player_slot_grid.activate(this.player, this.npc);
        this.npc_slot_grid.activate(this.npc, this.player);

        const headerTitle = document.querySelector('#tradeViewer .inventory-viewer-header h2');
        headerTitle.textContent = `Trade: ${this.npc.display_name}`;

        this.container.classList.add('is-active');
        this.onOpen();

        this.refreshGrids();
        this._updateGoldColors();
        
        // Start with no changes
        this.updateTradeButton({ hasChanges: false, newPlayerGold: this.player.gold, newNpcGold: this.npc.gold });
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

    // ==================== RESET (only active when changes exist) ====================
    resetTrade() {
        if (!this.player || !this.npc) return;

        // Restore original state
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
        
        // No changes after reset
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
}