import { SlotGridUI } from "./slot_grid_ui.js";

export class TradeUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.player = null;
        this.npc = null;
        this.onOpen = onOpen;
        this.onClose = onClose;

        this.container = document.getElementById('tradeViewer');
        this.closeBtn = document.getElementById('closeTrade');
        this.tradeBtn = document.getElementById('tradeBtn');
        this.cancelBtn = document.getElementById('cancelTradeBtn');
        this.resetBtn = document.getElementById('resetTradeBtn');

        this.player_slot_grid = new SlotGridUI(true, "playerSlotGrid",
            "tradePlayerGoldAmount", () => this.onGridsChanged());

        this.npc_slot_grid = new SlotGridUI(false, "npcSlotGrid",
            "tradeNpcGoldAmount", () => this.onGridsChanged());

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

        this.player_slot_grid.activate(this.player, this.npc_slot_grid, this);
        this.npc_slot_grid.activate(this.npc, this.player_slot_grid, this);

        const headerTitle = document.querySelector('#tradeViewer .inventory-viewer-header h2');
        headerTitle.textContent = `Trade: ${this.npc.display_name}`;

        this.container.classList.add('is-active');
        this.onOpen();

        this.refreshGrids();
        this.updateTradeButton(false);
    }

    deactivate() {
        this.player = null;
        this.npc = null;
        
        this.player_slot_grid.deactivate();
        this.npc_slot_grid.deactivate();

        this.container.classList.remove('is-active');
        this.onClose();
    }

    resetTrade() {
        if (!this.player || !this.npc) return;

        this.player_slot_grid.resetInventory();
        this.npc_slot_grid.resetInventory();

        this.refreshGrids();
        this.updateTradeButton(false);
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
        let has_changes = false;
        const new_player_items =
            this.player_slot_grid.getPendingNonFungibleItems(this.npc_slot_grid);
        const new_npc_items =
            this.npc_slot_grid.getPendingNonFungibleItems(this.player_slot_grid);
        if (new_player_items.length || new_npc_items.length) has_changes = true;
        
        let player_pays = 0;
        for (const new_item of new_player_items) {
            const item_price = new_item.def.ask;
            player_pays += new_item.count * item_price;
        }

        let npc_pays = 0;
        for (const new_item of new_npc_items) {
            const item_price = new_item.def.bid;
            npc_pays += new_item.count * item_price;
        }

        const fungible_deltas = this.player_slot_grid.getPendingFungibleItemDeltas();
        for (const [map_key, count] of fungible_deltas) {
            if (count < 0) {
                const item_price = map_key.bid;
                npc_pays -= count * item_price;
                has_changes = true
            } else if (count > 0) {
                const item_price = map_key.ask;
                player_pays += count * item_price;
                has_changes = true
            }
        }
        
        this.player.gold = this.player_slot_grid.orig_gold - player_pays + npc_pays;
        this.npc.gold = this.npc_slot_grid.orig_gold + player_pays - npc_pays;

        this.refreshGrids();
        this.updateTradeButton(has_changes);
    }

    updateTradeButton(has_changes) {
        this.tradeBtn.disabled = !(has_changes &&
            this.player.gold >= 0 && this.npc.gold >= 0);
        this.resetBtn.disabled = !has_changes;
    }
}
