// v1_judging.js - Dynamic, versioned data-driven judging UI & Leaderboard

let API_BASE = 'https://api.equievent.dk';
try {
    const host = window.location.hostname;
    if (host) {
        if (host.includes('equievent.online')) {
            API_BASE = 'https://api.equievent.online';
        } else if (host.includes('equievent.dk')) {
            API_BASE = 'https://api.equievent.dk';
        } else if (host.includes('alkdata.dk')) {
            API_BASE = 'https://api.alkdata.dk';
        } else {
            API_BASE = `http://${host}:8082`;
        }
    }
} catch (e) {
    const host = window.location.hostname;
    if (host) {
        API_BASE = `http://${host}:8082`;
    }
}

// Global state for V1 Judging
let v1Judge = null;
let v1MagicUuid = null;
let v1ActiveCompId = null;
let v1ActiveClassId = null;
let v1ActiveEntryId = null;
let v1ActiveScoreSheet = null;
let v1Entries = [];
let v1Classes = {};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const magicParam = urlParams.get('magic');
    const leaderboardParam = urlParams.get('leaderboard');

    if (magicParam) {
        // Try V1 first
        initV1JudgeSession(magicParam).catch(err => {
            console.log("V1 Session init failed, falling back to legacy scores.js. Error:", err);
        });
    } else if (leaderboardParam) {
        initV1Leaderboard(leaderboardParam).catch(err => {
            console.log("V1 Leaderboard init failed, falling back to legacy scores.js. Error:", err);
        });
    }
});

async function initV1JudgeSession(uuid) {
    const res = await fetch(`${API_BASE}/api/v1/judging/session/${uuid}`);
    if (!res.ok) {
        throw new Error("Not a V1 session");
    }
    
    // Stop legacy scores.js from showing legacy panel
    v1MagicUuid = uuid;
    v1Judge = await res.json();
    v1ActiveCompId = v1Judge.competition_id;
    
    // Show new judge interface
    document.querySelectorAll('main').forEach(m => m.style.display = 'none');
    document.getElementById('magic-judge-section').style.display = 'block';
    
    document.getElementById('mj-title').innerText = `Dommer: ${v1Judge.name} (${v1Judge.position || 'Dommer'})`;
    document.getElementById('mj-subtitle').innerText = "Data-drevet bedømmelse (v1 API)";
    
    // Load entries and build classes dropdown
    await loadV1JudgeClasses();
    
    // Hook UI elements
    const select = document.getElementById('mj-post-select');
    select.onchange = onV1ClassSelected;
    
    window.startJudging = startV1ClassJudging;
    window.changePost = changeV1Class;
    window.searchRider = searchV1Rider;
    window.selectV1EntryToScore = selectV1EntryToScore;
}

async function loadV1JudgeClasses() {
    const res = await fetch(`${API_BASE}/api/v1/competitions/${v1ActiveCompId}/entries`);
    if (!res.ok) return;
    
    v1Entries = await res.json();
    
    // Group entries by class definitions
    v1Classes = {};
    v1Entries.forEach(entry => {
        const cls = entry.class_def;
        if (!v1Classes[cls.id]) {
            v1Classes[cls.id] = {
                id: cls.id,
                name: cls.name,
                discipline: cls.discipline,
                scoring_model: cls.scoring_model,
                configuration: JSON.parse(cls.configuration || '{}'),
                entries: []
            };
        }
        v1Classes[cls.id].entries.push(entry);
    });
    
    // Fill select
    const select = document.getElementById('mj-post-select');
    select.innerHTML = '<option value="">-- Vælg klasse --</option>';
    Object.values(v1Classes).forEach(cls => {
        select.innerHTML += `<option value="${cls.id}">${cls.name} (${cls.discipline})</option>`;
    });
}

function onV1ClassSelected() {
    const val = document.getElementById('mj-post-select').value;
    if (!val) return;
    v1ActiveClassId = parseInt(val);
}

function startV1ClassJudging() {
    if (!v1ActiveClassId) return alert("Vælg venligst en klasse!");
    
    document.getElementById('mj-post-selection').style.display = 'none';
    document.getElementById('mj-judging-area').style.display = 'block';
    
    const cls = v1Classes[v1ActiveClassId];
    document.getElementById('mj-active-post-name').innerText = `Klasse: ${cls.name}`;
    
    // Clear search and show entry selection
    document.getElementById('mj-rider-search').value = '';
    document.getElementById('mj-rider-search-results').innerHTML = '';
    searchV1Rider(); // Show all initially
}

function changeV1Class() {
    document.getElementById('mj-post-selection').style.display = 'block';
    document.getElementById('mj-judging-area').style.display = 'none';
    document.getElementById('mj-score-form').style.display = 'none';
    v1ActiveClassId = null;
    v1ActiveEntryId = null;
    v1ActiveScoreSheet = null;
}

function searchV1Rider() {
    const query = document.getElementById('mj-rider-search').value.toLowerCase();
    const resultsContainer = document.getElementById('mj-rider-search-results');
    resultsContainer.innerHTML = '';
    
    const cls = v1Classes[v1ActiveClassId];
    if (!cls) return;
    
    const filtered = cls.entries.filter(e => {
        const startNo = e.start_number ? e.start_number.toString() : '';
        const riderName = (e.rider?.name || '').toLowerCase();
        const horseName = (e.horse?.name || '').toLowerCase();
        return startNo.includes(query) || riderName.includes(query) || horseName.includes(query);
    });
    
    filtered.forEach(e => {
        const startNo = e.start_number ? `<span class="badge" style="background: var(--primary);">#${e.start_number}</span>` : '';
        resultsContainer.innerHTML += `
            <div class="list-item" style="cursor: pointer; border-left: 4px solid #10b981; margin-bottom: 0.5rem;" onclick="selectV1EntryToScore(${e.id})">
                <div>
                    <strong>${e.rider?.name || 'Ukendt'}</strong> ${startNo}
                    <div style="font-size: 0.8rem; color: var(--text-secondary);"><i class="fas fa-horse-head"></i> ${e.horse?.name || 'Ukendt'}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
            </div>
        `;
    });
}

