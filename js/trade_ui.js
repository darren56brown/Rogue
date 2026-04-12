import { SlotGridUI } from "./slot_grid_ui.js";

export class TradeUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.player = null;
        this.npc = null;
        this.onOpen = onOpen;
        this.onClose = onClose;

        // Original state (saved when trade window opens)
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

        this.closeBtn.onclick = () => this.cancelTrade();
        this.cancelBtn.onclick = () => this.cancelTrade();
        this.resetBtn.onclick = () => this.resetTrade();
        this.tradeBtn.onclick = () => this.deactivate();
    }

    activate(player, npc) {
        if (player == null || this.player != null) return;
        if (npc == null || this.npc != null) return;

        this.player = player;
        this.npc = npc;

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

    deactivate() {
        this.player = null;
        this.npc = null;
        this.originalPlayerGold = 0;
        this.originalNpcGold = 0;

        this.player_slot_grid.deactivate();
        this.npc_slot_grid.deactivate();

        this.container.classList.remove('is-active');
        this.onClose();
    }

    resetTrade() {
        if (!this.player || !this.npc) return;

        this.player_slot_grid.resetInventory();
        this.npc_slot_grid.resetInventory();

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

        this.player.gold = delta.new_player_gold;
        this.npc.gold = delta.new_npc_gold;

        this.refreshGrids();
        this._updateGoldColors();
        this.updateTradeButton(delta);
    }

    updateTradeButton(delta) {
        this.tradeBtn.disabled = !(delta.has_changes && 
                                  delta.new_player_gold >= 0 && 
                                  delta.new_npc_gold >= 0);
        this.resetBtn.disabled = !delta.has_changes;
    }

    _computeGoldDelta() {
        const new_player_items = this.player_slot_grid.getTradedForItems(this.npc_slot_grid);
        const new_npc_items = this.npc_slot_grid.getTradedForItems(this.player_slot_grid);
        
        let has_changes = false;
        let player_pays = 0;
        for (const new_item of new_player_items) {
            const item_price = new_item.def.ask;
            player_pays += new_item.count * item_price;
            has_changes = true;
        }

        let npc_pays = 0;
        for (const new_item of new_npc_items) {
            const item_price = new_item.def.bid;
            npc_pays += new_item.count * item_price;
            has_changes = true;
        }
        
        const new_player_gold = this.originalPlayerGold - player_pays + npc_pays;
        const new_npc_gold = this.originalNpcGold + player_pays - npc_pays;

        return { new_player_gold, new_npc_gold, has_changes };
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

        let label, totalPrice, unitPrice, color;
        if (isCurrentlyOnNpcSide) {
            const new_npc_items = this.npc_slot_grid.getTradedForItems(this.player_slot_grid);
            if (new_npc_items.includes(itemInst)) {
                label = "Selling";
                totalPrice = itemInst.def.bid * itemInst.count;
                unitPrice = itemInst.def.bid;
                color = "#ffeb3b";
            } else {
                label = "Buy";
                totalPrice = itemInst.def.ask * itemInst.count;
                unitPrice = itemInst.def.ask;
                color = "#ffeb3b";
            }
        } else {
            const new_player_items = this.player_slot_grid.getTradedForItems(this.npc_slot_grid);
            if (new_player_items.includes(itemInst)) {
                label = "Buying";
                totalPrice = itemInst.def.ask * itemInst.count;
                unitPrice = itemInst.def.ask;
                color = "#ffeb3b";
            } else {
                label = "Sell";
                totalPrice = itemInst.def.bid * itemInst.count;
                unitPrice = itemInst.def.bid;
                color = "#ffeb3b";
            }
        }
        
        return { label, totalPrice, unitPrice, color };
    }
}
