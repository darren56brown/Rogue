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

        this.isActive = false;
        this.currentNpc = null;
        this.conversation = null;
        this.portraitSpriteSheet = null;   // static idle frame

        this.initEvents();
    }

    initEvents() {
        // Close button (early exit allowed, but we still save progress)
        document.getElementById('closeConversation').onclick = () => this.endConversation();

        // Goodbye button when conversation naturally ends
        this.goodbyeBtn.onclick = () => this.endConversation();
    }

    async startConversation(npc) {
        if (!npc || !npc.conversation || !npc.conversation.loaded) {
            console.warn("No conversation available for this NPC");
            return;
        }

        this.deactivate(); // safety

        this.currentNpc = npc;
        this.conversation = npc.conversation;

        // Restore any previously completed branches from localStorage
        //const saveKey = `conv_state_${npc.conversationKey || 'unknown'}`;
        //const savedStr = localStorage.getItem(saveKey);
        //const savedState = savedStr ? JSON.parse(savedStr) : null;
        const savedState = null;

        this.conversation.start(null, savedState);   // starts at root, restores visited

        // Set up static portrait (idle facing down, like Stardew)
        const spriteImg = this.imageLibrary.get(npc.sprite_image_name);
        if (spriteImg) {
            this.portraitSpriteSheet = new SpriteSheet(spriteImg);
            this.portraitSpriteSheet.setAction("Stand");
            this.portraitSpriteSheet.setDirection("Down");
            this.portraitSpriteSheet.setIsIdle(true);
            this.renderPortrait();
        }

        this.npcNameEl.textContent = npc.sprite_image_name === "orc_base" 
            ? "Blacksmith Bob"   // you can make this dynamic later via NPC property
            : "Villager";

        this.isActive = true;
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
        if (!this.conversation) return;

        // NPC text
        const text = this.conversation.getCurrentNpcText() || "…";
        this.npcTextEl.textContent = text;

        // Choices
        this.choicesContainer.innerHTML = '';
        const available = this.conversation.getAvailableChoices();

        if (available.length > 0) {
            this.endFooter.style.display = 'none';
            this.choicesContainer.style.display = 'flex';
            available.forEach((choice, index) => {
                const btn = document.createElement('button');
                btn.className = 'choice-btn';
                btn.textContent = choice.playerText;
                btn.onclick = () => this.handleChoiceClick(index);
                this.choicesContainer.appendChild(btn);
            });
        } else {
            // Conversation ended
            this.endFooter.style.display = 'block';
            this.choicesContainer.style.display = 'none';
        }
    }

    handleChoiceClick(choiceIndex) {
        if (!this.conversation) return;
        const success = this.conversation.selectChoice(choiceIndex);
        if (success) {
            this.refreshUI();
        }
    }

    endConversation() {
        if (!this.conversation || !this.currentNpc) return;

        // Persist the visited state so choices stay retired forever
        const saveKey = `conv_state_${this.currentNpc.conversationKey || 'unknown'}`;
        localStorage.setItem(saveKey, JSON.stringify(this.conversation.getState()));

        this.isActive = false;
        this.container.classList.remove('is-active');
        this.onClose();

        // Clean up
        this.currentNpc = null;
        this.conversation = null;
        this.portraitSpriteSheet = null;
    }

    deactivate() {
        if (this.isActive) this.endConversation();
    }
}