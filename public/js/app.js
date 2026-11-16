/**
 * Main Application Controller (app.js) - Refined Light Minimalist Edition
 * Coordinates UI views, simulation state, animations, sound effects, and exports.
 */

// Presets come from presets.js (window.Presets), which keeps its list private.
// Each preset: { id, name, description, mode, osReserved, blocks, processes }.
const PRESETS = window.Presets.getAll();

const ALGO_RULES = {
    'First Fit': 'First Fit: allocate the first hole that is big enough.',
    'Best Fit': 'Best Fit: allocate the smallest hole that is big enough.',
    'Worst Fit': 'Worst Fit: allocate the largest available hole.'
};

class AppController {
    constructor() {
        this.currentTab = 'setup';
        this.currentMode = 'fixed'; // 'fixed' or 'dynamic'
        this.activeAlgo = 'First Fit';
        this.osReserved = 0;
        this.activePresetId = PRESETS[0].id;

        // Current workload
        this.blocks = [...PRESETS[0].blocks];
        this.processes = [...PRESETS[0].processes];
        this.currentMode = PRESETS[0].mode || 'fixed';
        this.osReserved = PRESETS[0].osReserved || 0;

        // Simulation state
        this.steps = [];
        this.currentStepIdx = -1;
        this.isPlaying = false;
        this.playTimer = null;
        this.playbackSpeed = 800; // ms

        // Visualizers
        this.setupVisualizer = new MemoryVisualizer('setup-preview-map', 'setup-preview-ruler');
        this.simVisualizer = new MemoryVisualizer('sim-live-map', 'sim-live-ruler');
        this.resultsVisualizer = new MemoryVisualizer('results-final-map', 'results-final-ruler');

        this.init();
    }

    init() {
        this.syncModeControls();
        this.bindEvents();
        this.bindKeyboardShortcuts();
        this.renderPresetCards();
        this.renderSetupWorkload();
        this.runComparison();
    }