async function selectV1EntryToScore(entryId) {
    v1ActiveEntryId = entryId;
    document.getElementById('mj-rider-search-results').innerHTML = '';
    document.getElementById('mj-rider-search').value = '';
    
    const entry = v1Entries.find(e => e.id === entryId);
    if (!entry) return;
    
    // Get or create score sheet
    const res = await fetch(`${API_BASE}/api/v1/classes/${v1ActiveClassId}/entries/${entryId}/score-sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            judge_id: v1Judge.id,
            rule_version: entry.competition.ruleVersion || "2026.1"
        })
    });
    
    if (!res.ok) {
        return alert("Fejl ved oprettelse af dommerskema.");
    }
    
    v1ActiveScoreSheet = await res.json();
    renderV1ScoreForm(entry);
}

function renderV1ScoreForm(entry) {
    const cls = v1Classes[v1ActiveClassId];
    const form = document.getElementById('mj-score-form');
    form.style.display = 'block';
    
    const header = document.getElementById('mj-selected-rider-name');
    const startNo = entry.start_number ? `#${entry.start_number} - ` : '';
    header.innerText = `${startNo}${entry.rider?.name} på ${entry.horse?.name}`;
    
    // Hide standard inputs
    document.getElementById('mj-points-group').style.display = 'none';
    document.getElementById('mj-deductions-group').style.display = 'none';
    document.getElementById('mj-jumping-fields').style.display = 'none';
    
    // Create new dynamic content area
    let dynamicArea = document.getElementById('mj-dynamic-area');
    if (!dynamicArea) {
        dynamicArea = document.createElement('div');
        dynamicArea.id = 'mj-dynamic-area';
        dynamicArea.style.marginBottom = '1.5rem';
        form.insertBefore(dynamicArea, document.getElementById('mj-comment').parentNode);
    }
    dynamicArea.innerHTML = '';
    
    if (cls.discipline === 'dressage') {
        renderDressageForm(cls, dynamicArea);
    } else if (cls.discipline === 'gait') {
        renderIcelandicForm(cls, dynamicArea);
    } else if (cls.discipline === 'jumping') {
        renderJumpingForm(cls, dynamicArea);
    }
}

function renderDressageForm(cls, container) {
    let html = `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
            <thead>
                <tr style="border-bottom: 1px solid var(--glass-border); text-align: left; font-size: 0.85rem; color: var(--text-secondary);">
                    <th style="padding: 0.5rem 0.2rem;">Nr</th>
                    <th style="padding: 0.5rem 0.2rem;">Øvelse</th>
                    <th style="padding: 0.5rem 0.2rem;">Koeff</th>
                    <th style="padding: 0.5rem 0.2rem; text-align: center;">Karakter</th>
                    <th style="padding: 0.5rem 0.2rem;">Point</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    cls.configuration.exercises.forEach(ex => {
        const item = v1ActiveScoreSheet.items.find(it => it.sequence === ex.sequence && it.type === 'mark');
        const val = JSON.parse(item?.value || '{"mark": null, "comment": ""}');
        const markVal = val.mark !== null ? val.mark : '';
        const commentVal = val.comment || '';
        
        let options = '<option value="">-</option>';
        for (let m = 10; m >= 0; m -= ex.allowedIncrement || 0.5) {
            options += `<option value="${m.toFixed(1)}" ${val.mark !== null && parseFloat(val.mark) === m ? 'selected' : ''}>${m.toFixed(1)}</option>`;
        }
        
        const weighted = val.mark !== null ? (parseFloat(val.mark) * (ex.coefficient || 1)).toFixed(1) : '-';
        
        html += `
            <tr style="border-bottom: 1px dashed rgba(255,255,255,0.05); vertical-align: top;">
                <td style="padding: 0.8rem 0.2rem; font-weight: bold; color: var(--text-secondary);">${ex.sequence}</td>
                <td style="padding: 0.8rem 0.2rem; font-size: 0.9rem;">
                    <strong>${ex.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">${ex.directiveIdeas ? ex.directiveIdeas.join(', ') : ''}</div>
                </td>
                <td style="padding: 0.8rem 0.2rem; color: var(--text-secondary);">${ex.coefficient || 1}</td>
                <td style="padding: 0.8rem 0.2rem; text-align: center;">
                    <select style="padding: 0.3rem; border-radius: 6px; background: rgba(0,0,0,0.5); color: white; border: 1px solid var(--glass-border); width: 80px;" onchange="saveV1DressageMark(${item.id}, this.value, ${ex.coefficient || 1}, this)">
                        ${options}
                    </select>
                </td>
                <td style="padding: 0.8rem 0.2rem; font-weight: bold; color: #10b981;" class="weighted-points-cell">${weighted}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td colspan="5" style="padding-bottom: 0.8rem;">
                    <input type="text" placeholder="Tilføj øvelseskommentar..." value="${commentVal}" style="width: 100%; padding: 0.4rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; color: #cbd5e1; font-size: 0.85rem;" onblur="saveV1DressageComment(${item.id}, this.value)">
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
        
        <div class="input-group">
            <label style="color: var(--text-secondary);">Samlet Fradrag (Fejlridning, etc.)</label>
            <input type="number" min="0" step="1" value="0" id="v1-dressage-deductions" style="font-size: 1.2rem; text-align: center; color: #ef4444; font-weight: bold;" onchange="saveV1DressageDeduction(this.value)">
        </div>
        
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 1rem; border-radius: 12px; margin-top: 1.5rem; text-align: center;">
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Beregnet foreløbig procent</div>
            <div id="v1-dressage-percentage-display" style="font-size: 2rem; font-weight: 800; color: #10b981;">0.00 %</div>
        </div>
    `;
    
    container.innerHTML = html;
    updateV1Calculation();
}

window.saveV1DressageMark = async function(itemId, markVal, coeff, selectEl) {
    const parentRow = selectEl.closest('tr');
    const weightedCell = parentRow.querySelector('.weighted-points-cell');
    
    let mark = markVal ? parseFloat(markVal) : null;
    weightedCell.innerText = mark !== null ? (mark * coeff).toFixed(1) : '-';
    
    // Save to server
    await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark: mark })
    });
    
    updateV1Calculation();
};

window.saveV1DressageComment = async function(itemId, commentVal) {
    await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentVal })
    });
};

window.saveV1DressageDeduction = async function(dedVal) {
    // Find or create deduction item
    let item = v1ActiveScoreSheet.items.find(it => it.type === 'deduction');
    if (!item) {
        const res = await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deduction: parseFloat(dedVal || 0) })
        });
        if (res.ok) {
            const newItem = await res.json();
            v1ActiveScoreSheet.items.push(newItem);
        }
    } else {
        await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deduction: parseFloat(dedVal || 0) })
        });
    }
    updateV1Calculation();
};

async function updateV1Calculation() {
    const res = await fetch(`${API_BASE}/api/v1/entries/${v1ActiveEntryId}/calculate-result`, {
        method: 'POST'
    });
    if (res.ok) {
        const result = await res.json();
        const disp = document.getElementById('v1-dressage-percentage-display') || document.getElementById('v1-gait-mark-display');
        if (disp) {
            if (v1Classes[v1ActiveClassId].discipline === 'dressage') {
                disp.innerText = `${result.primary_score.toFixed(2)} %`;
            } else if (v1Classes[v1ActiveClassId].discipline === 'gait') {
                disp.innerText = `${result.primary_score.toFixed(2)} p`;
            }
        }
    }
}

function renderIcelandicForm(cls, container) {
    let html = `
        <h4 style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem;">Opgavedele</h4>
    `;
    
    cls.configuration.sections.forEach(sec => {
        const item = v1ActiveScoreSheet.items.find(it => it.sequence === sec.sequence && it.type === 'mark');
        const val = JSON.parse(item?.value || '{"mark": null}');
        const markVal = val.mark !== null ? val.mark : '';
        
        let options = '<option value="">-</option>';
        for (let m = 10; m >= 0; m -= cls.configuration.markIncrement || 0.5) {
            options += `<option value="${m.toFixed(1)}" ${val.mark !== null && parseFloat(val.mark) === m ? 'selected' : ''}>${m.toFixed(1)}</option>`;
        }
        
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid var(--glass-border);">
                <div>
                    <strong>${sec.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Vægt: ${sec.weight || 1}</div>
                </div>
                <select style="padding: 0.4rem; border-radius: 8px; background: rgba(0,0,0,0.5); color: #fbbf24; border: 1px solid var(--glass-border); width: 85px; font-weight: bold; font-size: 1.1rem; text-align: center;" onchange="saveV1GaitMark(${item.id}, this.value)">
                    ${options}
                </select>
            </div>
        `;
    });
    
    // Bad riding deduction slider
    let deductionItem = v1ActiveScoreSheet.items.find(it => it.type === 'deduction');
    let dedVal = 0.0;
    let reasonVal = '';
    if (deductionItem) {
        const dJson = JSON.parse(deductionItem.value || '{}');
        dedVal = dJson.deduction || 0.0;
        reasonVal = dJson.reason || '';
    }
    
    html += `
        <div style="margin-top: 1.5rem; border-top: 1px solid var(--glass-border); padding-top: 1rem;">
            <div class="input-group">
                <label style="color: #ef4444; font-weight: bold;">Dommerfradrag (Dårlig ridning / grove hjælpere)</label>
                <input type="number" min="0" max="10" step="0.5" value="${dedVal}" id="v1-gait-deduction" style="font-size: 1.2rem; text-align: center; color: #ef4444; font-weight: bold;" onchange="saveV1GaitDeduction()">
            </div>
            <div class="input-group">
                <label style="font-size: 0.8rem; color: var(--text-secondary);">Begrundelse / Årsagskode (Obligatorisk ved fradrag)</label>
                <input type="text" id="v1-gait-deduction-reason" value="${reasonVal}" placeholder="F.eks. Grov brug af tøjle..." style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 6px; color: white;" onblur="saveV1GaitDeduction()">
            </div>
        </div>
        
        <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.2); padding: 1rem; border-radius: 12px; margin-top: 1.5rem; text-align: center;">
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Beregnet foreløbig karakter</div>
            <div id="v1-gait-mark-display" style="font-size: 2rem; font-weight: 800; color: #fbbf24;">0.00 p</div>
        </div>
    `;
    
    container.innerHTML = html;
    updateV1Calculation();
}

window.saveV1GaitMark = async function(itemId, markVal) {
    let mark = markVal ? parseFloat(markVal) : null;
    await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark: mark })
    });
    updateV1Calculation();
};

window.saveV1GaitDeduction = async function() {
    const dedVal = parseFloat(document.getElementById('v1-gait-deduction').value || 0);
    const reason = document.getElementById('v1-gait-deduction-reason').value;
    
    if (dedVal > 0 && !reason) {
        alert("Advarsel: Fradrag for dårlig ridning kræver en begrundelse. Resultatet kan ikke godkendes uden.");
    }
    
    let item = v1ActiveScoreSheet.items.find(it => it.type === 'deduction');
    if (!item) {
        const res = await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deduction: dedVal, reason: reason })
        });
        if (res.ok) {
            const newItem = await res.json();
            v1ActiveScoreSheet.items.push(newItem);
        }
    } else {
        await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deduction: dedVal, reason: reason })
        });
    }
    updateV1Calculation();
};

function renderJumpingForm(cls, container) {
    // Renders obstacle logging buttons and events
    let html = `
        <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                <span>Fejlfri tid: <strong>${cls.configuration.allowedTime || 75} sek</strong></span>
                <span>Maksimumtid: <strong>${cls.configuration.maximumTime || 150} sek</strong></span>
            </div>
        </div>
        
        <div class="input-group">
            <label>Rundestatus</label>
            <select id="v1-jump-status" style="padding: 0.6rem; font-weight: bold; font-size: 1.1rem;" onchange="updateV1JumpingStatusUI()">
                <option value="completed">Gennemført</option>
                <option value="clear">Fejlfri (Clear)</option>
                <option value="eliminated">Elimineret</option>
                <option value="retired">Udgået / Retired</option>
            </select>
        </div>
        
        <div id="v1-jumping-loggers">
            <h4 style="margin-bottom: 0.8rem; font-size: 0.9rem; color: var(--text-secondary);">Registrer springhændelse (Forhindring 1-12)</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4rem; margin-bottom: 1rem;">
    `;
    
    for (let f = 1; f <= 12; f++) {
        html += `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); border-radius: 8px; padding: 0.4rem; text-align: center;">
                <div style="font-weight: bold; font-size: 0.85rem; margin-bottom: 0.3rem; color: var(--text-secondary);">H${f}</div>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-knockdown-${f}" style="padding: 0.2rem; font-size: 0.7rem; width: 100%; border: 1px solid rgba(239, 68, 68, 0.2);" onclick="logV1JumpingEvent('${f}', 'KNOCKDOWN')">Nedslag</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="btn-disobedience-${f}" style="padding: 0.2rem; font-size: 0.7rem; width: 100%; border: 1px solid rgba(251, 191, 36, 0.2);" onclick="logV1JumpingEvent('${f}', 'DISOBEDIENCE')">Ulydighed</button>
                </div>
            </div>
        `;
    }
    
    html += `
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <button type="button" class="btn btn-danger btn-sm" style="flex: 1;" onclick="logV1JumpingEvent('Bane', 'FALL')"><i class="fas fa-user-injured"></i> Rytter/Hest faldet</button>
                <button type="button" class="btn btn-secondary btn-sm" style="flex: 1;" onclick="logV1JumpingEvent('Vand', 'WATER_PENALTY')">Fod i vandet</button>
            </div>
            
            <div class="input-group">
                <label>Bane Ridetid (Sekunder)</label>
                <input type="number" step="0.01" min="0" value="0.0" id="v1-jump-time" style="font-size: 1.25rem; text-align: center; color: #10b981; font-weight: bold;" onchange="saveV1JumpingTime()">
            </div>
    `;
    
    if (cls.scoring_model === 'style') {
        const styleItem = v1ActiveScoreSheet.items.find(it => it.type === 'style');
        const styleJson = JSON.parse(styleItem?.value || '{"styleMark": 0.0}');
        html += `
            <div class="input-group">
                <label>Stilkarakter (0.0 - 10.0)</label>
                <input type="number" step="0.1" min="0" max="10" value="${styleJson.styleMark || 0.0}" id="v1-jump-style" style="font-size: 1.25rem; text-align: center; color: #fbbf24; font-weight: bold;" onchange="saveV1JumpingStyle(${styleItem.id})">
            </div>
        `;
    }
    
    if (cls.scoring_model === 'jumping_b4' || cls.scoring_model === 'jumping_b1' || cls.scoring_model === 'jumping_b3' || cls.scoring_model === 'jumping_b7') {
        html += `
            <div style="border-top: 1px dashed var(--glass-border); padding-top: 1rem; margin-top: 1rem;">
                <h5 style="margin-bottom: 0.5rem; color: #fbbf24;">Omspringning / Fase 2 (Hvis relevant)</h5>
                <div style="display: flex; gap: 0.5rem;">
                    <div class="input-group" style="flex: 1; margin-bottom: 0;">
                        <label>Fase 2 Fejl</label>
                        <input type="number" min="0" id="v1-jump-off-faults" value="0" onchange="saveV1JumpingJumpOff()">
                    </div>
                    <div class="input-group" style="flex: 1; margin-bottom: 0;">
                        <label>Fase 2 Tid</label>
                        <input type="number" step="0.01" min="0" id="v1-jump-off-time" value="0.0" onchange="saveV1JumpingJumpOff()">
                    </div>
                </div>
            </div>
        `;
    }
    
    html += `
        </div>
        
        <div style="margin-top: 1rem;">
            <h5 style="color: var(--text-secondary); margin-bottom: 0.5rem;">Registrerede hændelser</h5>
            <div id="v1-jumping-events-list" style="display: flex; flex-direction: column; gap: 0.25rem;"></div>
        </div>
    `;
    
    container.innerHTML = html;
    updateV1JumpingEventsList();
}

