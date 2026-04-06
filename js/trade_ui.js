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

        this.player_slot_grid = new SlotGridUI("playerSlotGrid",
            "tradePlayerGoldAmount", "tradeItemDescription",  
            () => this.refreshGrids());
        this.npc_slot_grid = new SlotGridUI("npcSlotGrid",
            "tradeNpcGoldAmount", "tradeItemDescription",  
            () => this.refreshGrids());

        this.initEvents();
    }

    initEvents() {
        this.closeBtn.onclick = () => this.deactivate();
    }

    activate(player, npc) {
        if (player == null || this.player != null) return;
        if (npc == null || this.npc != null) return;

        this.player = player;
        this.npc = npc;

        this.player_slot_grid.activate(this.player, this.npc);
        this.npc_slot_grid.activate(this.npc, this.player);

        const headerTitle = document.querySelector('#tradeViewer .inventory-viewer-header h2');
        headerTitle.textContent = `Trade: ${this.npc.display_name}`;

        this.container.classList.add('is-active');
        this.onOpen();

        this.refreshGrids();
    }

    deactivate() {
        this.player = null;
        this.npc = null;

        this.player_slot_grid.deactivate();
        this.npc_slot_grid.deactivate();

        this.container.classList.remove('is-active');
        this.onClose();
    }

    isActive() {
        return this.player != null;
    }

    refreshGrids(slot_grid, character) {
        this.player_slot_grid.refreshGrid();
        this.npc_slot_grid.refreshGrid();
    }

}