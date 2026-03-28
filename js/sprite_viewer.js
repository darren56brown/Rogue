import {vec2D} from './vec2D.js';

export class SpriteViewer {
    constructor(image, onOpen, onClose) {
        this.container = document.getElementById('spriteViewer');
        this.canvas = document.getElementById('viewerCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Use the image passed from the ImageLibrary
        this.spriteSheet = image;
        this.onOpen = onOpen;
        this.onClose = onClose;

        // Hardcoded Animation Rules (Edit these for your sheet)
        this.animations = [
            { name: "Idle Down",   frames: 4, row: 0,  startCol: 0 },
            { name: "Walk Right",  frames: 8, row: 11, startCol: 1 },
            { name: "Walk Left",   frames: 8, row: 9,  startCol: 1 },
            { name: "Walk Up",     frames: 8, row: 8,  startCol: 1 },
            { name: "Walk Down",   frames: 8, row: 10, startCol: 1 },
            { name: "Attack R",    frames: 4, row: 5,  startCol: 0 },
            { name: "Attack L",    frames: 4, row: 6,  startCol: 0 },
            { name: "Attack U",    frames: 4, row: 7,  startCol: 0 },
            { name: "Attack D",    frames: 4, row: 8,  startCol: 0 },
            { name: "Death",       frames: 5, row: 9,  startCol: 0 },
            { name: "Hurt",        frames: 2, row: 10, startCol: 0 },
            { name: "Spell",       frames: 7, row: 11, startCol: 0 },
            { name: "Pick Up",     frames: 3, row: 12, startCol: 0 },
            { name: "Jump",        frames: 5, row: 13, startCol: 0 },
            { name: "Emote",       frames: 4, row: 14, startCol: 0 }
        ];

        this.currentIndex = 1; // Default: Walk Right
        this.currentFrame = 0;
        this.spriteSize = vec2D(64, 64);  // Adjust if your frames are 16 or 64
        this.lastUpdate = 0;
        this.frameInterval = 100; // ms per frame
        this.isActive = false;

        this.initUIEvents();
    }

    initUIEvents() {
        document.getElementById('closeViewer').onclick = () => this.close();
        document.getElementById('prevAnim').onclick = () => this.changeAnim(-1);
        document.getElementById('nextAnim').onclick = () => this.changeAnim(1);
    }

    toggle() {
        this.isActive ? this.close() : this.open();
    }

    open() {
        this.isActive = true;
        this.container.classList.add('is-active');
        if (this.onOpen) this.onOpen();
        this.updateUI();
        this.animate();
    }

    close() {
        if (!this.isActive) return;
        this.isActive = false;
        this.container.classList.remove('is-active');
        if (this.onClose) this.onClose();
    }

    changeAnim(dir) {
        this.currentIndex = (this.currentIndex + dir + this.animations.length) % this.animations.length;
        this.currentFrame = 0;
        this.updateUI();
    }

    updateUI() {
        const anim = this.animations[this.currentIndex];
        document.getElementById('animNameText').innerText = anim.name;
        document.getElementById('animDetailsText').innerText = `Row ${anim.row} | ${anim.frames} Frames`;
    }

    animate(timestamp = 0) {
        if (!this.isActive) return;

        if (timestamp - this.lastUpdate > this.frameInterval) {
            const anim = this.animations[this.currentIndex];
            this.currentFrame = (this.currentFrame + 1) % anim.frames;
            this.lastUpdate = timestamp;
            this.draw();
        }
        requestAnimationFrame((t) => this.animate(t));
    }

    draw() {
        const anim = this.animations[this.currentIndex];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const sx = (anim.startCol + this.currentFrame) * this.spriteSize.x;
        const sy = anim.row * this.spriteSize.y;

        this.ctx.drawImage(
            this.spriteSheet,
            sx, sy, this.spriteSize.x, this.spriteSize.y,
            0, 0, this.canvas.width, this.canvas.height
        );
    }
}