window.updateV1JumpingStatusUI = function() {
    const status = document.getElementById('v1-jump-status').value;
    const loggers = document.getElementById('v1-jumping-loggers');
    if (status === 'eliminated' || status === 'retired') {
        loggers.style.display = 'none';
    } else {
        loggers.style.display = 'block';
    }
};

window.logV1JumpingEvent = async function(obstacle, eventType) {
    let penalty = 4;
    if (eventType === 'WATER_PENALTY') penalty = 4;
    
    const res = await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            obstacle: obstacle,
            eventType: eventType,
            penalty: penalty
        })
    });
    
    if (res.ok) {
        const newItem = await res.json();
        v1ActiveScoreSheet.items.push(newItem);
        updateV1JumpingEventsList();
    }
};

window.saveV1JumpingTime = async function() {
    const timeVal = parseFloat(document.getElementById('v1-jump-time').value || 0);
    const timeItem = v1ActiveScoreSheet.items.find(it => it.type === 'time');
    if (timeItem) {
        await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${timeItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ridingTime: timeVal })
        });
    }
};

window.saveV1JumpingStyle = async function(itemId) {
    const styleVal = parseFloat(document.getElementById('v1-jump-style').value || 0);
    await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ styleMark: styleVal })
    });
};

window.saveV1JumpingJumpOff = async function() {
    const faultsVal = parseInt(document.getElementById('v1-jump-off-faults').value || 0);
    const timeVal = parseFloat(document.getElementById('v1-jump-off-time').value || 0);
    
    let jumpOffItem = v1ActiveScoreSheet.items.find(it => it.type === 'jump_off');
    if (!jumpOffItem) {
        const res = await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jumpOffFaults: faultsVal, jumpOffTime: timeVal })
        });
        if (res.ok) {
            const newItem = await res.json();
            v1ActiveScoreSheet.items.push(newItem);
        }
    } else {
        await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${jumpOffItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jumpOffFaults: faultsVal, jumpOffTime: timeVal })
        });
    }
};

function updateV1JumpingEventsList() {
    const list = document.getElementById('v1-jumping-events-list');
    if (!list) return;
    list.innerHTML = '';
    
    const events = v1ActiveScoreSheet.items.filter(it => it.type === 'event');
    
    // Reset all button labels first
    for (let f = 1; f <= 12; f++) {
        const btnKnock = document.getElementById(`btn-knockdown-${f}`);
        if (btnKnock) {
            btnKnock.innerText = "Nedslag";
            btnKnock.style.background = "";
        }
        const btnDisob = document.getElementById(`btn-disobedience-${f}`);
        if (btnDisob) {
            btnDisob.innerText = "Ulydighed";
            btnDisob.style.background = "";
        }
    }
    
    // Count events per fence
    const counts = {};
    events.forEach(ev => {
        let val = {};
        try {
            val = typeof ev.value === 'string' ? JSON.parse(ev.value) : ev.value;
        } catch(e) {
            val = ev.value || {};
        }
        
        const obs = val.obstacle;
        if (obs) {
            if (!counts[obs]) counts[obs] = { KNOCKDOWN: 0, DISOBEDIENCE: 0 };
            counts[obs][val.eventType] = (counts[obs][val.eventType] || 0) + 1;
        }
    });
    
    // Update button labels with counts
    Object.keys(counts).forEach(obs => {
        const knockCount = counts[obs].KNOCKDOWN || 0;
        const btnKnock = document.getElementById(`btn-knockdown-${obs}`);
        if (btnKnock && knockCount > 0) {
            btnKnock.innerText = `Nedslag (${knockCount})`;
            btnKnock.style.background = "#ef4444";
            btnKnock.style.color = "white";
        }
        
        const disobCount = counts[obs].DISOBEDIENCE || 0;
        const btnDisob = document.getElementById(`btn-disobedience-${obs}`);
        if (btnDisob && disobCount > 0) {
            btnDisob.innerText = `Ulydighed (${disobCount})`;
            btnDisob.style.background = "#fbbf24";
            btnDisob.style.color = "#0f172a";
        }
    });

    if (events.length === 0) {
        list.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-secondary);">Ingen hændelser logget.</span>';
        return;
    }
    
    events.forEach(ev => {
        let val = {};
        try {
            val = typeof ev.value === 'string' ? JSON.parse(ev.value) : ev.value;
        } catch(e) {
            val = ev.value || {};
        }
        list.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); padding: 0.5rem; border-radius: 6px; font-size: 0.85rem;">
                <span>Forhindring <strong>${val.obstacle}</strong>: ${val.eventType} (${val.penalty} fejl)</span>
                <i class="fas fa-trash-alt" style="color: #ef4444; cursor: pointer;" onclick="deleteV1JumpingEvent(${ev.id})"></i>
            </div>
        `;
    });
}

window.deleteV1JumpingEvent = async function(itemId) {
    // Delete event item. Since we don't have a direct delete route in the spec,
    // we can set value to empty or handle it on backend, or just update the value to mark it ignored.
    // In our judging.py router, PUT with a null/deleted flag can be handled,
    // or we can implement a delete endpoint in judging.py.
    // Let's add a DELETE route to judging.py! Yes, that is standard.
    // For now, let's call a DELETE endpoint:
    const res = await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/items/${itemId}/delete`, {
        method: 'DELETE'
    });
    if (res.ok) {
        v1ActiveScoreSheet.items = v1ActiveScoreSheet.items.filter(it => it.id !== itemId);
        updateV1JumpingEventsList();
    }
};


