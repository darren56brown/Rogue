import { SlotGridUI } from "./slot_grid_ui.js";

export class TradeUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.player = null;
        this.npc = null;
        this.onOpen = onOpen;
        this.onClose = onClose;

        this.originalPlayerInventory = [];
        this.originalNpcInventory = [];

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
                this.deactivate(); // changes already applied
            }
        };
    }

    activate(player, npc) {
        if (player == null || this.player != null) return;
        if (npc == null || this.npc != null) return;

        this.player = player;
        this.npc = npc;

        // === SAVE ORIGINAL STATE FOR CANCEL ===
        this.originalPlayerInventory = this.player.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );
        this.originalNpcInventory = this.npc.inventorySlots.map(slot => 
            slot ? slot.clone() : null
        );

        this.player_slot_grid.activate(this.player, this.npc);
        this.npc_slot_grid.activate(this.npc, this.player);

        const headerTitle = document.querySelector('#tradeViewer .inventory-viewer-header h2');
        headerTitle.textContent = `Trade: ${this.npc.display_name}`;

        this.container.classList.add('is-active');
        this.onOpen();

        this.refreshGrids();
        this.updateTradeButton(); // start disabled
    }

    deactivate() {
        this.player = null;
        this.npc = null;
        this.originalPlayerInventory = [];
        this.originalNpcInventory = [];

        this.player_slot_grid.deactivate();
        this.npc_slot_grid.deactivate();

        this.container.classList.remove('is-active');
        this.onClose();
    }

    cancelTrade() {
        if (!this.player || !this.npc) return;

        // Restore original inventories
        this.player.inventorySlots = this.originalPlayerInventory.map(slot => 
            slot ? slot.clone() : null
        );
        this.npc.inventorySlots = this.originalNpcInventory.map(slot => 
            slot ? slot.clone() : null
        );

        this.deactivate();
    }

    isActive() {
        return this.player != null;
    }

    refreshGrids() {
        this.player_slot_grid.refreshGrid();
        this.npc_slot_grid.refreshGrid();
    }

    // Called after every drag/drop
    onGridsChanged() {
        this.refreshGrids();
        this.updateTradeButton();
    }

    updateTradeButton() {
        const can = this.canTrade();
        this.tradeBtn.disabled = !can;
    }

    // ==================== TRADE VALIDATION ====================
    canTrade() {
        // Example: return true if any change occurred (you can make this stricter)
        for (let i = 0; i < 40; i++) {
            const origP = this.originalPlayerInventory[i];
            const currP = this.player.inventorySlots[i];
            
            if ((origP && !currP) || (!origP && currP)) return true;
            if (origP && currP && 
                (origP.def.id !== currP.def.id || origP.count !== currP.count)) {
                return true;
            }

            const origN = this.originalNpcInventory[i];
            const currN = this.npc.inventorySlots[i];
            
            if ((origN && !currN) || (!origN && currN)) return true;
            if (origN && currN && 
                (origN.def.id !== currN.def.id || origN.count !== currN.count)) {
                return true;
            }
        }
        return false; // no changes = can't trade
    }
}