    bindEvents() {
        // Segmented Navigation Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
                soundFX.playClick();
            });
        });

        // Sound Switcher
        const soundToggle = document.getElementById('btn-sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', () => {
                const isEnabled = soundFX.toggle();
                const iconEl = document.getElementById('sound-icon');
                const statusEl = document.getElementById('lbl-sound-status');
                if (iconEl) iconEl.innerText = isEnabled ? '🔊' : '🔇';
                if (statusEl) statusEl.innerText = isEnabled ? 'Sound: ON' : 'Sound: OFF';
                if (isEnabled) soundFX.playClick();
            });
        }

        // Mode Radio Selector (Fixed vs Dynamic)
        const radioFixed = document.getElementById('radio-mode-fixed');
        const radioDynamic = document.getElementById('radio-mode-dynamic');
        if (radioFixed && radioDynamic) {
            radioFixed.addEventListener('change', () => {
                if (radioFixed.checked) {
                    this.currentMode = 'fixed';
                    this.renderSetupWorkload();
                    soundFX.playClick();
                }
            });
            radioDynamic.addEventListener('change', () => {
                if (radioDynamic.checked) {
                    this.currentMode = 'dynamic';
                    this.renderSetupWorkload();
                    soundFX.playClick();
                }
            });
        }

        // OS Reserved
        const osInput = document.getElementById('input-os-reserved');
        if (osInput) {
            osInput.addEventListener('input', (e) => {
                this.osReserved = Math.max(0, parseInt(e.target.value) || 0);
                this.updateSetupPreview();
            });
        }

        // Add Block
        const btnAddBlock = document.getElementById('btn-add-block');
        if (btnAddBlock) {
            btnAddBlock.addEventListener('click', () => {
                const val = parseInt(document.getElementById('input-block-size').value);
                if (val > 0) {
                    this.blocks.push(val);
                    this.activePresetId = 'custom';
                    this.renderPresetCards();
                    this.renderSetupWorkload();
                    soundFX.playClick();
                }
            });
        }

        // Add Process
        const btnAddProc = document.getElementById('btn-add-proc');
        if (btnAddProc) {
            btnAddProc.addEventListener('click', () => {
                const val = parseInt(document.getElementById('input-proc-size').value);
                if (val > 0) {
                    this.processes.push(val);
                    this.activePresetId = 'custom';
                    this.renderPresetCards();
                    this.renderSetupWorkload();
                    soundFX.playClick();
                }
            });
        }

        // Randomize
        const btnRandom = document.getElementById('btn-randomize');
        if (btnRandom) {
            btnRandom.addEventListener('click', () => {
                const bCount = Math.floor(Math.random() * 3) + 4;
                const pCount = Math.floor(Math.random() * 3) + 4;
                this.blocks = Array.from({ length: bCount }, () => Math.floor(Math.random() * 6 + 1) * 100);
                this.processes = Array.from({ length: pCount }, () => Math.floor(Math.random() * 5 + 1) * 80 + 20);
                this.activePresetId = 'custom';
                this.renderPresetCards();
                this.renderSetupWorkload();
                soundFX.playClick();
            });
        }

        // Clear All
        const btnClear = document.getElementById('btn-clear-all');
        if (btnClear) {
            btnClear.addEventListener('click', () => {
                this.blocks = [];
                this.processes = [];
                this.activePresetId = 'custom';
                this.renderPresetCards();
                this.renderSetupWorkload();
                soundFX.playClick();
            });
        }

        // Sort Processes Descending (Chapter 5 Slide 9 Q3 Test)
        const btnSort = document.getElementById('btn-sort-procs-desc');
        if (btnSort) {
            btnSort.addEventListener('click', () => {
                this.processes.sort((a, b) => b - a);
                this.renderSetupWorkload();
                soundFX.playClick();
            });
        }

        // Start Simulation Hero Button
        const btnStartSim = document.getElementById('btn-start-sim');
        if (btnStartSim) {
            btnStartSim.addEventListener('click', () => {
                if (this.blocks.length === 0 || this.processes.length === 0) {
                    alert('Add at least one memory block and one process first.');
                    return;
                }
                this.switchTab('sim');
                this.prepareSimulation();
                soundFX.playClick();
            });
        }

        // Simulation Algorithm Selector
        const algoSelect = document.getElementById('sim-algo-select');
        if (algoSelect) {
            algoSelect.addEventListener('change', (e) => {
                this.activeAlgo = e.target.value;
                this.prepareSimulation();
                soundFX.playClick();
            });
        }

        // Step Controls
        const btnNext = document.getElementById('btn-sim-next');
        const btnPrev = document.getElementById('btn-sim-prev');
        const btnPlay = document.getElementById('btn-sim-play');
        const btnReset = document.getElementById('btn-sim-reset');
        if (btnNext) btnNext.addEventListener('click', () => this.stepForward());
        if (btnPrev) btnPrev.addEventListener('click', () => this.stepBackward());
        if (btnPlay) btnPlay.addEventListener('click', () => this.togglePlay());
        if (btnReset) btnReset.addEventListener('click', () => this.resetSim());

        // Compaction Button (Slide 10-11)
        const btnCompact = document.getElementById('btn-sim-compact');
        if (btnCompact) {
            btnCompact.addEventListener('click', () => this.triggerCompaction());
        }

        // Playback Speed Slider
        const speedSlider = document.getElementById('sim-speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.playbackSpeed = parseInt(e.target.value);
                if (this.isPlaying) {
                    clearInterval(this.playTimer);
                    this.playTimer = setInterval(() => this.stepForward(), this.playbackSpeed);
                }
            });
        }

        // Export Buttons
        const btnPdf = document.getElementById('btn-export-pdf');
        const btnCsv = document.getElementById('btn-export-csv');
        const btnJson = document.getElementById('btn-export-json');
        if (btnPdf) btnPdf.addEventListener('click', () => this.exportPDF());
        if (btnCsv) btnCsv.addEventListener('click', () => this.exportCSV());
        if (btnJson) btnJson.addEventListener('click', () => this.exportJSON());
    }

    bindKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.stepForward();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.stepBackward();
                    break;
                case 'KeyC':
                    e.preventDefault();
                    this.triggerCompaction();
                    break;
                case 'KeyR':
                    e.preventDefault();
                    this.resetSim();
                    break;
                case 'Digit1': this.switchTab('setup'); break;
                case 'Digit2': this.switchTab('sim'); break;
                case 'Digit3': this.switchTab('results'); break;
                case 'Digit4': this.switchTab('compare'); break;
                case 'Digit5': this.switchTab('chapter5'); break;
            }
        });
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabId}`);
        });

        if (tabId === 'sim') {
            this.prepareSimulation();
        } else if (tabId === 'results') {
            this.renderResults();
        } else if (tabId === 'compare') {
            this.runComparison();
        }
    }

    renderPresetCards() {
        const container = document.getElementById('presets-cards-container');
        if (!container) return;

        container.innerHTML = '';
        PRESETS.forEach((p, presetIdx) => {
            const card = document.createElement('div');
            card.className = `preset-card-item ${this.activePresetId === p.id ? 'active' : ''}`;
            if (p.description) card.title = p.description;
            const badgeText = `#${presetIdx + 1} · ${(p.mode || 'fixed').toUpperCase()}`;
            const title = p.name;
            const blocksStr = p.blocks.join(', ');
            const procsStr = p.processes.join(', ');

            card.innerHTML = `
                <span class="preset-badge">${badgeText}</span>
                <div class="preset-title">${title}</div>
                <div class="preset-meta">
                    <div>Blocks: [${blocksStr}] KB</div>
                    <div>Procs:  [${procsStr}] KB</div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.activePresetId = p.id;
                this.blocks = [...p.blocks];
                this.processes = [...p.processes];
                this.currentMode = p.mode || 'fixed';
                this.osReserved = p.osReserved || 0;
                this.syncModeControls();

                this.renderPresetCards();
                this.renderSetupWorkload();
                soundFX.playClick();
            });

            container.appendChild(card);
        });
    }

    // Keep the mode radios and OS-reserved input in sync with the current state.
    syncModeControls() {
        const radioFixed = document.getElementById('radio-mode-fixed');
        const radioDynamic = document.getElementById('radio-mode-dynamic');
        if (radioFixed && radioDynamic) {
            radioFixed.checked = (this.currentMode === 'fixed');
            radioDynamic.checked = (this.currentMode === 'dynamic');
        }
        const osInput = document.getElementById('input-os-reserved');
        if (osInput) osInput.value = this.osReserved;
    }

    renderSetupWorkload() {
        // Render blocks chips
        const blocksList = document.getElementById('blocks-chip-list');
        if (blocksList) {
            blocksList.innerHTML = '';
            this.blocks.forEach((sz, idx) => {
                const chip = document.createElement('div');
                chip.className = 'item-chip block-chip';
                chip.innerHTML = `
                    <span>B${idx + 1}: <strong>${sz}k</strong></span>
                    <button class="btn-chip-remove" title="Remove">&times;</button>
                `;
                chip.querySelector('.btn-chip-remove').addEventListener('click', () => {
                    this.blocks.splice(idx, 1);
                    this.activePresetId = 'custom';
                    this.renderPresetCards();
                    this.renderSetupWorkload();
                    soundFX.playClick();
                });
                blocksList.appendChild(chip);
            });
        }

        // Render processes chips
        const procsList = document.getElementById('procs-chip-list');
        if (procsList) {
            procsList.innerHTML = '';
            this.processes.forEach((sz, idx) => {
                const chip = document.createElement('div');
                chip.className = 'item-chip proc-chip';
                chip.innerHTML = `
                    <span>P${idx + 1}: <strong>${sz}k</strong></span>
                    <button class="btn-chip-remove" title="Remove">&times;</button>
                `;
                chip.querySelector('.btn-chip-remove').addEventListener('click', () => {
                    this.processes.splice(idx, 1);
                    this.activePresetId = 'custom';
                    this.renderPresetCards();
                    this.renderSetupWorkload();
                    soundFX.playClick();
                });
                procsList.appendChild(chip);
            });
        }

        const totalMem = this.blocks.reduce((a, b) => a + b, 0) + this.osReserved;
        const totalDem = this.processes.reduce((a, b) => a + b, 0);

        const lblTotalMem = document.getElementById('lbl-total-mem');
        const lblTotalDem = document.getElementById('lbl-total-demand');
        if (lblTotalMem) lblTotalMem.innerText = `${totalMem.toLocaleString()} KB`;
        if (lblTotalDem) lblTotalDem.innerText = `${totalDem.toLocaleString()} KB`;

        this.updateSetupPreview();
    }

    updateSetupPreview() {
        const previewBlocks = MemoryModels.buildInitialMemory(this.blocks, this.osReserved);
        this.setupVisualizer.render(previewBlocks);
    }

    prepareSimulation() {
        this.pauseSim();
        const allocator = Algorithms.getAllocator(this.activeAlgo);
        const initBlocks = MemoryModels.buildInitialMemory(this.blocks, this.osReserved);
        const initProcs = MemoryModels.buildProcesses(this.processes);

        const sim = allocator.runSimulation(initBlocks, initProcs, this.currentMode);
        this.steps = sim.steps;
        this.currentStepIdx = -1;

        // Render initial clear state
        this.simVisualizer.render(initBlocks);
        this.renderQueuePills(-1);
        this.updateStepCounter();
        this.clearCandidateTable();

        const decisionEl = document.getElementById('sim-decision-text');
        if (decisionEl) {
            decisionEl.innerHTML = `
                <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">
                    ${ALGO_RULES[this.activeAlgo] || this.activeAlgo}
                </div>
                <div style="color:var(--text-secondary); font-size:13px;">
                    Ready. Click <strong>Run All ▶</strong> or <strong>⏭ Next Step</strong> to observe allocation.
                </div>
            `;
        }
    }

    stepForward() {
        if (this.currentStepIdx + 1 < this.steps.length) {
            this.currentStepIdx++;
            this.applyStep(this.currentStepIdx);
        } else {
            this.pauseSim();
        }
    }

    stepBackward() {
        if (this.currentStepIdx > 0) {
            this.currentStepIdx--;
            this.applyStep(this.currentStepIdx);
        } else if (this.currentStepIdx === 0) {
            this.prepareSimulation();
        }
    }

    applyStep(stepIdx) {
        const step = this.steps[stepIdx];

        // Sound effect
        if (step.status === 'ALLOCATED') {
            soundFX.playAllocate();
        } else {
            soundFX.playFail();
        }

        // Render Memory Map with candidate badges & animations
        this.simVisualizer.render(step.snapshot, step.chosenBlockId, step.candidates);

        // Update Queue Pills
        this.renderQueuePills(stepIdx);

        // Update Candidate Table
        this.renderCandidateTable(step.candidates);

        // Update Decision Rationale Box
        this.renderDecisionRationale(step);

        this.updateStepCounter();
    }

    renderQueuePills(currentIdx) {
        const container = document.getElementById('sim-queue-carousel');
        if (!container) return;
        container.innerHTML = '';

        this.processes.forEach((sz, idx) => {
            const pill = document.createElement('div');
            pill.className = 'queue-proc-pill';

            if (idx === currentIdx) {
                pill.classList.add('active');
            } else if (idx < currentIdx) {
                const s = this.steps[idx];
                pill.classList.add(s && s.status === 'ALLOCATED' ? 'allocated' : 'failed');
            }

            pill.innerHTML = `<span>P${idx + 1} (${sz}k)</span>`;
            container.appendChild(pill);
        });
    }

    renderCandidateTable(candidates) {
        const tbody = document.getElementById('eval-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        candidates.forEach(c => {
            const tr = document.createElement('tr');
            const verdictText = c.chosen ? 'Chosen' : (c.fits ? 'Fits' : 'Too small');
            const verdictClass = c.chosen ? 'chosen' : (c.fits ? 'fits' : 'small');

            tr.innerHTML = `
                <td><strong>${c.label}</strong></td>
                <td>${c.blockSize} KB</td>
                <td>${c.fits ? 'Yes' : 'No'}</td>
                <td>${c.leftover} KB</td>
                <td><span class="verdict-tag ${verdictClass}">${verdictText}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderDecisionRationale(step) {
        const textEl = document.getElementById('sim-decision-text');
        if (!textEl) return;
        const p = step.process;
        let explanation = '';

        if (step.status === 'ALLOCATED') {
            if (this.activeAlgo === 'First Fit') {
                explanation = `First Fit scanned holes in address order and stopped at the first one that fits ${p.size} KB: <strong>${step.chosenLabel}</strong>.`;
            } else if (this.activeAlgo === 'Best Fit') {
                explanation = `Best Fit checked all ${step.candidates.length} free holes and picked <strong>${step.chosenLabel}</strong>, which leaves the smallest leftover (${step.leftover} KB).`;
            } else {
                explanation = `Worst Fit checked all ${step.candidates.length} free holes and picked <strong>${step.chosenLabel}</strong>, which leaves the largest leftover (${step.leftover} KB).`;
            }

            let modelNote;
            if (this.currentMode === 'dynamic') {
                modelNote = step.splitLabel
                    ? `Dynamic mode: the hole is split — ${p.size} KB goes to the process and a new free hole ${step.splitLabel} of ${step.leftover} KB is created.`
                    : `Dynamic mode: exact fit — no leftover hole is created.`;
            } else {
                modelNote = `Fixed mode: the whole ${p.size + step.leftover} KB partition is given to the process — ${step.leftover} KB is internal fragmentation.`;
            }

            textEl.innerHTML = `
                <div style="color:var(--success); font-weight:800; font-size:14px; margin-bottom:4px;">
                    ✓ Allocated: ${p.name} (${p.size} KB) &rarr; ${step.chosenLabel}
                </div>
                <div style="color:var(--text-primary);">${explanation}</div>
                <div style="margin-top:6px; font-size:12px; color:var(--text-secondary); background:var(--bg-surface); padding:6px 10px; border-radius:6px; border:1px solid var(--border-subtle);">
                    ${modelNote}
                </div>
            `;
        } else {
            const freeSizes = step.candidates.map(c => c.blockSize);
            const totalFree = freeSizes.reduce((a, b) => a + b, 0);
            const largestFree = freeSizes.length > 0 ? Math.max(...freeSizes) : 0;

            let failMsg = `${p.name} (${p.size} KB) could not be allocated: the largest free hole is only ${largestFree} KB.`;
            if (totalFree >= p.size) {
                failMsg += `<br/><strong style="color:var(--danger);">External fragmentation: ${totalFree} KB is free in total (≥ ${p.size} KB), but it is not contiguous.</strong>`;
            }

            textEl.innerHTML = `
                <div style="color:var(--danger); font-weight:800; font-size:14px; margin-bottom:4px;">
                    ✗ Allocation failed: ${p.name} (${p.size} KB)
                </div>
                <div style="color:var(--text-primary);">${failMsg}</div>
            `;
        }
    }

    clearCandidateTable() {
        const tbody = document.getElementById('eval-table-body');
        if (tbody) tbody.innerHTML = '';
    }

    updateStepCounter() {
        const el = document.getElementById('lbl-step-counter');
        if (el) {
            el.innerText = `Step ${this.currentStepIdx + 1} / ${this.steps.length}`;
        }
    }

    togglePlay() {
        if (!this.isPlaying) {
            if (this.currentStepIdx + 1 >= this.steps.length) {
                this.prepareSimulation();
            }
            this.isPlaying = true;
            this.updatePlayButtonUI(true);
            this.playTimer = setInterval(() => this.stepForward(), this.playbackSpeed);
        } else {
            this.pauseSim();
        }
    }

    pauseSim() {
        this.isPlaying = false;
        clearInterval(this.playTimer);
        this.updatePlayButtonUI(false);
    }

    updatePlayButtonUI(playing) {
        const icon = document.getElementById('play-btn-icon');
        const text = document.getElementById('lbl-play-text');
        if (icon) icon.innerText = playing ? '⏸' : '▶';
        if (text) text.innerText = playing ? 'Pause' : 'Run All';
    }

    resetSim() {
        this.prepareSimulation();
        soundFX.playClick();
    }

    triggerCompaction() {
        soundFX.playCompact();
        const currentBlocks = this.currentStepIdx >= 0 && this.steps[this.currentStepIdx] ?
            this.steps[this.currentStepIdx].snapshot :
            MemoryModels.buildInitialMemory(this.blocks, this.osReserved);

        const result = MemoryModels.performCompaction(currentBlocks);

        // Re-render memory map with compaction animation
        this.simVisualizer.render(result.compactedBlocks, null, [], true);

        // Mark the coalesced hole with shimmer sweep animation
        setTimeout(() => {
            const coalescedEl = document.querySelector('.memory-block-card.block-free');
            if (coalescedEl) coalescedEl.classList.add('coalesced-hole-glow');
        }, 100);

        // Update rationale card
        const textEl = document.getElementById('sim-decision-text');
        if (textEl) {
            textEl.innerHTML = `
                <div style="color:var(--purple); font-weight:800; font-size:14px; margin-bottom:4px;">
                    ⚡ [Memory Compaction performed - Slides 10-11]
                </div>
                <div style="color:var(--text-primary); font-size:13px;">
                    All free holes were merged into one contiguous hole of ${result.totalFreeMerged} KB.
                </div>
            `;
        }
    }

    // Number counting animation for KPI cards
    animateValue(id, start, end, duration, decimals = 0, suffix = '') {
        const obj = document.getElementById(id);
        if (!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const current = (progress * (end - start) + start);
            obj.innerText = `${current.toFixed(decimals)}${suffix}`;
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    renderResults() {
        const allocator = Algorithms.getAllocator(this.activeAlgo);
        const initBlocks = MemoryModels.buildInitialMemory(this.blocks, this.osReserved);
        const initProcs = MemoryModels.buildProcesses(this.processes);

        const sim = allocator.runSimulation(initBlocks, initProcs, this.currentMode);
        const metrics = MemoryAnalyzer.calculateMetrics(this.activeAlgo, sim.finalBlocks, sim.finalProcesses, sim.steps);

        // Animate KPI numbers
        this.animateValue('kpi-val-util', 0, metrics.memoryUtilization, 600, 1, '%');
        this.animateValue('kpi-val-internal', 0, metrics.internalFragmentation, 600, 0, ' KB');
        this.animateValue('kpi-val-external', 0, metrics.externalFragmentation, 600, 0, ' KB');

        const capUtil = document.getElementById('kpi-cap-util');
        if (capUtil) capUtil.innerText = `${metrics.usedMemory} / ${metrics.totalMemory} KB used`;

        const kpiAllocated = document.getElementById('kpi-val-allocated');
        if (kpiAllocated) kpiAllocated.innerText = `${metrics.allocatedCount} / ${metrics.totalProcesses}`;

        // Diagnostic Badges for Q2
        const badgeExact = document.getElementById('badge-exact-fits');
        const badgeUnusable = document.getElementById('badge-unusable-holes');
        if (badgeExact) badgeExact.innerText = `Exact Fits: ${metrics.exactFitsCount}`;
        if (badgeUnusable) badgeUnusable.innerText = `Unusable Small Holes: ${metrics.unusableHolesCount}`;

        // Final memory map
        this.resultsVisualizer.render(sim.finalBlocks);

        // Allocation breakdown table
        const tbody = document.getElementById('results-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            sim.finalProcesses.forEach(p => {
                const tr = document.createElement('tr');
                const step = sim.steps.find(s => s.process.pid === p.pid);
                const statusColor = p.isAllocated ? 'var(--success)' : 'var(--danger)';

                tr.innerHTML = `
                    <td><strong>${p.name}</strong></td>
                    <td>${p.size} KB</td>
                    <td>${p.isAllocated ? step.chosenLabel : '-'}</td>
                    <td>${p.isAllocated ? `${p.size + step.leftover} KB` : '-'}</td>
                    <td>${p.isAllocated ? `${step.leftover} KB` : '-'}</td>
                    <td><strong style="color:${statusColor};">${p.isAllocated ? 'Allocated' : 'Failed'}</strong></td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Mathematical Proof Breakdown (Formula substitution from Chapter 5)
        const freeHoles = sim.finalBlocks.filter(b => b.isFree).map(b => b.size);
        const mathProof = `
================================================================================
CHAPTER 5 MEMORY MANAGEMENT FORMULAS & NUMERICAL PROOF
================================================================================

1. MEMORY UTILIZATION:
   Formula:  (Used Memory / Total Physical Memory) × 100%
   Math:     (${metrics.usedMemory} KB / ${metrics.totalMemory} KB) × 100%
   Result:   = ${metrics.memoryUtilization.toFixed(2)}%

2. INTERNAL FRAGMENTATION (Slide 10):
   Formula:  Σ (Allocated Block Size - Process Size)
   Math:     Sum of leftover spaces trapped inside allocated partitions
   Result:   = ${metrics.internalFragmentation} KB

3. EXTERNAL FRAGMENTATION (Slide 10):
   Formula:  Total Free Memory - Largest Free Hole
   Holes:    [${freeHoles.join(', ') || 'None'}] KB (Total Free: ${metrics.totalFreeMemory} KB)
   Math:     ${metrics.totalFreeMemory} KB - ${metrics.largestFreeHole} KB
   Result:   = ${metrics.externalFragmentation} KB
        `;
        const proofEl = document.getElementById('math-proof-content');
        if (proofEl) proofEl.innerText = mathProof.trim();
    }

    runComparison() {
        const results = MemoryAnalyzer.simulateAll(this.blocks, this.processes, this.currentMode, this.osReserved);
        const ranking = MemoryAnalyzer.rankAlgorithms(results);

        // Winner Banner
        const winnerBanner = document.getElementById('winner-recommendation-box');
        if (winnerBanner && ranking) {
            const bestM = ranking.bestMetrics;
            winnerBanner.innerHTML = `
                <div class="winner-trophy-icon">🏆</div>
                <div>
                    <div class="winner-title">Recommended algorithm: ${ranking.best}</div>
                    <div class="winner-desc">
                        Achieved top efficiency allocating <strong>${bestM.allocatedCount}/${bestM.totalProcesses}</strong> processes with <strong>${bestM.memoryUtilization.toFixed(1)}%</strong> utilization, internal fragmentation ${bestM.internalFragmentation} KB and external fragmentation ${bestM.externalFragmentation} KB.
                        ${ranking.ties.length > 0 ? `<br/><span style="color:var(--primary);">Tied with: ${ranking.ties.join(', ')}</span>` : ''}
                    </div>
                </div>
            `;
        }

        // Comparison Table
        const tbody = document.getElementById('compare-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            results.forEach(r => {
                const m = r.metrics;
                const isWinner = ranking && r.name === ranking.best;
                const tr = document.createElement('tr');
                if (isWinner) tr.style.background = 'var(--success-subtle)';

                tr.innerHTML = `
                    <td><strong>${isWinner ? '★ ' : ''}${r.name}</strong></td>
                    <td><strong style="color:var(--success);">${m.allocatedCount}</strong> / ${m.totalProcesses}</td>
                    <td>${m.usedMemory} KB</td>
                    <td>${m.internalFragmentation} KB</td>
                    <td>${m.externalFragmentation} KB</td>
                    <td>${m.largestFreeHole} KB</td>
                    <td><strong>${m.memoryUtilization.toFixed(1)}%</strong></td>
                    <td>${m.totalScans} scans</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Render Canvas Charts
        setTimeout(() => {
            SimulationCharts.renderUtilizationChart('chart-utilization', results);
            SimulationCharts.renderFragmentationChart('chart-fragmentation', results);
        }, 50);
    }

    updateSimView() {
        if (this.currentTab === 'sim') {
            this.prepareSimulation();
        }
    }

    exportPDF() {
        window.print();
    }

    exportCSV() {
        const results = MemoryAnalyzer.simulateAll(this.blocks, this.processes, this.currentMode, this.osReserved);
        let csv = 'Algorithm,Allocated,UsedMemory_KB,InternalFrag_KB,ExternalFrag_KB,LargestHole_KB,Utilization_Pct\n';
        results.forEach(r => {
            const m = r.metrics;
            csv += `"${r.name}",${m.allocatedCount}/${m.totalProcesses},${m.usedMemory},${m.internalFragmentation},${m.externalFragmentation},${m.largestFreeHole},${m.memoryUtilization.toFixed(2)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'memory_allocation_report.csv';
        link.click();
    }

    exportJSON() {
        const results = MemoryAnalyzer.simulateAll(this.blocks, this.processes, this.currentMode, this.osReserved);
        const data = {
            course: 'CCS 3361 Operating Systems - Chapter 5',
            model: this.currentMode,
            initialBlocks: this.blocks,
            initialProcesses: this.processes,
            comparison: results.map(r => ({
                algorithm: r.name,
                metrics: r.metrics
            }))
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'memory_allocation_data.json';
        link.click();
    }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppController();
});