// Hook form submit to calculate final result and set status to APPROVED
document.getElementById('mj-score-form')?.addEventListener('submit', async (e) => {
    // For V1, we intercept the submit event if we have a V1 score sheet active
    if (!v1ActiveScoreSheet) return;
    e.preventDefault();
    
    const comment = document.getElementById('mj-comment').value;
    
    // 1. Update status to SUBMITTED/APPROVED
    let newStatus = "APPROVED";
    const cls = v1Classes[v1ActiveClassId];
    if (cls.discipline === 'jumping') {
        const jStatus = document.getElementById('v1-jump-status').value;
        if (jStatus === 'eliminated') newStatus = 'ELIMINATED';
        else if (jStatus === 'retired') newStatus = 'WITHDRAWN';
    }
    
    // Save final status update
    await fetch(`${API_BASE}/api/v1/score-sheets/${v1ActiveScoreSheet.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: newStatus,
            change_reason: "Resultat færdigmeldt og godkendt af dommer."
        })
    });
    
    // 2. Trigger calculation
    const calcRes = await fetch(`${API_BASE}/api/v1/entries/${v1ActiveEntryId}/calculate-result`, {
        method: 'POST'
    });
    
    if (calcRes.ok) {
        alert("Resultat gemt og beregnet!");
        document.getElementById('mj-score-form').style.display = 'none';
        v1ActiveEntryId = null;
        v1ActiveScoreSheet = null;
        startV1ClassJudging(); // reload list
    } else {
        const err = await calcRes.json();
        alert(`Beregning fejlede: ${err.detail}`);
    }
});


// --- V1 LEADERBOARD ---

async function initV1Leaderboard(compId) {
    document.querySelectorAll('main').forEach(m => m.style.display = 'none');
    document.getElementById('public-leaderboard-section').style.display = 'block';
    
    const listElement = document.getElementById('pl-list');
    const titleElement = document.getElementById('pl-title');
    
    listElement.innerHTML = '<p style="text-align: center;">Henter V1 resultater...</p>';
    
    try {
        const res = await fetch(`${API_BASE}/api/v1/competitions/${compId}/results`);
        if (!res.ok) {
            throw new Error();
        }
        
        const data = await res.json();
        if (titleElement) titleElement.innerText = `Leaderboard: ${data.competition_name}`;
        
        listElement.innerHTML = '';
        
        // Add export controls
        const exportDiv = document.createElement('div');
        exportDiv.className = 'no-print';
        exportDiv.style.marginBottom = '1.5rem';
        exportDiv.style.display = 'flex';
        exportDiv.style.gap = '0.5rem';
        exportDiv.style.justifyContent = 'flex-end';
        exportDiv.innerHTML = `
            <button class="btn btn-secondary btn-sm" onclick="exportV1CSV(${compId})" style="padding: 0.5rem 1rem; border-radius: 8px;"><i class="fas fa-file-csv"></i> Eksporter CSV</button>
            <button class="btn btn-secondary btn-sm" onclick="window.print()" style="padding: 0.5rem 1rem; border-radius: 8px;"><i class="fas fa-file-pdf"></i> Udskriv / Gem PDF</button>
        `;
        listElement.appendChild(exportDiv);
        
        if (!data.classes || data.classes.length === 0) {
            listElement.innerHTML += '<p style="text-align: center; color: var(--text-secondary);">Ingen aktive stævneklasser fundet.</p>';
            return;
        }
        
        data.classes.forEach(cls => {
            const classHeader = document.createElement('div');
            classHeader.className = 'glass-panel';
            classHeader.style.padding = '1rem';
            classHeader.style.marginTop = '2rem';
            classHeader.style.marginBottom = '1rem';
            classHeader.style.background = 'rgba(255,255,255,0.05)';
            classHeader.style.borderRadius = '8px';
            
            const discName = cls.discipline === 'gait' ? 'Islandske Heste' : cls.discipline === 'dressage' ? 'Dressur' : 'Springning';
            const discColor = cls.discipline === 'gait' ? '#fbbf24' : cls.discipline === 'dressage' ? '#60a5fa' : '#f87171';
            classHeader.style.borderLeft = `4px solid ${discColor}`;
            
            classHeader.innerHTML = `
                <h4 style="margin: 0; color: white; display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: bold;">
                    <span>${cls.class_name} <small style="font-size: 0.8rem; color: var(--text-secondary); font-weight: normal; margin-left: 0.5rem;">(${discName})</small></span>
                    <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: normal;">${cls.leaderboard.length} deltagere</span>
                </h4>
            `;
            listElement.appendChild(classHeader);
            
            if (cls.leaderboard.length === 0) {
                const empty = document.createElement('p');
                empty.style.textAlign = 'center';
                empty.style.color = 'var(--text-secondary)';
                empty.style.fontSize = '0.9rem';
                empty.style.padding = '0.5rem 0';
                empty.innerText = 'Ingen deltagere registreret i denne klasse endnu.';
                listElement.appendChild(empty);
                return;
            }
            
            cls.leaderboard.forEach((r, index) => {
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                
                const startNo = r.start_number ? `<span class="badge" style="background: rgba(255,255,255,0.2);">#${r.start_number}</span>` : '';
                
                // Trace description
                let traceHtml = `<div style="margin-top: 1rem; padding: 1rem; border-top: 1px dashed var(--glass-border); display: none; background: rgba(0,0,0,0.2); border-radius: 8px;" class="v1-trace-details">`;
                if (r.calculation_trace && r.calculation_trace.trace) {
                    traceHtml += `<h5 style="color: #fbbf24; margin-bottom: 0.5rem;">Beregningsspor (Formel)</h5>`;
                    r.calculation_trace.trace.forEach(tr => {
                        traceHtml += `<div style="font-size: 0.85rem; color: #e2e8f0; margin-bottom: 0.25rem;">• ${tr}</div>`;
                    });
                    traceHtml += `<div style="margin-top: 0.8rem; font-weight: bold; color: #10b981; font-size: 0.95rem;">Resultat: ${r.calculation_trace.formula || ''}</div>`;
                } else {
                    traceHtml += '<span style="font-size: 0.85rem; color: var(--text-secondary);">Ingen detaljer tilgængelige.</span>';
                }
                
                // Show audit logs link if admin (we can show it always for convenience in this view)
                traceHtml += `
                    <div style="margin-top: 1rem; display: flex; justify-content: space-between; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.5rem;">
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); showV1AuditHistory(${r.entry_id})" style="font-size: 0.75rem;"><i class="fas fa-history"></i> Vis Audit Log / Historik</button>
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.printDiploma(${cls.class_id}, ${r.entry_id})" style="background: #fbbf24; color: #0f172a; border: none; font-weight: bold; font-size: 0.75rem; padding: 0.3rem 0.8rem; border-radius: 6px;"><i class="fas fa-certificate"></i> Print Diplom</button>
                    </div>
                `;
                
                traceHtml += '</div>';
                
                const card = document.createElement('div');
                card.className = 'list-item';
                card.style.borderLeft = `4px solid ${discColor}`;
                card.style.flexDirection = 'column';
                card.style.alignItems = 'stretch';
                card.style.cursor = 'pointer';
                card.onclick = () => {
                    const det = card.querySelector('.v1-trace-details');
                    det.style.display = det.style.display === 'none' ? 'block' : 'none';
                };
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="font-size: 1.5rem; width: 30px; text-align: center; color: var(--text-secondary);">${medal || (index+1)}</div>
                            <div>
                                <strong style="font-size: 1.1rem;">${r.rider_name}</strong> ${startNo}
                                <div style="font-size: 0.85rem; color: var(--text-secondary);"><i class="fas fa-horse-head"></i> ${r.horse_name}</div>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.3rem; font-weight: bold; color: #fbbf24;">${r.display_score}</div>
                            <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: normal; margin-top: 0.25rem;">${r.status}</span>
                        </div>
                    </div>
                    ${traceHtml}
                `;
                listElement.appendChild(card);
            });
        });
        
    } catch(err) {
        console.error(err);
        listElement.innerHTML = '<p style="color: #ef4444; text-align: center;">Kunne ikke hente V1 leaderboard.</p>';
    }
}

window.exportV1CSV = function(compId) {
    if (!window.currentLeaderboardData && !v1Entries.length) return;
    
    // Compile CSV string
    let csv = 'Rang;Startnr;Rytter;Hest;Klasse;Status;Resultat\n';
    
    const data = window.currentLeaderboardData || {classes: []};
    data.classes.forEach(cls => {
        cls.leaderboard.forEach((r, idx) => {
            csv += `${idx+1};${r.start_number || ''};${r.rider_name};${r.horse_name};${cls.class_name};${r.status};${r.display_score}\n`;
        });
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `resultater_staevne_${compId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.showV1AuditHistory = async function(entryId) {
    const entry = v1Entries.find(e => e.id === entryId) || { score_sheets: [] };
    const sheet = entry.score_sheets[0];
    if (!sheet) return alert("Ingen skemaer fundet for denne ekvipage.");
    
    const res = await fetch(`${API_BASE}/api/v1/score-sheets/${sheet.id}/history`);
    if (!res.ok) return alert("Kunne ikke hente revisionshistorik.");
    
    const history = await res.json();
    if (history.length === 0) {
        alert("Ingen historiske korrektioner fundet for dette skema (Første revision).");
        return;
    }
    
    let msg = `Audit Log (Historik) for skema ID: ${sheet.id}\n`;
    history.forEach(log => {
        const date = new Date(log.changed_at).toLocaleString('da-DK');
        msg += `\n[Rev ${log.revision}] ${date} af ${log.changed_by || 'ukendt'}\nÅrsag: ${log.change_reason || 'Ingen'}\n`;
    });
    alert(msg);
};


// ==========================================
// POSTS & CLASSES SUBTABS & CUSTOM CLASS BUILDER
// ==========================================

window.currentPostsSubTab = 'create';
window.currentStandardsDisciplineFilter = 'all';

window.switchPostsSubTab = function(subTab) {
    window.currentPostsSubTab = subTab;
    
    document.querySelectorAll('.posts-subtab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.borderColor = 'var(--glass-border)';
        btn.style.color = 'var(--text-secondary)';
    });
    
    document.querySelectorAll('.posts-subtab-pane').forEach(pane => {
        pane.style.display = 'none';
    });
    
    const activeBtn = document.getElementById(`posts-subtab-btn-${subTab}`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.background = 'rgba(251, 191, 36, 0.15)';
        activeBtn.style.borderColor = '#fbbf24';
        activeBtn.style.color = '#fbbf24';
    }
    
    const activePane = document.getElementById(`posts-subtab-${subTab}`);
    if (activePane) {
        activePane.style.display = 'block';
    }
    
    if (subTab === 'active' && window.renderClubPosts) {
        window.renderClubPosts();
    } else if (subTab === 'standards' && window.loadV1ClassTemplates) {
        window.loadV1ClassTemplates();
    } else if (subTab === 'create') {
        const container = document.getElementById('custom-class-rows-container');
        if (container && container.children.length === 0) {
            window.setCustomClassDiscipline('gait');
        }
    }
};

window.setCustomClassDiscipline = function(disc) {
    document.getElementById('custom-class-discipline').value = disc;
    
    const discButtons = [
        { id: 'btn-disc-gait', disc: 'gait', color: '#fbbf24' },
        { id: 'btn-disc-dressage', disc: 'dressage', color: '#10b981' },
        { id: 'btn-disc-jumping', disc: 'jumping', color: '#60a5fa' }
    ];
    
    discButtons.forEach(b => {
        const el = document.getElementById(b.id);
        if (el) {
            if (b.disc === disc) {
                el.style.background = `rgba(${b.disc === 'gait' ? '251, 191, 36' : b.disc === 'dressage' ? '16, 185, 129' : '59, 130, 246'}, 0.2)`;
                el.style.borderColor = b.color;
                el.style.color = b.color;
            } else {
                el.style.background = 'rgba(255, 255, 255, 0.05)';
                el.style.borderColor = 'var(--glass-border)';
                el.style.color = 'var(--text-secondary)';
            }
        }
    });
    
    const titleEl = document.getElementById('custom-builder-title');
    const addBtnText = document.getElementById('custom-builder-add-btn-text');
    const container = document.getElementById('custom-class-rows-container');
    if (container) container.innerHTML = '';
    
    if (disc === 'gait') {
        if (titleEl) titleEl.innerHTML = '🇮🇸 Opgavedele / Øvelser til bedømmelse (Vægtede dele)';
        if (addBtnText) addBtnText.innerText = 'Tilføj Opgavedel';
        window.addCustomClassRow({ seq: 1, name: 'Valgfrit tempo tølt', coeff: 1, active: true });
        window.addCustomClassRow({ seq: 2, name: 'Langsom til middel trav', coeff: 1, active: true });
        window.addCustomClassRow({ seq: 3, name: 'Middelskridt', coeff: 1, active: true });
    } else if (disc === 'dressage') {
        if (titleEl) titleEl.innerHTML = '🐎 Dressur: Øvelser, Anvisninger & Koefficienter';
        if (addBtnText) addBtnText.innerText = 'Tilføj Dressurøvelse';
        window.addCustomClassRow({ seq: 1, code: 'A-X', name: 'Indridning i arbejdstrav, parade og hilsen', coeff: 1, directives: 'Lige linje, ro, overgange', active: true });
        window.addCustomClassRow({ seq: 2, code: 'C-M-B', name: 'Arbejdstrav på hovslaget', coeff: 1, directives: 'Takt og balance', active: true });
        window.addCustomClassRow({ seq: 3, code: 'B', name: 'Volte 20m', coeff: 1, directives: 'Form og runding', active: true });
    } else if (disc === 'jumping') {
        if (titleEl) titleEl.innerHTML = '🚧 Springning: Forhindringer (Spring 1..N)';
        if (addBtnText) addBtnText.innerText = 'Tilføj Spring';
        for (let i = 1; i <= 10; i++) {
            const type = (i === 4 || i === 8) ? 'Oxer' : (i === 7) ? 'Kombination' : 'Lodret';
            window.addCustomClassRow({ seq: i, code: `Spring ${i}`, name: type, coeff: 2, directives: 'Hver nedrivning giver -2 point', active: true });
        }
    }
};

window.addCustomClassRow = function(data = null) {
    const container = document.getElementById('custom-class-rows-container');
    if (!container) return;
    const disc = document.getElementById('custom-class-discipline').value;
    const count = container.children.length + 1;
    
    const seq = data?.seq || count;
    const code = data?.code || (disc === 'jumping' ? `Spring ${seq}` : (disc === 'dressage' ? `ØV_${seq}` : `DEL_${seq}`));
    const name = data?.name || '';
    const coeff = data?.coeff || (disc === 'jumping' ? 2 : 1);
    const directives = data?.directives || '';
    const isActive = data?.active !== undefined ? data.active : true;
    
    const rowId = `custom-row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'custom-class-row';
    row.style.background = 'rgba(255,255,255,0.03)';
    row.style.border = '1px solid var(--glass-border)';
    row.style.borderRadius = '8px';
    row.style.padding = '0.8rem';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '0.5rem';
    
    if (disc === 'gait') {
        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <input type="checkbox" class="custom-row-select-cb" onchange="window.updateCustomSelectedCount()" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                    <span style="font-weight: 700; color: #fbbf24; font-size: 0.85rem;">Opgavedel #${seq}</span>
                </div>
                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    <label style="font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.3rem; margin: 0; cursor: pointer;">
                        <input type="checkbox" class="custom-row-active" ${isActive ? 'checked' : ''} style="cursor: pointer;">
                        Aktiv
                    </label>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceCustomRows(); window.updateCustomSelectedCount();">Slet</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="hidden" class="custom-row-seq" value="${seq}">
                <div style="flex: 1;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Hvad går øvelsen ud på? (F.eks. Langsom tølt, Trav, Skridt)</label>
                    <input type="text" class="custom-row-name" value="${name}" placeholder="Beskriv opgavedelen..." required style="width: 100%; padding: 0.4rem; font-size: 0.85rem;">
                </div>
                <div style="width: 80px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Vægt</label>
                    <input type="number" class="custom-row-coeff" value="${coeff}" step="1" min="1" max="5" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center;">
                </div>
            </div>
        `;
    } else if (disc === 'dressage') {
        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <input type="checkbox" class="custom-row-select-cb" onchange="window.updateCustomSelectedCount()" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                    <span style="font-weight: 700; color: #10b981; font-size: 0.85rem;">Øvelse #${seq}</span>
                </div>
                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    <label style="font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.3rem; margin: 0; cursor: pointer;">
                        <input type="checkbox" class="custom-row-active" ${isActive ? 'checked' : ''} style="cursor: pointer;">
                        Aktiv
                    </label>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceCustomRows(); window.updateCustomSelectedCount();">Slet</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="hidden" class="custom-row-seq" value="${seq}">
                <div style="width: 90px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Bogstav</label>
                    <input type="text" class="custom-row-code" value="${code}" placeholder="F.eks. A-X-C" style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center; text-transform: uppercase;">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Øvelse & Anvisning</label>
                    <input type="text" class="custom-row-name" value="${name}" placeholder="F.eks. Indridning i arbejdstrav, parade..." required style="width: 100%; padding: 0.4rem; font-size: 0.85rem;">
                </div>
                <div style="width: 70px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Koeff.</label>
                    <input type="number" class="custom-row-coeff" value="${coeff}" step="0.5" min="0.5" max="3" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center;">
                </div>
            </div>
            <div>
                <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Retningslinjer / Fokuspunkter (Valgfri)</label>
                <input type="text" class="custom-row-directives" value="${directives}" placeholder="Takt, ligeudretning, overgang..." style="width: 100%; padding: 0.4rem; font-size: 0.85rem;">
            </div>
        `;
    } else if (disc === 'jumping') {
        row.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <input type="checkbox" class="custom-row-select-cb" onchange="window.updateCustomSelectedCount()" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                    <span style="font-weight: 700; color: #60a5fa; font-size: 0.85rem;">Spring #${seq}</span>
                </div>
                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    <label style="font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.3rem; margin: 0; cursor: pointer;">
                        <input type="checkbox" class="custom-row-active" ${isActive ? 'checked' : ''} style="cursor: pointer;">
                        Aktiv
                    </label>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceCustomRows(); window.updateCustomSelectedCount();">Slet</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="hidden" class="custom-row-seq" value="${seq}">
                <div style="width: 100px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Forhindring</label>
                    <input type="text" class="custom-row-code" value="${code}" readonly style="width: 100%; padding: 0.4rem; font-size: 0.85rem; font-weight: bold; background: rgba(0,0,0,0.3); text-align: center;">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Type / Beskrivelse</label>
                    <select class="custom-row-name" style="width: 100%; padding: 0.4rem; font-size: 0.85rem; background: rgba(15,23,42,0.6); color: #fff; border: 1px solid var(--glass-border); border-radius: 6px;">
                        <option value="Lodret" ${name === 'Lodret' ? 'selected' : ''}>Lodret</option>
                        <option value="Oxer" ${name === 'Oxer' ? 'selected' : ''}>Oxer</option>
                        <option value="Kombination (dobbeltspring)" ${name.includes('Kombination') ? 'selected' : ''}>Kombination (dobbeltspring)</option>
                        <option value="Mur" ${name === 'Mur' ? 'selected' : ''}>Mur</option>
                        <option value="Vandgrav / Planke" ${name.includes('Vandgrav') ? 'selected' : ''}>Vandgrav / Planke</option>
                        <option value="Kryds / Bom på jord" ${name.includes('Kryds') ? 'selected' : ''}>Kryds / Bom på jord</option>
                    </select>
                </div>
                <div style="width: 110px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Nedrivningsstraf</label>
                    <input type="text" value="-2 point" readonly style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center; color: #ef4444; font-weight: bold; background: rgba(0,0,0,0.3);">
                    <input type="hidden" class="custom-row-coeff" value="2">
                </div>
            </div>
        `;
    }
    
    container.appendChild(row);
    window.updateCustomSelectedCount();
};

window.updateCustomSelectedCount = function() {
    const container = document.getElementById('custom-class-rows-container');
    if (!container) return;
    const allCbs = container.querySelectorAll('.custom-row-select-cb');
    const checkedCbs = container.querySelectorAll('.custom-row-select-cb:checked');
    const count = checkedCbs.length;
    
    const countEl = document.getElementById('custom-selected-count');
    const btnCountEl = document.getElementById('custom-btn-count');
    const delBtn = document.getElementById('custom-bulk-delete-btn');
    const actBtn = document.getElementById('custom-bulk-active-btn');
    const inactBtn = document.getElementById('custom-bulk-inactive-btn');
    const selectAllCb = document.getElementById('custom-select-all-cb');
    
    if (countEl) countEl.innerText = count;
    if (btnCountEl) btnCountEl.innerText = count;
    
    if (delBtn) delBtn.disabled = count === 0;
    if (actBtn) actBtn.disabled = count === 0;
    if (inactBtn) inactBtn.disabled = count === 0;
    
    if (selectAllCb) {
        if (allCbs.length === 0) {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = false;
        } else if (count === allCbs.length) {
            selectAllCb.checked = true;
            selectAllCb.indeterminate = false;
        } else if (count > 0) {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = true;
        } else {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = false;
        }
    }
};

window.toggleSelectAllCustomRows = function(checked) {
    const container = document.getElementById('custom-class-rows-container');
    if (!container) return;
    container.querySelectorAll('.custom-row-select-cb').forEach(cb => {
        cb.checked = checked;
    });
    window.updateCustomSelectedCount();
};

window.deleteSelectedCustomRows = function() {
    const container = document.getElementById('custom-class-rows-container');
    if (!container) return;
    const checkedCbs = Array.from(container.querySelectorAll('.custom-row-select-cb:checked'));
    if (checkedCbs.length === 0) return;
    
    if (!confirm(`Er du sikker på, at du vil slette ${checkedCbs.length} valgte rækker?`)) return;
    
    checkedCbs.forEach(cb => {
        const row = cb.closest('.custom-class-row');
        if (row) row.remove();
    });
    
    window.resequenceCustomRows();
    window.updateCustomSelectedCount();
};

window.setBulkActiveCustomRows = function(isActive) {
    const container = document.getElementById('custom-class-rows-container');
    if (!container) return;
    const checkedCbs = Array.from(container.querySelectorAll('.custom-row-select-cb:checked'));
    if (checkedCbs.length === 0) return;
    
    checkedCbs.forEach(cb => {
        const row = cb.closest('.custom-class-row');
        if (row) {
            const actCb = row.querySelector('.custom-row-active');
            if (actCb) actCb.checked = isActive;
        }
    });
};

window.resequenceCustomRows = function() {
    const container = document.getElementById('custom-class-rows-container');
    const disc = document.getElementById('custom-class-discipline').value;
    Array.from(container.children).forEach((row, idx) => {
        const seqVal = idx + 1;
        const seqInput = row.querySelector('.custom-row-seq');
        if (seqInput) seqInput.value = seqVal;
        
        const titleSpan = row.querySelector('div span');
        if (titleSpan) {
            const label = disc === 'jumping' ? 'Spring' : (disc === 'dressage' ? 'Øvelse' : 'Opgavedel');
            titleSpan.innerText = `${label} #${seqVal}`;
        }
        
        const codeInput = row.querySelector('.custom-row-code');
        if (codeInput && disc === 'jumping') {
            codeInput.value = `Spring ${seqVal}`;
        }
    });
};

window.saveCustomClubClass = async function(e) {
    e.preventDefault();
    if (!window.activeClubId) {
        alert("Log venligst ind i en klub først.");
        return;
    }
    
    const disc = document.getElementById('custom-class-discipline').value;
    const name = document.getElementById('custom-class-name').value.trim();
    const location = document.getElementById('custom-class-location').value.trim() || null;
    const description = document.getElementById('custom-class-description').value.trim() || null;
    
    if (!name) {
        alert("Indtast venligst et klassenavn.");
        return;
    }
    
    const rows = document.querySelectorAll('.custom-class-row');
    let config = {};
    let code = name.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 15) || `KL_${Date.now()}`;
    
    if (disc === 'gait') {
        config.sections = Array.from(rows).map(r => ({
            sequence: parseInt(r.querySelector('.custom-row-seq').value),
            name: r.querySelector('.custom-row-name').value.trim(),
            weight: parseInt(r.querySelector('.custom-row-coeff').value || 1),
            is_active: r.querySelector('.custom-row-active').checked
        }));
        config.discardHighestAndLowest = false;
        config.officialResultDecimals = 2;
    } else if (disc === 'dressage') {
        config.exercises = Array.from(rows).map(r => ({
            sequence: parseInt(r.querySelector('.custom-row-seq').value),
            code: (r.querySelector('.custom-row-code')?.value || `EX_${r.querySelector('.custom-row-seq').value}`).toUpperCase().trim(),
            name: r.querySelector('.custom-row-name').value.trim(),
            coefficient: parseFloat(r.querySelector('.custom-row-coeff').value || 1.0),
            maxMark: 10,
            allowedIncrement: 0.5,
            directiveIdeas: (r.querySelector('.custom-row-directives')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
            is_active: r.querySelector('.custom-row-active').checked
        }));
        config.officialResultDecimals = 2;
    } else if (disc === 'jumping') {
        config.obstacles = Array.from(rows).map(r => ({
            sequence: parseInt(r.querySelector('.custom-row-seq').value),
            code: r.querySelector('.custom-row-code').value.trim(),
            name: r.querySelector('.custom-row-name').value.trim(),
            knockdownPenalty: 2,
            is_active: r.querySelector('.custom-row-active').checked
        }));
        config.allowedTime = 75;
        config.maximumTime = 150;
        config.officialResultDecimals = 2;
    }
    
    const token = localStorage.getItem('equievent_token') || sessionStorage.getItem('equievent_token');
    
    try {
        // Save ClassDefinition for the club (this automatically creates or updates the ClubPost on backend)
        const defRes = await fetch(`${API_BASE}/api/v1/clubs/${window.activeClubId}/class-definitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                code: code,
                name: name,
                discipline: disc,
                scoring_model: disc === 'dressage' ? 'dressage_percentage' : (disc === 'jumping' ? 'faults_time' : 'gait_standard'),
                configuration: JSON.stringify(config)
            })
        });
        
        if (defRes.ok) {
            document.getElementById('custom-class-create-form').reset();
            alert(`✅ Klassen "${name}" er nu oprettet for din klub og gemt under dine aktive klasser!`);
            window.switchPostsSubTab('active');
            if (window.fetchClubPosts) window.fetchClubPosts();
        } else {
            const errData = await defRes.json();
            alert("Fejl ved oprettelse: " + (errData.detail || "Ukendt fejl."));
        }
    } catch(err) {
        console.error(err);
        alert("Kunne ikke oprette klassen på serveren.");
    }
};

// ==========================================
// V1 CLASS TEMPLATES ADMINISTRATOR PANEL
// ==========================================

window.filterStandardsByDiscipline = function(disc) {
    window.currentStandardsDisciplineFilter = disc;
    
    document.querySelectorAll('.std-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.borderColor = 'var(--glass-border)';
        btn.style.color = 'var(--text-secondary)';
    });
    
    const targetBtn = Array.from(document.querySelectorAll('.std-filter-btn')).find(b => b.getAttribute('onclick')?.includes(`'${disc}'`));
    if (targetBtn) {
        targetBtn.classList.add('active');
        targetBtn.style.background = 'rgba(255,255,255,0.2)';
        targetBtn.style.color = '#fff';
    }
    
    window.loadV1ClassTemplates();
};

window.loadV1ClassTemplates = async function() {
    const listContainer = document.getElementById('v1-class-templates-list');
    if (!listContainer) return;
    
    if (!window.activeClubId) {
        listContainer.innerHTML = '<span style="color: var(--text-secondary);">Log venligst ind i en klub først.</span>';
        return;
    }
    
    listContainer.innerHTML = '<span style="color: var(--text-secondary);">Indlæser skabeloner...</span>';
    
    try {
        const res = await fetch(`${API_BASE}/api/v1/clubs/${window.activeClubId}/class-definitions`);
        if (!res.ok) throw new Error("Fejl ved hentning af skabeloner.");
        const rawTemplates = await res.json();
        
        const filter = window.currentStandardsDisciplineFilter || 'all';
        const filteredTemplates = rawTemplates.filter(t => {
            if (filter === 'all') return true;
            return (t.discipline || '') === filter;
        });
        
        const templates = window.sortClassesByDifficulty(filteredTemplates);
        
        listContainer.innerHTML = '';
        if (templates.length === 0) {
            listContainer.innerHTML = '<span style="color: var(--text-secondary);">Ingen skabeloner fundet for den valgte disciplin.</span>';
            return;
        }
        
        templates.forEach(tpl => {
            const isCustom = tpl.club_id !== null;
            const badgeBg = isCustom ? 'rgba(251, 191, 36, 0.15)' : 'rgba(96, 165, 250, 0.15)';
            const badgeColor = isCustom ? '#fbbf24' : '#60a5fa';
            const badgeText = isCustom ? 'Klub-tilpasset' : 'Standard (FEIF/DRF)';
            
            let discBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">🐎 DRESSUR</span>';
            if (tpl.discipline === 'jumping') {
                discBadge = '<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-weight: 700;">🚧 SPRING</span>';
            } else if (tpl.discipline === 'gait') {
                discBadge = '<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; font-weight: 700;">🇮🇸 ISLÆNDER</span>';
            }
            
            const card = document.createElement('div');
            card.className = 'glass-panel';
            card.style.padding = '1.25rem';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.gap = '1rem';
            card.style.border = isCustom ? '1px solid rgba(251, 191, 36, 0.4)' : '1px solid var(--glass-border)';
            card.style.borderRadius = '12px';
            
            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; gap: 0.5rem;">
                        <strong style="color: white; font-size: 1.05rem;">${tpl.name}</strong>
                        <div style="display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap;">
                            ${discBadge}
                            <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 600; font-size: 0.7rem; text-transform: uppercase;">${badgeText}</span>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Kode: <strong>${tpl.code}</strong></div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Disciplin: <strong>${tpl.discipline === 'gait' ? 'Islandsk (Gangart)' : tpl.discipline === 'dressage' ? 'Dressur' : 'Spring'}</strong></div>
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm" style="width: 100%; border: 1px solid rgba(251, 191, 36, 0.3); font-weight: 700;" onclick='window.editV1ClassTemplate(${JSON.stringify(tpl).replace(/'/g, "&apos;")})'>
                        <i class="fas fa-edit"></i> Tilpas øvelser / Rediger
                    </button>
                </div>
            `;
            listContainer.appendChild(card);
        });
    } catch(err) {
        console.error(err);
        listContainer.innerHTML = '<span style="color: #ef4444;">Kunne ikke hente klasseskabeloner.</span>';
    }
};

window.editV1ClassTemplate = function(tpl, isSa = false) {
    window.saEditingGlobalTemplate = isSa;
    
    document.getElementById('v1-template-class-id').value = tpl.id;
    document.getElementById('v1-template-class-code').value = tpl.code;
    document.getElementById('v1-template-class-discipline').value = tpl.discipline;
    document.getElementById('v1-template-class-scoring').value = tpl.scoring_model;
    document.getElementById('v1-template-class-name').value = tpl.name;
    
    if (isSa) {
        document.getElementById('v1-template-modal-title').innerText = `System: Rediger Global Standardskabelon (${tpl.code})`;
    } else {
        document.getElementById('v1-template-modal-title').innerText = `Tilpas Skabelon: ${tpl.code} (${tpl.name})`;
    }
    
    // Section header & Add row button
    const headingEl = document.getElementById('v1-template-section-heading');
    const addBtn = document.getElementById('v1-template-add-row-btn');
    if (tpl.discipline === 'dressage') {
        if (headingEl) headingEl.innerText = 'Dressurøvelser & Anvisninger';
        if (addBtn) addBtn.innerText = '+ Tilføj Dressurøvelse';
    } else if (tpl.discipline === 'jumping') {
        if (headingEl) headingEl.innerText = 'Forhindringer (Spring 1..N)';
        if (addBtn) addBtn.innerText = '+ Tilføj Spring';
    } else if (tpl.discipline === 'gait') {
        if (headingEl) headingEl.innerText = 'Opgavedele / Øvelser (Vægtet)';
        if (addBtn) addBtn.innerText = '+ Tilføj Opgavedel';
    }
    
    // Reset button visibility
    const resetBtn = document.getElementById('v1-template-reset-btn');
    if (!isSa && tpl.club_id !== null) {
        resetBtn.style.display = 'block';
    } else {
        resetBtn.style.display = 'none';
    }
    
    const container = document.getElementById('v1-template-exercises-container');
    container.innerHTML = '';
    
    const config = JSON.parse(tpl.configuration || '{}');
    
    if (tpl.discipline === 'dressage') {
        const exercises = config.exercises || [];
        exercises.forEach((ex, idx) => {
            window.addV1TemplateExerciseRow(ex.sequence, ex.code, ex.name, ex.coefficient, ex.directiveIdeas ? ex.directiveIdeas.join(', ') : '', ex.is_active !== false);
        });
    } else if (tpl.discipline === 'gait') {
        const sections = config.sections || [];
        sections.forEach((sec, idx) => {
            window.addV1TemplateExerciseRow(sec.sequence, '', sec.name, sec.weight, '', sec.is_active !== false);
        });
    } else if (tpl.discipline === 'jumping') {
        const obstacles = config.obstacles || [];
        if (obstacles.length > 0) {
            obstacles.forEach(obs => {
                window.addV1TemplateExerciseRow(obs.sequence, obs.code, obs.name, obs.knockdownPenalty || 2, '', obs.is_active !== false);
            });
        } else {
            const defaultCount = (tpl.name && (tpl.name.includes('MA') || tpl.name.includes('S'))) ? 18 : 10;
            for (let i = 1; i <= defaultCount; i++) {
                const type = (i === 4 || i === 8) ? 'Oxer' : (i === 7) ? 'Kombination' : 'Lodret';
                window.addV1TemplateExerciseRow(i, `Spring ${i}`, type, 2, '', true);
            }
        }
    }
    
    document.getElementById('v1-edit-template-modal').style.display = 'flex';
};

window.addV1TemplateExerciseRow = function(seq = '', code = '', name = '', coeff = 1, directives = '', isActive = true) {
    const container = document.getElementById('v1-template-exercises-container');
    const discipline = document.getElementById('v1-template-class-discipline').value;
    
    const rowCount = container.children.length;
    const finalSeq = seq || (rowCount + 1);
    const rowId = `tpl-row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'v1-template-exercise-row';
    row.style.background = 'rgba(255,255,255,0.03)';
    row.style.border = '1px solid var(--glass-border)';
    row.style.borderRadius = '8px';
    row.style.padding = '0.8rem';
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '0.5rem';
    row.style.position = 'relative';
    
    if (discipline === 'dressage') {
        row.innerHTML = `
            <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <input type="checkbox" class="tpl-row-select-cb" onchange="window.updateTemplateSelectedCount()" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                    <div style="font-weight: bold; color: #10b981; font-size: 0.85rem;">Øvelse #${finalSeq}</div>
                </div>
                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    <label style="font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.3rem; margin: 0; cursor: pointer;">
                        <input type="checkbox" class="tpl-ex-active" ${isActive ? 'checked' : ''} style="cursor: pointer;">
                        Aktiv til bedømmelse
                    </label>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceV1TemplateRows(); window.updateTemplateSelectedCount();">Slet</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="hidden" class="tpl-ex-seq" value="${finalSeq}">
                <div style="width: 80px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Bogstav</label>
                    <input type="text" class="tpl-ex-code" value="${code || 'EX_' + finalSeq}" style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center; text-transform: uppercase;">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Øvelse & Anvisning</label>
                    <input type="text" class="tpl-ex-name" value="${name}" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem;">
                </div>
                <div style="width: 70px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Koefficient</label>
                    <input type="number" class="tpl-ex-coeff" value="${coeff}" step="0.5" min="0.5" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center;">
                </div>
            </div>
            <div>
                <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Retningslinjer / Fokuspunkter (Adskil med komma)</label>
                <input type="text" class="tpl-ex-directives" value="${directives}" placeholder="lige linje, takt, ro..." style="width: 100%; padding: 0.4rem; font-size: 0.85rem;">
            </div>
        `;
    } else if (discipline === 'gait') {
        row.innerHTML = `
            <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <input type="checkbox" class="tpl-row-select-cb" onchange="window.updateTemplateSelectedCount()" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                    <div style="font-weight: bold; color: #fbbf24; font-size: 0.85rem;">Opgavedel #${finalSeq}</div>
                </div>
                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    <label style="font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.3rem; margin: 0; cursor: pointer;">
                        <input type="checkbox" class="tpl-ex-active" ${isActive ? 'checked' : ''} style="cursor: pointer;">
                        Aktiv til bedømmelse
                    </label>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceV1TemplateRows(); window.updateTemplateSelectedCount();">Slet</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="hidden" class="tpl-ex-seq" value="${finalSeq}">
                <div style="flex: 1;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Beskrivelse (F.eks. Tølt i langsomt tempo)</label>
                    <input type="text" class="tpl-ex-name" value="${name}" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem;">
                </div>
                <div style="width: 70px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Vægt</label>
                    <input type="number" class="tpl-ex-coeff" value="${coeff}" step="1" min="1" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center;">
                </div>
            </div>
        `;
    } else if (discipline === 'jumping') {
        const obsLabel = code || `Spring ${finalSeq}`;
        row.innerHTML = `
            <div style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <input type="checkbox" class="tpl-row-select-cb" onchange="window.updateTemplateSelectedCount()" style="width: 16px; height: 16px; margin: 0; cursor: pointer;">
                    <div style="font-weight: bold; color: #60a5fa; font-size: 0.85rem;">Spring #${finalSeq}</div>
                </div>
                <div style="display: flex; gap: 0.8rem; align-items: center;">
                    <label style="font-size: 0.75rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.3rem; margin: 0; cursor: pointer;">
                        <input type="checkbox" class="tpl-ex-active" ${isActive ? 'checked' : ''} style="cursor: pointer;">
                        Aktiv til bedømmelse
                    </label>
                    <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceV1TemplateRows(); window.updateTemplateSelectedCount();">Slet</button>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="hidden" class="tpl-ex-seq" value="${finalSeq}">
                <div style="width: 90px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Nummer</label>
                    <input type="text" class="tpl-ex-code" value="${obsLabel}" readonly style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center; font-weight: bold; background: rgba(0,0,0,0.3);">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Type / Beskrivelse</label>
                    <select class="tpl-ex-name" style="width: 100%; padding: 0.4rem; font-size: 0.85rem; background: rgba(15,23,42,0.6); color: #fff; border: 1px solid var(--glass-border); border-radius: 6px;">
                        <option value="Lodret" ${name === 'Lodret' ? 'selected' : ''}>Lodret</option>
                        <option value="Oxer" ${name === 'Oxer' ? 'selected' : ''}>Oxer</option>
                        <option value="Kombination (dobbeltspring)" ${name.includes('Kombination') ? 'selected' : ''}>Kombination (dobbeltspring)</option>
                        <option value="Mur" ${name === 'Mur' ? 'selected' : ''}>Mur</option>
                        <option value="Vandgrav / Planke" ${name.includes('Vandgrav') ? 'selected' : ''}>Vandgrav / Planke</option>
                        <option value="Kryds / Bom på jord" ${name.includes('Kryds') ? 'selected' : ''}>Kryds / Bom på jord</option>
                    </select>
                </div>
                <div style="width: 100px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Nedrivning</label>
                    <input type="text" value="-2 point" readonly style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center; color: #ef4444; font-weight: bold; background: rgba(0,0,0,0.3);">
                    <input type="hidden" class="tpl-ex-coeff" value="2">
                </div>
            </div>
        `;
    }
    
    container.appendChild(row);
    window.updateTemplateSelectedCount();
};

window.updateTemplateSelectedCount = function() {
    const container = document.getElementById('v1-template-exercises-container');
    if (!container) return;
    const allCbs = container.querySelectorAll('.tpl-row-select-cb');
    const checkedCbs = container.querySelectorAll('.tpl-row-select-cb:checked');
    const count = checkedCbs.length;
    
    const countEl = document.getElementById('v1-tpl-selected-count');
    const btnCountEl = document.getElementById('v1-tpl-btn-count');
    const delBtn = document.getElementById('v1-tpl-bulk-delete-btn');
    const actBtn = document.getElementById('v1-tpl-bulk-active-btn');
    const inactBtn = document.getElementById('v1-tpl-bulk-inactive-btn');
    const selectAllCb = document.getElementById('v1-tpl-select-all-cb');
    
    if (countEl) countEl.innerText = count;
    if (btnCountEl) btnCountEl.innerText = count;
    
    if (delBtn) delBtn.disabled = count === 0;
    if (actBtn) actBtn.disabled = count === 0;
    if (inactBtn) inactBtn.disabled = count === 0;
    
    if (selectAllCb) {
        if (allCbs.length === 0) {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = false;
        } else if (count === allCbs.length) {
            selectAllCb.checked = true;
            selectAllCb.indeterminate = false;
        } else if (count > 0) {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = true;
        } else {
            selectAllCb.checked = false;
            selectAllCb.indeterminate = false;
        }
    }
};

window.toggleSelectAllTemplateRows = function(checked) {
    const container = document.getElementById('v1-template-exercises-container');
    if (!container) return;
    container.querySelectorAll('.tpl-row-select-cb').forEach(cb => {
        cb.checked = checked;
    });
    window.updateTemplateSelectedCount();
};

window.deleteSelectedTemplateRows = function() {
    const container = document.getElementById('v1-template-exercises-container');
    if (!container) return;
    const checkedCbs = Array.from(container.querySelectorAll('.tpl-row-select-cb:checked'));
    if (checkedCbs.length === 0) return;
    
    if (!confirm(`Er du sikker på, at du vil slette ${checkedCbs.length} valgte rækker?`)) return;
    
    checkedCbs.forEach(cb => {
        const row = cb.closest('.v1-template-exercise-row');
        if (row) row.remove();
    });
    
    window.resequenceV1TemplateRows();
    window.updateTemplateSelectedCount();
};

window.setBulkActiveTemplateRows = function(isActive) {
    const container = document.getElementById('v1-template-exercises-container');
    if (!container) return;
    const checkedCbs = Array.from(container.querySelectorAll('.tpl-row-select-cb:checked'));
    if (checkedCbs.length === 0) return;
    
    checkedCbs.forEach(cb => {
        const row = cb.closest('.v1-template-exercise-row');
        if (row) {
            const actCb = row.querySelector('.tpl-ex-active');
            if (actCb) actCb.checked = isActive;
        }
    });
};

window.resequenceV1TemplateRows = function() {
    const container = document.getElementById('v1-template-exercises-container');
    const discipline = document.getElementById('v1-template-class-discipline').value;
    Array.from(container.children).forEach((row, idx) => {
        const seqVal = idx + 1;
        const seqInput = row.querySelector('.tpl-ex-seq');
        if (seqInput) seqInput.value = seqVal;
        
        const titleDiv = row.querySelector('div div');
        if (titleDiv) {
            const label = discipline === 'jumping' ? 'Spring' : (discipline === 'dressage' ? 'Øvelse' : 'Opgavedel');
            titleDiv.innerText = `${label} #${seqVal}`;
        }
        
        const codeInput = row.querySelector('.tpl-ex-code');
        if (codeInput && discipline === 'jumping') {
            codeInput.value = `Spring ${seqVal}`;
        }
    });
};

