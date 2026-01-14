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
    recordFrame(level, inputKeys) {
        // Record sparse data to save memory
        // Only record if input changes or significant position change? 
        // For now, record every 10th frame or similar? No, full resolution analysis for AI might be needed.
        // Let's stick to basic periodic snapshots.
        this.history.push({
            t: Date.now() - this.startTime,
            visual_state: level.getSnapshot(),
            state: level.player.state,
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

    async saveHistory() {
        const data = {
            ...this.getSummary(),
            history: this.history
        };

        try {
            console.log("[Recorder] Saving history...", data);
            const response = await fetch('/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            console.log("[Recorder] Save result:", result);
        } catch (e) {
            console.error("[Recorder] Failed to save history:", e);
        }
    }
}

// --- LMM WORLD MODEL AGENT ---
class LMMAgent {
    constructor() {
        this.difficultyTier = 1;
        this.physicsKnowledge = `
You are the Architect of a 2D Platformer World.
Your goal is to design levels that test the player's understanding of this world's physics.

### WORLD PHYSICS & LAWS
1. **Gravity**: Acts downwards (Y+). The player falls if no block ('x') is beneath them.
2. **Movement**: 
   - Player ('@') moves Left/Right with velocity. 
   - Jump: Impulse 'Up' (Y-). requires ground contact.
   - Air Control: Movement is possible while airborne but momentum is conserved.
3. **Collision**:
   - 'x' (Wall/Floor): Solid blocks. Blocks movement.
   - '!' (Lava): Fatal on contact. Resets level/Life lost.
   - 'o' (Coin): Collectible.
   - ' ' (Empty): Passable air.
4. **Dynamics**:
   - Moving Lava ('=', '|', 'v'): Predictable linear motion.
   - Wobble: Coins float and wobble slightly.

### GRID SYMBOLOGY
- @ : Player Start (Required)
- x : Solid Block (Walls, Floor, Platforms)
- ! : Static Lava (Hazard)
- = : Horizontal Moving Lava
- | : Vertical Moving Lava
- v : Dripping Lava
- o : Coin (Goal/Objective)
-   : Empty Space
`;
    }

    /**
     * Learning Step: Updates the Physics Knowledge based on observations.
     */
    learnFromHistory(historySummary, outcome) {
        let observation = "";
        const events = historySummary.events || [];
        const deaths = events.filter(e => e.type === 'death').length;
        const duration = historySummary.duration || 0;

        if (outcome === 'win') {
            observation = `[OBSERVATION: Player Mastered this Level. Duration: ${duration.toFixed(1)}s. Deaths: ${deaths}. Conclusion: Physics laws concerning jump arc and gravity are understood.]`;
        } else {
            observation = `[OBSERVATION: Player Failed Level. Duration: ${duration.toFixed(1)}s. Deaths: ${deaths}. Conclusion: Player struggled with environmental hazards. Potentially miscalculated gravity or collision bounds.]`;
        }

        // Simulating "Learning" by appending new knowledge
        this.physicsKnowledge += "\n" + observation;
    }

    printEpisodeSummary(historySummary, outcome) {
        console.log("==========================================");
        console.log(`          EPISODE SUMMARY (${outcome.toUpperCase()})          `);
        console.log("==========================================");
        const summaryText = `Result: ${outcome.toUpperCase()}\nDuration: ${historySummary.duration.toFixed(2)}s\nEvents: ${historySummary.events.length} (Deaths: ${historySummary.events.filter(e => e.type === 'death').length})`;

        console.log(summaryText);

        // Update Dashboard UI
        const dashboard = document.getElementById('game-dashboard');
        const summaryDisplay = document.getElementById('level-summary');
        const physicsDisplay = document.getElementById('physics-laws-display');
        const physicsSection = document.getElementById('physics-section');

        if (dashboard && summaryDisplay) {
            dashboard.classList.remove('hidden');
            summaryDisplay.textContent = summaryText;

            // Show Physics Laws if Game Over or specifically requested
            if (outcome === 'loss' || outcome === 'win') {
                if (physicsSection && physicsDisplay) {
                    physicsSection.classList.remove('hidden');
                    physicsDisplay.textContent = this.physicsKnowledge;
                }
            } else {
                if (physicsSection) physicsSection.classList.add('hidden');
            }
        }

        if (outcome === 'loss') {
            console.log("\n>>> UPDATED WORLD LAWS (LEARNED) <<<");
            console.log(this.physicsKnowledge);
        }
        console.log("==========================================");
    }

    /**
     * Generates the next level based on user history.
     * @param {Object} historySummary - Summary from GameRecorder
     * @param {Object} lastResult - { outcome: 'win' | 'loss' }
     * @returns {Promise<Array<string>>} - A promise resolving to the Level Plan (array of strings)
     */
    async generateNextLevel(historySummary, lastResult) {
        console.log("[LMM Agent] Analyzing user history...", historySummary);

        // 1. Learn from previous episode
        this.learnFromHistory(historySummary, lastResult.outcome);

        // 2. Print Summary
        this.printEpisodeSummary(historySummary, lastResult.outcome);

        // --- DIFFICULTY ADJUSTMENT ---
        if (lastResult.outcome === 'win') {
            this.difficultyTier++;
            console.log(`[LMM Agent] Player Won! Increasing difficulty to Tier ${this.difficultyTier}`);
        } else if (lastResult.outcome === 'loss') {
            this.difficultyTier = Math.max(1, this.difficultyTier - 1);
            console.log(`[LMM Agent] Player struggled. Decreasing difficulty to Tier ${this.difficultyTier}`);
        }

        // --- WORLD MODEL PROMPT CONSTRUCTION ---
        const prompt = `
${this.physicsKnowledge}

CURRENT CONTEXT:
- Difficulty Tier: ${this.difficultyTier}
- Player Status: ${lastResult.outcome === 'win' ? "Successfully mastered previous physics constraints." : "Failed to overcome environment challenges."}
- Last Metadata: Duration ${historySummary?.duration}s, Events: ${JSON.stringify(historySummary?.events)}

TASK:
Based on the Updated Laws of Physics (above) and the player's performance, generate a new 2D grid level.
${lastResult.outcome === 'win'
                ? "CONSTRAINT: Introduce more complex arrangements of 'x' (walls) and '!' (lava) that require precise jump timing."
                : "CONSTRAINT: Simplify the terrain. Reduce gap widths and lava hazards to allow for safer traversal."}
`;

        console.log("--- GENERATED WORLD MODEL PROMPT ---");
        console.log(prompt);
        console.log("------------------------------------");

        // Simulate "Thinking" delay
        await new Promise(r => setTimeout(r, 1000));

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
