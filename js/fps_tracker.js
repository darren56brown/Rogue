export class FPSTracker {
    constructor() {
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.currentFps = 0;
        this.lastUpdateTime = 0;
    }

    // Call this once at startup (with a proper timestamp)
    init(startTime) {
        this.lastFpsTime = startTime;
        this.lastUpdateTime = startTime;
    }

    // Call this every frame from your main loop
    update(currentTime) {
        this.frameCount++;

        const timeSinceLast = currentTime - this.lastFpsTime;

        if (timeSinceLast >= 1000) {
            this.currentFps = Math.round(this.frameCount * 1000 / timeSinceLast);
            this.frameCount = 0;
            this.lastFpsTime = currentTime;
        }

        this.lastUpdateTime = currentTime;
    }

    // Simple getter if you want to access FPS value elsewhere
    getFPS() {
        return this.currentFps;
    }

    // Draw method — only called when you want to show it
    render(ctx, x = 20, y = 20) {
        ctx.save();

        ctx.font = "bold 26px 'Courier New', monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        const text = `FPS: ${this.currentFps}`;

        // Black outline
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 6;
        ctx.strokeText(text, x, y);

        // White fill
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, x, y);

        ctx.restore();
    }
}