window.resetV1TemplateToStandard = async function() {
    const classId = document.getElementById('v1-template-class-id').value;
    if (!classId || !window.activeClubId) return;
    
    if (!confirm("Er du sikker på, at du vil nulstille denne klasseskabelon til landsorganisationens standard?")) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/v1/clubs/${window.activeClubId}/class-definitions/${classId}/reset`, {
            method: 'DELETE'
        });
        if (res.ok) {
            document.getElementById('v1-edit-template-modal').style.display = 'none';
            window.loadV1ClassTemplates();
        } else {
            const data = await res.json();
            alert("Fejl: " + (data.detail || "Kunne ikke nulstille skabelon."));
        }
    } catch(err) {
        console.error(err);
        alert("Kunne ikke kontakte serveren.");
    }
};

// Bind form submit for class template edit
document.getElementById('v1-template-edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = document.getElementById('v1-template-class-code').value;
    const discipline = document.getElementById('v1-template-class-discipline').value;
    const scoring = document.getElementById('v1-template-class-scoring').value;
    const name = document.getElementById('v1-template-class-name').value;
    
    let config = {};
    const rows = document.querySelectorAll('.v1-template-exercise-row');
    
    if (discipline === 'dressage') {
        config.exercises = Array.from(rows).map(row => {
            const seq = parseInt(row.querySelector('.tpl-ex-seq').value);
            const exName = row.querySelector('.tpl-ex-name').value;
            const coeff = parseFloat(row.querySelector('.tpl-ex-coeff').value);
            const exCode = row.querySelector('.tpl-ex-code').value || `EX_${seq}`;
            const directives = row.querySelector('.tpl-ex-directives')?.value || '';
            const isActive = row.querySelector('.tpl-ex-active')?.checked !== false;
            return {
                sequence: seq,
                code: exCode.toUpperCase(),
                name: exName,
                coefficient: coeff,
                maxMark: 10,
                allowedIncrement: 0.5,
                directiveIdeas: directives ? directives.split(',').map(s => s.trim()).filter(Boolean) : [],
                is_active: isActive
            };
        });
        config.officialResultDecimals = 2;
    } else if (discipline === 'gait') {
        config.sections = Array.from(rows).map(row => {
            const seq = parseInt(row.querySelector('.tpl-ex-seq').value);
            const secName = row.querySelector('.tpl-ex-name').value;
            const weight = parseInt(row.querySelector('.tpl-ex-coeff').value);
            const isActive = row.querySelector('.tpl-ex-active')?.checked !== false;
            return {
                sequence: seq,
                name: secName,
                weight: weight,
                is_active: isActive
            };
        });
        config.discardHighestAndLowest = false;
        config.judgeMarkDecimals = 1;
        config.officialResultDecimals = 2;
        config.markIncrement = 0.5;
    } else if (discipline === 'jumping') {
        config.obstacles = Array.from(rows).map(row => {
            const seq = parseInt(row.querySelector('.tpl-ex-seq').value);
            const obsCode = row.querySelector('.tpl-ex-code').value;
            const obsName = row.querySelector('.tpl-ex-name').value;
            const isActive = row.querySelector('.tpl-ex-active')?.checked !== false;
            return {
                sequence: seq,
                code: obsCode,
                name: obsName,
                knockdownPenalty: 2,
                is_active: isActive
            };
        });
        config.allowedTime = 75;
        config.maximumTime = 150;
        config.officialResultDecimals = 2;
    }
    
    const isSa = window.saEditingGlobalTemplate;
    const url = isSa 
        ? `${API_BASE}/admin/class-definitions`
        : `${API_BASE}/api/v1/clubs/${window.activeClubId}/class-definitions`;
    
    const headers = { 'Content-Type': 'application/json' };
    if (isSa) {
        const token = localStorage.getItem('equievent_token') || sessionStorage.getItem('equievent_token');
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                code: code,
                name: name,
                discipline: discipline,
                scoring_model: scoring,
                configuration: JSON.stringify(config)
            })
        });
        
        if (res.ok) {
            document.getElementById('v1-edit-template-modal').style.display = 'none';
            if (isSa) {
                window.loadSaGlobalTemplates();
            } else {
                window.loadV1ClassTemplates();
                if (window.fetchClubPosts) window.fetchClubPosts();
            }
        } else {
            const data = await res.json();
            alert("Fejl: " + (data.detail || "Kunne ikke gemme skabelon."));
        }
    } catch(err) {
        console.error(err);
        alert("Kunne ikke kontakte serveren.");
    }
});


window.getClassDifficultyRank = function(name, code, discipline) {
    const str = `${code || ''} ${name || ''}`.toUpperCase().replace(/\s+/g, ' ');
    const disc = (discipline || '').toLowerCase();
    
    if (disc === 'dressage' || str.includes('DRESSUR') || str.includes('DRF')) {
        let base = 1000;
        if (/\bLD\s*1\b/.test(str)) return base + 10;
        if (/\bLD\s*2\b/.test(str)) return base + 20;
        if (/\bLC\s*1\b/.test(str)) return base + 30;
        if (/\bLC\s*2\b/.test(str)) return base + 40;
        if (/\bLC\s*3\b/.test(str)) return base + 50;
        if (/\bLB\s*1\b/.test(str)) return base + 60;
        if (/\bLB\s*2\b/.test(str)) return base + 70;
        if (/\bLB\s*3\b/.test(str)) return base + 80;
        if (/\bLA\s*1\b/.test(str)) return base + 90;
        if (/\bLA\s*2\b/.test(str)) return base + 100;
        if (/\bLA\s*3\b/.test(str)) return base + 110;
        if (/\bLA\s*4\b/.test(str)) return base + 120;
        if (/\bLA\s*5\b/.test(str)) return base + 130;
        if (/\bLA\s*6\b/.test(str)) return base + 140;
        if (/\bMB\s*0\b/.test(str)) return base + 150;
        if (/\bMB\s*1\b/.test(str)) return base + 160;
        if (/\bMB\s*2\b/.test(str)) return base + 170;
        if (/\bMB\s*3\b/.test(str)) return base + 180;
        if (/\bMA\s*1\b/.test(str)) return base + 190;
        if (/\bMA\s*2\b/.test(str)) return base + 200;
        if (str.includes('PRIX ST') || str.includes('PSG')) return base + 210;
        if (str.includes('INTER I') && !str.includes('II')) return base + 220;
        if (str.includes('INTER A')) return base + 230;
        if (str.includes('INTER B')) return base + 240;
        if (str.includes('INTER II')) return base + 250;
        if (str.includes('SVÆR INTER')) return base + 260;
        if (str.includes('GRAND PRIX') || str.includes('GP')) return base + 270;
        if (str.includes('PRI')) return base + 280;
        if (str.includes('PRT')) return base + 290;
        if (str.includes('PRM')) return base + 300;
        if (str.includes('KÜR') || str.includes('KUR')) return base + 350;
        if (str.includes('ÅRS') || str.includes('INDL')) return base + 400;
        if (str.includes('STIL')) return base + 450;
        return base + 500;
    }
    
    if (disc === 'jumping' || str.includes('SPRING')) {
        let base = 2000;
        if (/\bLF\b/.test(str)) return base + 10;
        if (/\bLE\b/.test(str)) return base + 20;
        if (/\bLD\b/.test(str)) return base + 30;
        if (/\bLC\b/.test(str)) return base + 40;
        if (/\bLB\s*1\b/.test(str)) return base + 50;
        if (/\bLB\s*2\b/.test(str)) return base + 60;
        if (/\bLB\b/.test(str)) return base + 65;
        if (/\bLA\s*1\b/.test(str)) return base + 70;
        if (/\bLA\s*2\b/.test(str)) return base + 80;
        if (/\bLA\b/.test(str)) return base + 85;
        if (/\bMB\s*1\b/.test(str)) return base + 90;
        if (/\bMB\s*2\b/.test(str)) return base + 100;
        if (/\bMB\b/.test(str)) return base + 105;
        if (/\bMA\s*1\b/.test(str)) return base + 110;
        if (/\bMA\s*2\b/.test(str)) return base + 120;
        if (/\bMA\b/.test(str)) return base + 125;
        if (/\bS\s*1\b/.test(str)) return base + 130;
        if (/\bS\s*2\b/.test(str)) return base + 140;
        if (/\bS\b/.test(str)) return base + 145;
        return base + 200;
    }
    
    // Gait / Icelandic
    let base = 3000;
    if (/\b(T8|V5|BEGYNDER)\b/.test(str)) return base + 10;
    if (/\b(T7|V4)\b/.test(str)) return base + 20;
    if (/\b(T6|T5|V3)\b/.test(str)) return base + 30;
    if (/\b(T4|F2)\b/.test(str)) return base + 40;
    if (/\b(T3|V2)\b/.test(str)) return base + 50;
    if (/\b(T2|T1|V1|F1)\b/.test(str)) return base + 60;
    if (/\b(P1|P2|P3|PP1|PAS)\b/.test(str)) return base + 70;
    return base + 100;
};

window.sortClassesByDifficulty = function(list) {
    if (!list || !Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
        const discA = (a.discipline || '').toLowerCase();
        const discB = (b.discipline || '').toLowerCase();
        const discOrder = { dressage: 1, jumping: 2, gait: 3 };
        const orderA = discOrder[discA] || 4;
        const orderB = discOrder[discB] || 4;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        const rankA = window.getClassDifficultyRank(a.name, a.code, a.discipline);
        const rankB = window.getClassDifficultyRank(b.name, b.code, b.discipline);
        if (rankA !== rankB) {
            return rankA - rankB;
        }
        return (a.name || a.code || '').localeCompare(b.name || b.code || '', 'da');
    });
};

window.loadSaGlobalTemplates = async function() {
    const listContainer = document.getElementById('sa-global-templates-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '<span style="color: var(--text-secondary);">Indlæser standardskabeloner...</span>';
    
    try {
        const token = localStorage.getItem('equievent_token') || sessionStorage.getItem('equievent_token');
        if (!token) {
            listContainer.innerHTML = '<span style="color: #ef4444;">Du er ikke logged ind. Log venligst ud og ind igen.</span>';
            return;
        }
        
        const res = await fetch(`${API_BASE}/admin/class-definitions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.status === 401 || res.status === 403) {
            listContainer.innerHTML = '<span style="color: #ef4444;">Din login-session er udløbet, eller du har ikke adgang. Log venligst ud og ind igen for at forny din adgang.</span>';
            return;
        }
        
        if (!res.ok) throw new Error("Fejl ved hentning af globale skabeloner.");
        const templates = await res.json();
        
        // Sort templates by difficulty: Easiest first!
        window.saGlobalTemplatesList = window.sortClassesByDifficulty(templates);
        
        renderSaTemplatesFiltered('all');
    } catch(err) {
        console.error(err);
        listContainer.innerHTML = '<span style="color: #ef4444;">Kunne ikke hente globale skabeloner.</span>';
    }
};

