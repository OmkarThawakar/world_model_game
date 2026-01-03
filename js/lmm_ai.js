"use strict";

/**
 * LMM Agent System
 * Handles telemetry recording and AI level generation
 */

// --- TELEMETRY RECORDER ---
class GameRecorder {
    constructor() {
        this.history = []; // Array of frame data
        this.startTime = 0;
        this.events = []; // Deaths, coin pickups, etc.
    }

    start() {
        this.history = [];
        this.events = [];
        this.startTime = Date.now();
        console.log("[Recorder] Started recording session.");
    }

    // Called every frame
    recordFrame(player, inputKeys) {
        // Record sparse data to save memory
        // Only record if input changes or significant position change? 
        // For now, record every 10th frame or similar? No, full resolution analysis for AI might be needed.
        // Let's stick to basic periodic snapshots.
        this.history.push({
            t: Date.now() - this.startTime,
            x: Math.round(player.pos.x * 100) / 100,
            y: Math.round(player.pos.y * 100) / 100,
            state: player.state,
            input: { ...inputKeys } // Snapshot of keys
        });
    }

    logEvent(type, data) {
        this.events.push({
            t: Date.now() - this.startTime,
            type: type,
            data: data
        });
        console.log(`[Recorder] Event: ${type}`, data);
    }

    getSummary() {
        const duration = (Date.now() - this.startTime) / 1000;
        return {
            duration: duration,
            frameCount: this.history.length,
            events: this.events
        };
    }
}

// --- LMM WORLD MODEL AGENT ---
class LMMAgent {
    constructor() {
        this.difficultyTier = 1;
    }

    /**
     * Generates the next level based on user history.
     * @param {Object} historySummary - Summary from GameRecorder
     * @returns {Promise<Array<string>>} - A promise resolving to the Level Plan (array of strings)
     */
    async generateNextLevel(historySummary) {
        console.log("[LMM Agent] Analyzing user history...", historySummary);

        // --- MOCK LMM LOGIC ---
        // In a real implementation, this would send 'historySummary' (JSON) to an LLM endpoint.
        // The LLM would return a Grid representation of the level.

        // Simulate "Thinking" delay
        await new Promise(r => setTimeout(r, 1000));

        this.difficultyTier++;
        console.log(`[LMM Agent] Generating Level Tier ${this.difficultyTier}...`);

        // Heuristic: If they died a lot (Event type 'death'), keep difficulty same.
        // If they breezed through, increase.
        const deaths = historySummary.events.filter(e => e.type === 'death').length;
        if (deaths > 2) {
            console.log("[LMM Agent] Player struggled. Simplifying next level...");
            this.difficultyTier = Math.max(1, this.difficultyTier - 1);
        }

        return this.proceduralGen(this.difficultyTier);
    }

    // Improve procedural generation to be more structured based on importance of "difficulty"
    proceduralGen(tier) {
        console.log(`[LMM Agent] Generating Tier ${tier} level...`);
        const width = 20 + (tier * 10);
        const height = 15;
        let grid = [];

        // Initialize empty grid
        for (let y = 0; y < height; y++) {
            grid[y] = " ".repeat(width).split("");
        }

        // Floor (some gaps for higher tiers)
        for (let x = 0; x < width; x++) {
            if (tier > 1 && Math.random() < 0.1 && x > 2 && x < width - 2) {
                // Gap
            } else {
                grid[height - 1][x] = "x";
            }
        }

        // Walls at ends
        for (let i = 0; i < height; i++) {
            grid[i][0] = "x";
            grid[i][width - 1] = "x";
        }

        // Platforms & Hazards
        let currentX = 5; // Start a bit after player
        let currentY = height - 2;

        let minJump = 2;
        let maxJump = 5; // Playable jump limit

        // Ensure start area is safe
        for (let x = 0; x < 10; x++) {
            grid[height - 1][x] = "x";
        }

        while (currentX < width - 5) {
            // Determine random gap and height change
            const gap = minJump + Math.floor(Math.random() * (maxJump - minJump + 1));
            const yChange = Math.floor(Math.random() * 5) - 2; // -2 to +2 (Safe delta)

            currentX += gap;
            currentY = Math.max(4, Math.min(height - 2, currentY - yChange)); // Keep in bounds

            // Check if gap is too large for height difference (simplified check)
            // If going UP, gap must be smaller.
            if (yChange > 1) currentX -= 1;

            // Place platform
            let platLen = 3 + Math.floor(Math.random() * 4);
            for (let p = 0; p < platLen; p++) {
                if (currentX + p < width - 1) {
                    grid[currentY][currentX + p] = "x";

                    // Add hazard on top? (Tier check)
                    if (tier > 1 && Math.random() < 0.3) {
                        // Ensure passable: don't put lava on single block platform if it's the landing spot
                        if (p > 0 && p < platLen - 1) {
                            grid[currentY - 1][currentX + p] = "!"; // Static Lava
                        }
                    }
                }
            }

            // Advance past platform
            currentX += platLen;

            // Coins
            if (Math.random() < 0.5) {
                let coinY = currentY - 2;
                let coinX = currentX - 2;
                if (coinX < width - 1 && coinY > 0) grid[coinY][coinX] = "o";
            }
        }

        // Player Start
        grid[height - 2][1] = "@";

        return grid.map(row => row.join(""));
    }
}

// Export global instances
window.gameRecorder = new GameRecorder();
window.lmmAgent = new LMMAgent();
