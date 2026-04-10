// NEW FILE: conversation_ui.js
import { SpriteSheet } from './sprite_sheet.js';

export class ConversationUI {
    constructor(imageLibrary, onOpen, onClose) {
        this.imageLibrary = imageLibrary;
        this.onOpen = onOpen;
        this.onClose = onClose;

        this.container = document.getElementById('conversationPanel');
        this.npcNameEl = document.getElementById('convNpcName');
        this.portraitCanvas = document.getElementById('convPortraitCanvas');
        this.portraitCtx = this.portraitCanvas.getContext('2d');
        this.portraitCtx.imageSmoothingEnabled = false;
        this.npcTextEl = document.getElementById('npcText');
        this.choicesContainer = document.getElementById('choicesContainer');
        this.endFooter = document.getElementById('endConversationFooter');
        this.goodbyeBtn = document.getElementById('goodbyeButton');
        this.closeBtn = document.getElementById('closeConversation');

        this.current_npc = null;
        this.portraitSpriteSheet = null;   // static idle frame

        this.initEvents();
    }

    initEvents() {
        this.closeBtn.onclick = () => this.endConversation();
        this.goodbyeBtn.onclick = () => this.endConversation();
    }

    async startConversation(npc) {
        if (this.current_npc || npc == null) return;
        
        if (!npc.conversation.loaded) {
            try {
                await npc.conversation.ensureLoaded();
            } catch (err) {
                console.error("Failed to load conversation", err);
                return;
            }
        }

        this.current_npc = npc;
        const conversation = this.current_npc.conversation;

        conversation.start();

        // Portrait setup
        const spriteImg = this.imageLibrary.get(npc.sprite_image_name);
        if (spriteImg) {
            this.portraitSpriteSheet = new SpriteSheet(spriteImg);
            this.portraitSpriteSheet.setAction("Stand");
            this.portraitSpriteSheet.setDirection("Down");
            this.portraitSpriteSheet.setIsIdle(true);
            this.renderPortrait();
        }

        this.npcNameEl.textContent = npc.displayName || "Villager";

        this.container.classList.add('is-active');
        this.onOpen();
        this.refreshUI();
    }

    renderPortrait() {
        if (!this.portraitSpriteSheet) return;
        this.portraitCtx.clearRect(0, 0, 128, 128);
        this.portraitSpriteSheet.draw(this.portraitCtx, 0, 0, 128, 128);
    }

    refreshUI() {
        const conversation = this.current_npc.conversation;
        
        // NPC text
        const text = conversation.getCurrentNpcText() || "…";
        this.npcTextEl.textContent = text;

        // Choices
        this.choicesContainer.innerHTML = '';
        const available = conversation.getAvailableChoices();

        if (available.length > 0) {
            this.endFooter.style.display = 'none';
            this.choicesContainer.style.display = 'flex';
            available.forEach((choice) => {
                const btn = document.createElement('button');
                btn.className = 'choice-btn';
                btn.textContent = choice.text;
                btn.onclick = () => this.handleChoiceClick(choice.id);
                this.choicesContainer.appendChild(btn);
            });
        } else {
            this.endFooter.style.display = 'block';
            this.choicesContainer.style.display = 'none';
        }
    }   

    handleChoiceClick(choice_id) {
        const conversation = this.current_npc.conversation;
        const success = conversation.selectChoice(choice_id);
        if (success) {
            if (conversation.init_trade) {
                this.endConversation();
                return;
            }
            this.refreshUI();
        }
    }

    endConversation() {
        let exit_status = "okay";
        if (this.current_npc.conversation.init_trade) exit_status = "init_trade";
        this.container.classList.remove('is-active');

        this.onClose(exit_status, this.current_npc);

        this.current_npc = null;
        this.portraitSpriteSheet = null;
    }

}