window.filterSaTemplates = function(discipline) {
    document.querySelectorAll('.sa-templates-filter').forEach(btn => {
        const text = btn.innerText.toLowerCase();
        const matches = (discipline === 'all' && text.includes('alle')) ||
                        (discipline === 'dressage' && text.includes('dressur')) ||
                        (discipline === 'jumping' && text.includes('spring')) ||
                        (discipline === 'gait' && text.includes('islandsk'));
        if (matches) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderSaTemplatesFiltered(discipline);
};

function renderSaTemplatesFiltered(discipline) {
    const listContainer = document.getElementById('sa-global-templates-list');
    if (!listContainer || !window.saGlobalTemplatesList) return;
    
    listContainer.innerHTML = '';
    
    const filtered = window.saGlobalTemplatesList.filter(tpl => {
        if (discipline === 'all') return true;
        return tpl.discipline === discipline;
    });
    
    if (filtered.length === 0) {
        listContainer.innerHTML = '<span style="color: var(--text-secondary);">Ingen skabeloner fundet for denne disciplin.</span>';
        return;
    }
    
    filtered.forEach(tpl => {
        const item = document.createElement('div');
        item.className = 'glass-panel';
        item.style.padding = '1rem';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.cursor = 'pointer';
        item.style.border = '1px solid var(--glass-border)';
        item.style.borderRadius = '8px';
        item.style.transition = 'all 0.2s ease';
        
        item.onclick = () => {
            window.editV1ClassTemplate(tpl, true);
        };
        
        let disciplineIcon = 'fa-horse';
        let disciplineColor = '#10b981';
        let disciplineBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700;">🐎 DRESSUR</span>';
        
        if (tpl.discipline === 'jumping') {
            disciplineIcon = 'fa-check-double';
            disciplineColor = '#3b82f6';
            disciplineBadge = '<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-weight: 700;">🚧 SPRING</span>';
        } else if (tpl.discipline === 'gait') {
            disciplineIcon = 'fa-paw';
            disciplineColor = '#fbbf24';
            disciplineBadge = '<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; font-weight: 700;">🇮🇸 ISLÆNDER</span>';
        }
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: ${disciplineColor}; border: 1px solid var(--glass-border); font-size: 1.1rem;">
                    <i class="fas ${disciplineIcon}"></i>
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 2px;">
                        <strong style="color: white; font-size: 0.95rem;">${tpl.code}</strong>
                        ${disciplineBadge}
                    </div>
                    <span style="font-size: 0.78rem; color: var(--text-secondary);">${tpl.name}</span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-secondary btn-sm" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;" onclick="event.stopPropagation(); window.editV1ClassTemplate(${JSON.stringify(tpl).replace(/"/g, '&quot;')}, true);">
                    <i class="fas fa-edit"></i> Ret Skabelon
                </button>
                <i class="fas fa-chevron-right" style="font-size: 0.8rem; color: var(--text-secondary);"></i>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

