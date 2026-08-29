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
// V1 CLASS TEMPLATES ADMINISTRATOR PANEL
// ==========================================

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
        const templates = await res.json();
        
        listContainer.innerHTML = '';
        if (templates.length === 0) {
            listContainer.innerHTML = '<span style="color: var(--text-secondary);">Ingen skabeloner fundet.</span>';
            return;
        }
        
        templates.forEach(tpl => {
            const isCustom = tpl.club_id !== null;
            const badgeBg = isCustom ? 'rgba(251, 191, 36, 0.15)' : 'rgba(96, 165, 250, 0.15)';
            const badgeColor = isCustom ? '#fbbf24' : '#60a5fa';
            const badgeText = isCustom ? 'Klub-tilpasset' : 'Standard (FEIF/DRF)';
            
            const card = document.createElement('div');
            card.className = 'glass-panel';
            card.style.padding = '1.25rem';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';
            card.style.gap = '1rem';
            card.style.border = '1px solid var(--glass-border)';
            card.style.borderRadius = '12px';
            
            card.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                        <strong style="color: white; font-size: 1.1rem;">${tpl.name}</strong>
                        <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 600; font-size: 0.7rem; text-transform: uppercase;">${badgeText}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Kode: <strong>${tpl.code}</strong></div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Disciplin: <strong>${tpl.discipline === 'gait' ? 'Islandsk' : tpl.discipline === 'dressage' ? 'Dressur' : 'Spring'}</strong></div>
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm" style="width: 100%; border: 1px solid rgba(251, 191, 36, 0.3);" onclick='window.editV1ClassTemplate(${JSON.stringify(tpl).replace(/'/g, "&apos;")})'>
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
        document.getElementById('v1-template-modal-title').innerText = `Tilpas Skabelon: ${tpl.code}`;
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
            window.addV1TemplateExerciseRow(ex.sequence, ex.code, ex.name, ex.coefficient, ex.directiveIdeas ? ex.directiveIdeas.join(', ') : '');
        });
    } else if (tpl.discipline === 'gait') {
        const sections = config.sections || [];
        sections.forEach((sec, idx) => {
            window.addV1TemplateExerciseRow(sec.sequence, '', sec.name, sec.weight, '');
        });
    } else if (tpl.discipline === 'jumping') {
        // Render jumping allowed/maximum time fields directly
        container.innerHTML = `
            <div style="display: flex; gap: 1rem; width: 100%;">
                <div class="input-group" style="flex: 1; margin-bottom: 0;">
                    <label>Fejlfri tid (Sekunder)</label>
                    <input type="number" step="1" id="v1-tpl-allowed-time" value="${config.allowedTime || 75}" required style="width: 100%;">
                </div>
                <div class="input-group" style="flex: 1; margin-bottom: 0;">
                    <label>Maksimumtid (Sekunder)</label>
                    <input type="number" step="1" id="v1-tpl-max-time" value="${config.maximumTime || 150}" required style="width: 100%;">
                </div>
            </div>
        `;
    }
    
    document.getElementById('v1-edit-template-modal').style.display = 'flex';
};

