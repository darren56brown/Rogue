import { SlotGridUI } from "./slot_grid_ui.js";

export class TradeUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.player = null;
        this.npc = null;
        this.onOpen = onOpen;
        this.onClose = onClose;

        // Original state saved on activate
        this.originalPlayerInventory = [];
        this.originalNpcInventory = [];
        this.originalPlayerGold = 0;
        this.originalNpcGold = 0;

        this.container = document.getElementById('tradeViewer');
        this.closeBtn = document.getElementById('closeTrade');
        this.tradeBtn = document.getElementById('tradeBtn');
        this.cancelBtn = document.getElementById('cancelTradeBtn');

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
        
        this.tradeBtn.onclick = () => {
            if (!this.tradeBtn.disabled) {
                this.deactivate();   // keep all changes + gold
            }
        };
    }

    activate(player, npc) {
        if (player == null || this.player != null) return;
        if (npc == null || this.npc != null) return;

        this.player = player;
        this.npc = npc;

        // === SAVE ORIGINAL STATE (items + gold) ===
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

    cancelTrade() {
        if (!this.player || !this.npc) return;

        // Restore everything to original state
        this.player.inventorySlots = this.originalPlayerInventory.map(slot => 
            slot ? slot.clone() : null
        );
        this.npc.inventorySlots = this.originalNpcInventory.map(slot => 
            slot ? slot.clone() : null
        );
        this.player.gold = this.originalPlayerGold;
        this.npc.gold = this.originalNpcGold;

        this.deactivate();
    }

    isActive() {
        return this.player != null;
    }

    refreshGrids() {
        this.player_slot_grid.refreshGrid();
        this.npc_slot_grid.refreshGrid();
    }

    // Called after every drag/drop or split
    onGridsChanged() {
        const delta = this._computeGoldDelta();

        // Apply the new gold values (can go negative)
        this.player.gold = delta.newPlayerGold;
        this.npc.gold = delta.newNpcGold;

        this.refreshGrids();
        this._updateGoldColors();
        this.updateTradeButton(delta);
    }

    updateTradeButton(delta) {
        const can = delta.hasChanges && 
                    delta.newPlayerGold >= 0 && 
                    delta.newNpcGold >= 0;
        this.tradeBtn.disabled = !can;
    }

    // ====================== GOLD TRADING LOGIC ======================
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

        // Build a quick lookup of def by id (from any inventory that has the item)
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

        let playerPays = 0;   // total ask price (player buying from NPC)
        let npcPays = 0;      // total bid price (NPC buying from player)
        let hasChanges = false;

        const allIds = new Set([...origPlayerMap.keys(), ...currPlayerMap.keys()]);

        for (const id of allIds) {
            const origCount = origPlayerMap.get(id) || 0;
            const currCount = currPlayerMap.get(id) || 0;
            const netToPlayer = currCount - origCount;

            if (netToPlayer != 0) {
                hasChanges = true;
                const def = defMap.get(id);
                if (def) {
                    if (netToPlayer > 0) {
                        // Player is buying these items from NPC
                        playerPays += netToPlayer * def.ask;
                    } else {
                        // Player is selling these items to NPC
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