window.addV1TemplateExerciseRow = function(seq = '', code = '', name = '', coeff = 1, directives = '') {
    const container = document.getElementById('v1-template-exercises-container');
    const discipline = document.getElementById('v1-template-class-discipline').value;
    
    if (discipline === 'jumping') return; // Not using rows for jumping
    
    const rowCount = container.children.length;
    const finalSeq = seq || (rowCount + 1);
    const rowId = `tpl-row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'v1-template-exercise-row';
    row.style.background = 'rgba(255,255,255,0.02)';
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
                <div style="font-weight: bold; color: #fbbf24; font-size: 0.85rem;">Øvelse #${finalSeq}</div>
                <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceV1TemplateRows();">Slet</button>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <input type="hidden" class="tpl-ex-seq" value="${finalSeq}">
                <div style="flex: 1;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Øvelsesnavn</label>
                    <input type="text" class="tpl-ex-name" value="${name}" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem;">
                </div>
                <div style="width: 70px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Koefficient</label>
                    <input type="number" class="tpl-ex-coeff" value="${coeff}" step="0.5" min="0.5" required style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center;">
                </div>
                <div style="width: 80px;">
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Kode (Valgfri)</label>
                    <input type="text" class="tpl-ex-code" value="${code || 'EX_' + finalSeq}" style="width: 100%; padding: 0.4rem; font-size: 0.85rem; text-align: center; text-transform: uppercase;">
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
                <div style="font-weight: bold; color: #fbbf24; font-size: 0.85rem;">Opgavedel #${finalSeq}</div>
                <button type="button" class="btn btn-danger btn-sm" style="padding: 0.15rem 0.4rem; font-size: 0.7rem;" onclick="document.getElementById('${rowId}').remove(); window.resequenceV1TemplateRows();">Slet</button>
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
    }
    
    container.appendChild(row);
};

window.resequenceV1TemplateRows = function() {
    const container = document.getElementById('v1-template-exercises-container');
    Array.from(container.children).forEach((row, idx) => {
        const seqVal = idx + 1;
        const seqInput = row.querySelector('.tpl-ex-seq');
        if (seqInput) seqInput.value = seqVal;
        
        const titleDiv = row.querySelector('div div');
        if (titleDiv) {
            const discipline = document.getElementById('v1-template-class-discipline').value;
            const label = discipline === 'dressage' ? 'Øvelse' : 'Opgavedel';
            titleDiv.innerText = `${label} #${seqVal}`;
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
    
    if (discipline === 'dressage') {
        const rows = document.querySelectorAll('.v1-template-exercise-row');
        config.exercises = Array.from(rows).map(row => {
            const seq = parseInt(row.querySelector('.tpl-ex-seq').value);
            const exName = row.querySelector('.tpl-ex-name').value;
            const coeff = parseFloat(row.querySelector('.tpl-ex-coeff').value);
            const exCode = row.querySelector('.tpl-ex-code').value || `EX_${seq}`;
            const directives = row.querySelector('.tpl-ex-directives').value;
            return {
                sequence: seq,
                code: exCode.toUpperCase(),
                name: exName,
                coefficient: coeff,
                maxMark: 10,
                allowedIncrement: 0.5,
                directiveIdeas: directives ? directives.split(',').map(s => s.trim()).filter(Boolean) : []
            };
        });
        config.officialResultDecimals = 2;
    } else if (discipline === 'gait') {
        const rows = document.querySelectorAll('.v1-template-exercise-row');
        config.sections = Array.from(rows).map(row => {
            const seq = parseInt(row.querySelector('.tpl-ex-seq').value);
            const secName = row.querySelector('.tpl-ex-name').value;
            const weight = parseInt(row.querySelector('.tpl-ex-coeff').value);
            return {
                sequence: seq,
                name: secName,
                weight: weight
            };
        });
        config.discardHighestAndLowest = true;
        config.judgeMarkDecimals = 1;
        config.officialResultDecimals = 2;
        config.markIncrement = 0.5;
    } else if (discipline === 'jumping') {
        const allowedTime = parseFloat(document.getElementById('v1-tpl-allowed-time').value || 75);
        const maxTime = parseFloat(document.getElementById('v1-tpl-max-time').value || 150);
        config.allowedTime = allowedTime;
        config.maximumTime = maxTime;
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
        
        // Sort templates by code
        templates.sort((a, b) => a.code.localeCompare(b.code, 'da'));
        window.saGlobalTemplatesList = templates;
        
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
        if (tpl.discipline === 'jumping') {
            disciplineIcon = 'fa-check-double';
            disciplineColor = '#3b82f6';
        } else if (tpl.discipline === 'gait') {
            disciplineIcon = 'fa-paw';
            disciplineColor = '#fbbf24';
        }
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: ${disciplineColor}; border: 1px solid var(--glass-border);">
                    <i class="fas ${disciplineIcon}"></i>
                </div>
                <div>
                    <strong style="color: white; font-size: 0.95rem; display: block;">${tpl.code}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-secondary);">${tpl.name}</span>
                </div>
            </div>
            <i class="fas fa-chevron-right" style="font-size: 0.8rem; color: var(--text-secondary);"></i>
        `;
        listContainer.appendChild(item);
    });
}

