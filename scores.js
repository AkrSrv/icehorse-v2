// scores.js - Håndterer Magic Link Dommer-visning og Public Leaderboard

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

let magicUuid = null;
let magicJudge = null;
let activePostId = null;
window.activeClass = null;
window.activeClassRiders = [];
window.leaderboardData = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const magicParam = urlParams.get('magic');
    const leaderboardParam = urlParams.get('leaderboard');

    if (magicParam) {
        initMagicJudge(magicParam);
    } else if (leaderboardParam) {
        initPublicLeaderboard(leaderboardParam);
    }
});

// --- MAGIC LINK / DOMMER PANEL ---
async function initMagicJudge(uuid) {
    magicUuid = uuid;
    document.querySelectorAll('main').forEach(m => m.style.display = 'none'); // Skjul alt andet
    document.getElementById('magic-judge-section').style.display = 'block';
    
    try {
        const res = await fetch(`${API_BASE}/magic/${uuid}`);
        if (!res.ok) {
            alert('Ugyldigt eller udløbet dommer-link!');
            return;
        }
        magicJudge = await res.json();
        
        // Sæt UI
        document.getElementById('mj-title').innerText = `Dommer: ${magicJudge.club_judge.name}`;
        
        // Hent stævnets leaderboard for at få ryttere samt disciplin-info
        await fetchCompetitionRidersForJudge(magicJudge.competition_id);
        
        const select = document.getElementById('mj-post-select');
        // Fyld poster dropdown
        select.innerHTML = '<option value="">-- Vælg post --</option>';
        magicJudge.club_posts.forEach(post => {
            select.innerHTML += `<option value="${post.id}">${post.name}</option>`;
        });
        
        // Hide judging area initially
        document.getElementById('mj-post-selection').style.display = 'block';
        document.getElementById('mj-judging-area').style.display = 'none';
        
    } catch(err) {
        console.error(err);
        alert('Der opstod en fejl ved indlæsning af dit link.');
    }
}

async function fetchCompetitionRidersForJudge(compId) {
    try {
        const res = await fetch(`${API_BASE}/public/competitions/${compId}/leaderboard`);
        if (res.ok) {
            window.leaderboardData = await res.json();
        }
    } catch(err) { console.error(err); }
}

window.toggleJumpingStatusFields = function() {
    const status = document.getElementById('mj-jump-status').value;
    const statsFields = document.getElementById('mj-jumping-stats-fields');
    if (status === 'eliminated' || status === 'retired') {
        statsFields.style.display = 'none';
    } else {
        statsFields.style.display = 'block';
    }
};

window.startJudging = function() {
    const postSelect = document.getElementById('mj-post-select');
    if (!postSelect.value) return alert('Du skal vælge en post for at starte!');
    
    activePostId = parseInt(postSelect.value);
    window.activeClass = magicJudge.club_posts.find(p => p.id === activePostId);
    
    if (!window.activeClass) {
        alert('Klassen blev ikke fundet.');
        return;
    }
    
    const postName = postSelect.options[postSelect.selectedIndex].text;
    
    document.getElementById('mj-post-selection').style.display = 'none';
    document.getElementById('mj-judging-area').style.display = 'block';
    document.getElementById('mj-active-post-name').innerText = `Bedømmer: ${postName}`;
    
    // Find class data from leaderboard to get riders registered in this class
    if (window.leaderboardData && window.leaderboardData.classes) {
        const classData = window.leaderboardData.classes.find(c => c.class_id === activePostId);
        window.activeClassRiders = classData ? classData.leaderboard : [];
    } else {
        window.activeClassRiders = [];
    }
    
    // Configure scoring form fields based on class discipline & scoring method
    const disc = window.activeClass.discipline || 'gait';
    const method = window.activeClass.scoring_method || 'standard';
    
    if (disc === 'jumping') {
        document.getElementById('mj-points-group').style.display = 'none';
        document.getElementById('mj-deductions-group').style.display = 'none';
        document.getElementById('mj-jumping-fields').style.display = 'block';
        
        if (method === 'style') {
            document.getElementById('mj-jump-style-group').style.display = 'block';
        } else {
            document.getElementById('mj-jump-style-group').style.display = 'none';
        }
        
        if (method === 'jump_off') {
            document.getElementById('mj-jump-off-group').style.display = 'block';
        } else {
            document.getElementById('mj-jump-off-group').style.display = 'none';
        }
    } else {
        document.getElementById('mj-points-group').style.display = 'block';
        document.getElementById('mj-jumping-fields').style.display = 'none';
        
        if (disc === 'dressage') {
            document.getElementById('mj-deductions-group').style.display = 'block';
            document.getElementById('mj-points-label').innerText = "Karakter (0.00 - 10.00)";
        } else {
            document.getElementById('mj-deductions-group').style.display = 'none';
            document.getElementById('mj-points-label').innerText = "Point (0.00 - 10.00)";
        }
    }
};

window.changePost = function() {
    activePostId = null;
    window.activeClass = null;
    window.activeClassRiders = [];
    document.getElementById('mj-judging-area').style.display = 'none';
    document.getElementById('mj-post-selection').style.display = 'block';
    document.getElementById('mj-score-form').style.display = 'none';
};

window.searchRider = function() {
    const query = document.getElementById('mj-rider-search').value.toLowerCase();
    const resultsContainer = document.getElementById('mj-rider-search-results');
    resultsContainer.innerHTML = '';
    
    if (query.length < 1) return;
    
    const results = window.activeClassRiders.filter(r => 
        (r.start_number && r.start_number.toString().includes(query)) ||
        r.rider_name.toLowerCase().includes(query) ||
        r.horse_name.toLowerCase().includes(query)
    );
    
    results.forEach(r => {
        const startNo = r.start_number ? `<span class="badge" style="background: var(--primary);">#${r.start_number}</span>` : '';
        resultsContainer.innerHTML += `
            <div class="list-item" style="cursor: pointer; border-left: 4px solid #10b981; margin-bottom: 0;" onclick="selectRiderToScore(${r.rider_id}, '${r.rider_name}', '${r.horse_name}', ${r.start_number})">
                <div>
                    <strong>${r.rider_name}</strong> ${startNo}
                    <div style="font-size: 0.8rem; color: var(--text-secondary);"><i class="fas fa-horse-head"></i> ${r.horse_name}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
            </div>
        `;
    });
};

window.selectRiderToScore = function(riderId, riderName, horseName, startNo) {
    document.getElementById('mj-rider-search-results').innerHTML = '';
    document.getElementById('mj-rider-search').value = '';
    
    const riderData = window.activeClassRiders.find(r => r.rider_id === riderId);
    let existingScore = null;
    if (riderData && riderData.details) {
        existingScore = riderData.details.find(d => d.judge_id === magicJudge.id || d.judge_name === magicJudge.club_judge.name);
    }

    if (existingScore) {
        let prevScoreStr = "";
        if (window.activeClass.discipline === 'jumping') {
            prevScoreStr = `Tidligere status: ${existingScore.is_eliminated ? 'ELI' : (existingScore.is_retired ? 'RET' : (existingScore.is_clear ? 'Fejlfri' : 'Gennemført'))}`;
        } else {
            prevScoreStr = `Tidligere point: ${existingScore.points}`;
        }

        const confirmMsg = `Du har allerede bedømt denne ekvipage.\n\n${prevScoreStr}\n\nVil du åbne for at overskrive resultatet?`;
        if (!confirm(confirmMsg)) {
            return;
        }
        document.getElementById('mj-score-id').value = existingScore.score_id;
        
        if (window.activeClass.discipline === 'jumping') {
            if (existingScore.is_eliminated) {
                document.getElementById('mj-jump-status').value = 'eliminated';
            } else if (existingScore.is_retired) {
                document.getElementById('mj-jump-status').value = 'retired';
            } else if (existingScore.is_clear) {
                document.getElementById('mj-jump-status').value = 'clear';
            } else {
                document.getElementById('mj-jump-status').value = 'completed';
            }
            
            document.getElementById('mj-jump-faults-nedslag').value = Math.floor((existingScore.faults || 0) / 4);
            document.getElementById('mj-jump-faults-refus').value = 0;
            document.getElementById('mj-jump-faults-time').value = (existingScore.faults || 0) % 4;
            document.getElementById('mj-jump-time').value = existingScore.time_seconds || 0.0;
            document.getElementById('mj-jump-style').value = existingScore.style_points || 0.0;
            document.getElementById('mj-jump-off-faults').value = existingScore.jump_off_faults || 0;
            document.getElementById('mj-jump-off-time').value = existingScore.jump_off_time || 0.0;
            window.toggleJumpingStatusFields();
        } else {
            document.getElementById('mj-points').value = existingScore.points || '';
            document.getElementById('mj-deductions').value = existingScore.deductions || 0;
        }
        document.getElementById('mj-comment').value = existingScore.comment || '';
    } else {
        document.getElementById('mj-score-id').value = ''; 
        if (window.activeClass.discipline === 'jumping') {
            document.getElementById('mj-jump-status').value = 'completed';
            document.getElementById('mj-jump-faults-nedslag').value = 0;
            document.getElementById('mj-jump-faults-refus').value = 0;
            document.getElementById('mj-jump-faults-time').value = 0;
            document.getElementById('mj-jump-time').value = 0.0;
            document.getElementById('mj-jump-style').value = 0.0;
            document.getElementById('mj-jump-off-faults').value = 0;
            document.getElementById('mj-jump-off-time').value = 0.0;
            window.toggleJumpingStatusFields();
        } else {
            document.getElementById('mj-points').value = '';
            document.getElementById('mj-deductions').value = 0;
        }
        document.getElementById('mj-comment').value = '';
    }
    
    document.getElementById('mj-score-form').style.display = 'block';
    document.getElementById('mj-rider-id').value = riderId;
    
    const num = startNo ? `#${startNo} - ` : '';
    document.getElementById('mj-selected-rider-name').innerText = `${num}${riderName} på ${horseName}`;
};

window.cancelScore = function() {
    document.getElementById('mj-score-form').style.display = 'none';
    document.getElementById('mj-rider-id').value = '';
};

document.getElementById('mj-score-form')?.addEventListener('submit', async (e) => {
    if (!window.activeClass) return;
    e.preventDefault();
    const riderId = document.getElementById('mj-rider-id').value;
    const scoreId = document.getElementById('mj-score-id').value;
    const comment = document.getElementById('mj-comment').value;
    
    const payload = {
        comment: comment || null,
        club_post_id: activePostId,
        competition_rider_id: parseInt(riderId)
    };
    
    if (window.activeClass.discipline === 'jumping') {
        const status = document.getElementById('mj-jump-status').value;
        payload.is_eliminated = (status === 'eliminated');
        payload.is_retired = (status === 'retired');
        payload.is_clear = (status === 'clear');
        
        if (!payload.is_eliminated && !payload.is_retired) {
            const nedslag = parseInt(document.getElementById('mj-jump-faults-nedslag').value || 0);
            const refus = parseInt(document.getElementById('mj-jump-faults-refus').value || 0);
            const tidsfejl = parseInt(document.getElementById('mj-jump-faults-time').value || 0);
            
            payload.faults = (nedslag * 4) + (refus * 4) + tidsfejl;
            payload.time_seconds = parseFloat(document.getElementById('mj-jump-time').value || 0);
            payload.style_points = parseFloat(document.getElementById('mj-jump-style').value || 0);
            payload.is_clear = (payload.faults === 0 && status !== 'completed');
            
            if (window.activeClass.scoring_method === 'jump_off') {
                payload.jump_off_faults = parseInt(document.getElementById('mj-jump-off-faults').value || 0);
                payload.jump_off_time = parseFloat(document.getElementById('mj-jump-off-time').value || 0);
            }
        } else {
            payload.faults = 0;
            payload.time_seconds = 0.0;
            payload.style_points = 0.0;
        }
    } else {
        const points = document.getElementById('mj-points').value;
        payload.points = parseFloat(points);
        payload.deductions = parseFloat(document.getElementById('mj-deductions').value || 0);
    }
    
    try {
        let res;
        if (scoreId) {
            res = await fetch(`${API_BASE}/magic/${magicUuid}/scores/${scoreId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(`${API_BASE}/magic/${magicUuid}/scores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        
        if (res.ok) {
            alert('Resultat gemt!');
            cancelScore();
            await fetchCompetitionRidersForJudge(magicJudge.competition_id);
            if (window.leaderboardData && window.leaderboardData.classes) {
                const classData = window.leaderboardData.classes.find(c => c.class_id === activePostId);
                window.activeClassRiders = classData ? classData.leaderboard : [];
            }
        } else {
            const err = await res.json();
            alert(`Fejl: ${err.detail}`);
        }
    } catch(err) { console.error(err); }
});

// --- PUBLIC LEADERBOARD ---
async function initPublicLeaderboard(compId) {
    document.querySelectorAll('main').forEach(m => m.style.display = 'none'); // Skjul alt andet
    document.getElementById('public-leaderboard-section').style.display = 'block';
    
    renderLeaderboard(compId, document.getElementById('pl-list'), document.getElementById('pl-title'));
}

window.renderLeaderboard = async function(compId, listElement, titleElement) {
    if (!listElement) return;
    listElement.innerHTML = '<p style="text-align: center;">Henter resultater...</p>';
    
    try {
        const res = await fetch(`${API_BASE}/public/competitions/${compId}/leaderboard`);
        if (!res.ok) {
            listElement.innerHTML = '<p style="color: #ef4444; text-align: center;">Kunne ikke hente leaderboard.</p>';
            return;
        }
        
        const data = await res.json();
        window.currentLeaderboardData = data;
        if (titleElement) titleElement.innerText = `Leaderboard: ${data.competition_name}`;
        
        listElement.innerHTML = '';
        
        if (!data.classes || data.classes.length === 0) {
            listElement.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Ingen aktive stævneklasser fundet.</p>';
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
            
            const discName = cls.discipline === 'gait' ? 'Gangart' : cls.discipline === 'dressage' ? 'Dressur' : 'Springning';
            const discColor = cls.discipline === 'gait' ? 'var(--primary)' : cls.discipline === 'dressage' ? '#60a5fa' : '#f87171';
            classHeader.style.borderLeft = `4px solid ${discColor}`;
            
            const methodLabel = cls.scoring_method === 'percentage' ? 'Procent' : cls.scoring_method === 'standard' ? 'Karakterer' : `Spring (${cls.scoring_method})`;
            classHeader.innerHTML = `
                <h4 style="margin: 0; color: white; display: flex; justify-content: space-between; align-items: center; font-size: 1.1rem; font-weight: bold;">
                    <span>${cls.class_name} <small style="font-size: 0.8rem; color: var(--text-secondary); font-weight: normal; margin-left: 0.5rem;">(${discName} - ${methodLabel})</small></span>
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
                const progressPct = cls.total_expected_posts_per_rider > 0 ? (r.posts_completed / cls.total_expected_posts_per_rider) * 100 : 0;
                
                let detailsHtml = `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border); display: none;" class="lb-details">`;
                if (r.details.length === 0) {
                    detailsHtml += '<p style="font-size: 0.85rem; color: var(--text-secondary);">Ingen bedømmelser endnu.</p>';
                } else {
                    r.details.forEach(d => {
                        if (cls.discipline === 'jumping') {
                            let statusText = "Gennemført";
                            if (d.is_eliminated) statusText = "Elimineret (ELI)";
                            else if (d.is_retired) statusText = "Udgået (RET)";
                            else if (d.is_clear) statusText = "Fejlfri (Clear)";
                            
                            detailsHtml += `
                                <div style="margin-bottom: 0.8rem; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 6px;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <strong>Springning Resultat</strong>
                                        <span style="color: #fbbf24; font-weight: bold;">${statusText}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; margin-top: 0.5rem;">
                                        Fejl: <span style="color: #ef4444; font-weight: bold;">${d.faults}</span> | 
                                        Tid: <span style="color: #10b981; font-weight: bold;">${d.time_seconds}s</span>
                                    </div>
                                    ${d.style_points > 0 ? `<div style="font-size: 0.85rem; margin-top: 0.3rem;">Stilkarakter: ${d.style_points} | Slutkarakter: <span style="color: #fbbf24;">${d.final_style_score} p</span></div>` : ''}
                                    ${d.jump_off_faults !== null && d.jump_off_faults !== undefined && d.jump_off_time !== null ? `
                                        <div style="font-size: 0.85rem; margin-top: 0.3rem; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.3rem; color: #fbbf24;">
                                            Omspringning: ${d.jump_off_faults} fejl | Tid: ${d.jump_off_time}s
                                        </div>
                                    ` : ''}
                                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem;">Registreret af: ${d.judge_name}</div>
                                    ${d.comment ? `<div style="font-size: 0.9rem; font-style: italic; color: #cbd5e1; margin-top: 0.5rem;">"${d.comment}"</div>` : ''}
                                </div>
                            `;
                        } else {
                            let pointsLabel = `${d.points.toFixed(2)} p`;
                            if (cls.discipline === 'dressage') {
                                pointsLabel = `${d.points} p`;
                                if (d.deductions > 0) {
                                    pointsLabel += ` (Fradrag: -${d.deductions} p)`;
                                }
                            }
                            detailsHtml += `
                                <div style="margin-bottom: 0.8rem; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 6px;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <strong>Pointbedømmelse</strong>
                                        <span style="color: #10b981; font-weight: bold;">${pointsLabel}</span>
                                    </div>
                                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem;">Dommer: ${d.judge_name}</div>
                                    ${d.comment ? `<div style="font-size: 0.9rem; font-style: italic; color: #cbd5e1;">"${d.comment}"</div>` : ''}
                                </div>
                            `;
                        }
                    });
                    
                    // Add print diploma button inside the expanded details card
                    detailsHtml += `
                        <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
                            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.printDiploma(${cls.class_id}, ${r.rider_id})" style="background: #fbbf24; color: #0f172a; border: none; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">
                                <i class="fas fa-certificate"></i> Print Diplom
                            </button>
                        </div>
                    `;
                }
                detailsHtml += '</div>';
                
                const displayScore = r.display_score || r.total_score.toFixed(2);
                
                const card = document.createElement('div');
                card.className = 'list-item';
                card.style.borderLeft = `4px solid ${discColor}`;
                card.style.flexDirection = 'column';
                card.style.alignItems = 'stretch';
                card.style.cursor = 'pointer';
                card.onclick = () => {
                    const det = card.querySelector('.lb-details');
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
                            <div style="font-size: 1.3rem; font-weight: bold; color: #fbbf24;">${displayScore}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">Fremdrift: ${r.posts_completed}/${cls.total_expected_posts_per_rider} bedømt</div>
                        </div>
                    </div>
                    <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 0.8rem; overflow: hidden;">
                        <div style="height: 100%; width: ${progressPct}%; background: #fbbf24; transition: width 0.5s;"></div>
                    </div>
                    ${detailsHtml}
                `;
                listElement.appendChild(card);
            });
        });
        
    } catch(err) { console.error(err); }
};

window.printDiploma = function(classId, riderId) {
    if (!window.currentLeaderboardData) return;
    
    const cls = window.currentLeaderboardData.classes.find(c => c.class_id === classId);
    if (!cls) return;
    
    let riderIndex = -1;
    const rider = cls.leaderboard.find((r, index) => {
        if (r.rider_id === riderId) {
            riderIndex = index;
            return true;
        }
        return false;
    });
    if (!rider) return;
    
    const rank = riderIndex + 1;
    let medal = '';
    if (rank === 1) medal = '🥇 ';
    else if (rank === 2) medal = '🥈 ';
    else if (rank === 3) medal = '🥉 ';
    
    const rankText = `${medal}${rank}. plads`;
    const compName = window.currentLeaderboardData.competition_name;
    const activeClubName = document.getElementById('active-club-banner-name')?.innerText || "Rosendal Rideklub";
    
    let commentsHtml = '';
    if (rider.details && rider.details.length > 0) {
        rider.details.forEach(d => {
            let scoreStr = '';
            if (cls.discipline === 'jumping') {
                scoreStr = `${d.faults} fejl / ${d.time_seconds}s`;
                if (d.style_points > 0) scoreStr += ` | Stil: ${d.style_points} (Slut: ${d.final_style_score})`;
            } else if (cls.discipline === 'dressage') {
                scoreStr = `${d.points} point (${d.percentage}%)`;
            } else {
                scoreStr = `${d.points} point`;
            }
            
            commentsHtml += `
                <div class="comment-card" style="margin-bottom: 8px; background: #f8fafc; border-left: 3px solid #fbbf24; padding: 8px 12px; border-radius: 0 6px 6px 0; text-align: left;">
                    <div class="comment-header" style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #475569; margin-bottom: 3px;">
                        <strong>${d.judge_name}</strong>
                        <span class="score-badge" style="font-weight: 700; color: #b45309;">${scoreStr}</span>
                    </div>
                    ${d.comment ? `<p class="comment-text" style="font-size: 0.85rem; font-style: italic; color: #1e293b; margin: 0; line-height: 1.4;">"${d.comment}"</p>` : `<p class="comment-text" style="font-size: 0.85rem; color: #94a3b8; font-style: italic; margin: 0; line-height: 1.4;">Ingen kommentar.</p>`}
                </div>
            `;
        });
    } else {
        commentsHtml = '<p style="text-align: center; color: #64748b;">Ingen bedømmelsesdetaljer tilgængelige.</p>';
    }
    
    let compDateStr = '';
    if (window.activeCompetition && window.activeCompetition.date) {
        compDateStr = new Date(window.activeCompetition.date).toLocaleDateString('da-DK');
    } else {
        compDateStr = new Date().toLocaleDateString('da-DK');
    }
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blokeret. Tillad venligst pop-ups for at printe diplom.");
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="da">
        <head>
            <meta charset="UTF-8">
            <title>Diplom - ${rider.rider_name}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Montserrat:wght@400;500;700&display=swap" rel="stylesheet">
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Montserrat', sans-serif;
                    background: #ffffff;
                    color: #0f172a;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                
                .certificate-container {
                    width: 210mm;
                    height: 297mm;
                    padding: 20mm;
                    box-sizing: border-box;
                    border: 15px double #fbbf24;
                    outline: 2px solid #0f172a;
                    outline-offset: -5px;
                    background: radial-gradient(circle, rgba(254,243,199,0.1) 0%, rgba(255,255,255,1) 70%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    box-shadow: 0 0 20px rgba(0,0,0,0.05);
                }
                
                .corner-deco {
                    position: absolute;
                    width: 40px;
                    height: 40px;
                    border: 3px solid #fbbf24;
                }
                .top-left { top: 15px; left: 15px; border-right: none; border-bottom: none; }
                .top-right { top: 15px; right: 15px; border-left: none; border-bottom: none; }
                .bottom-left { bottom: 15px; left: 15px; border-right: none; border-top: none; }
                .bottom-right { bottom: 15px; right: 15px; border-left: none; border-top: none; }

                .header-logo {
                    font-family: 'Cinzel', serif;
                    font-size: 1.2rem;
                    letter-spacing: 3px;
                    color: #475569;
                    margin-top: 10mm;
                }

                .certificate-title {
                    font-family: 'Cinzel', serif;
                    font-size: 3.5rem;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 10mm 0 5mm 0;
                    letter-spacing: 5px;
                    text-align: center;
                    border-bottom: 2px solid #fbbf24;
                    padding-bottom: 5px;
                    width: 80%;
                }

                .certificate-subtitle {
                    font-family: 'Cinzel', serif;
                    font-size: 1.1rem;
                    color: #475569;
                    margin-bottom: 12mm;
                    letter-spacing: 2px;
                }

                .recipient-name {
                    font-family: 'Cinzel', serif;
                    font-size: 2.2rem;
                    font-weight: 600;
                    color: #b45309;
                    margin-bottom: 2mm;
                    text-align: center;
                    word-wrap: break-word;
                }

                .recipient-horse {
                    font-size: 1.2rem;
                    color: #334155;
                    margin-bottom: 10mm;
                    font-style: italic;
                    text-align: center;
                }

                .achievement-details {
                    text-align: center;
                    margin-bottom: 12mm;
                    max-width: 90%;
                }

                .achievement-text {
                    font-size: 1.1rem;
                    color: #475569;
                    line-height: 1.6;
                    margin: 0;
                }

                .achievement-highlight {
                    font-weight: 700;
                    color: #0f172a;
                }

                .result-showcase {
                    display: flex;
                    gap: 30px;
                    margin-bottom: 15mm;
                    background: rgba(254, 243, 199, 0.2);
                    border: 1px solid rgba(251, 191, 36, 0.3);
                    padding: 15px 40px;
                    border-radius: 8px;
                }

                .result-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .result-value {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #b45309;
                    font-family: 'Cinzel', serif;
                }

                .result-label {
                    font-size: 0.75rem;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    margin-top: 5px;
                }

                .comments-section {
                    width: 100%;
                    flex-grow: 1;
                    max-height: 80mm;
                    overflow: hidden;
                    margin-bottom: 15mm;
                    padding: 0 10mm;
                    box-sizing: border-box;
                }

                .comments-title {
                    font-family: 'Cinzel', serif;
                    font-size: 1rem;
                    letter-spacing: 2px;
                    color: #334155;
                    margin: 0 0 10px 0;
                    text-align: center;
                    border-bottom: 1px dashed #cbd5e1;
                    padding-bottom: 5px;
                }

                .footer-signatures {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    margin-top: auto;
                    margin-bottom: 5mm;
                    padding: 0 10mm;
                    box-sizing: border-box;
                }

                .signature-box {
                    width: 45%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .signature-line {
                    width: 100%;
                    border-top: 1px solid #475569;
                    margin-top: 15mm;
                    padding-top: 5px;
                    text-align: center;
                    font-size: 0.8rem;
                    color: #475569;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                @media print {
                    body {
                        background: none;
                        display: block;
                    }
                    .certificate-container {
                        box-shadow: none;
                        page-break-inside: avoid;
                        margin: 0 auto;
                    }
                }
            </style>
        </head>
        <body>
            <div class="certificate-container">
                <div class="corner-deco top-left"></div>
                <div class="corner-deco top-right"></div>
                <div class="corner-deco bottom-left"></div>
                <div class="corner-deco bottom-right"></div>

                <div class="header-logo">EquiEvent</div>
                <h1 class="certificate-title">DIPLOM</h1>
                <div class="certificate-subtitle">Resultat & Bedømmelse</div>

                <div class="recipient-name">${rider.rider_name}</div>
                <div class="recipient-horse">på hesten <strong>${rider.horse_name}</strong></div>

                <div class="achievement-details">
                    <p class="achievement-text">
                        har deltaget i klassen <span class="achievement-highlight">${cls.class_name}</span>
                        ved stævnet <span class="achievement-highlight">${compName}</span>
                    </p>
                </div>

                <div class="result-showcase">
                    <div class="result-item" style="border-right: 1px solid #e2e8f0; padding-right: 30px;">
                        <span class="result-value">${rankText}</span>
                        <span class="result-label">Placering</span>
                    </div>
                    <div class="result-item">
                        <span class="result-value">${rider.display_score}</span>
                        <span class="result-label">Resultat</span>
                    </div>
                </div>

                <div class="comments-section">
                    <h3 class="comments-title">Dommerbemærkninger</h3>
                    <div style="max-height: 65mm; overflow-y: auto; padding-right: 5px;">
                        ${commentsHtml}
                    </div>
                </div>

                <div class="footer-signatures">
                    <div class="signature-box">
                        <div class="signature-line">Dato: ${compDateStr}</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line">${activeClubName}</div>
                    </div>
                </div>
            </div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// Injection til den primære Admin Stævne detalje visning
window.addEventListener('load', () => {
    // Override showCompTab fra main.js til at håndtere leaderboard tab
    const originalShowCompTab = window.showCompTab;
    if (originalShowCompTab) {
        window.showCompTab = function(tab) {
            originalShowCompTab(tab); // Kalder den originale (som fjerner active class og skjuler andre sektioner)
            
            // Opret leaderboard sektionen dynamisk under stævne detaljer hvis den ikke findes
            let lbSection = document.getElementById('comp-leaderboard-section');
            if (!lbSection) {
                lbSection = document.createElement('div');
                lbSection.id = 'comp-leaderboard-section';
                lbSection.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="color: #fbbf24;"><i class="fas fa-trophy"></i> Resultater</h4>
                        <button class="btn btn-primary btn-sm" onclick="window.open('?leaderboard=' + currentCompId, '_blank')"><i class="fas fa-external-link-alt"></i> Åbn Offentligt Link</button>
                    </div>
                    <div id="admin-pl-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>
                `;
                document.getElementById('competition-details').appendChild(lbSection);
            }
            
            lbSection.style.display = 'none';
            
            if (tab === 'leaderboard') {
                document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
                
                // Set the third button (leaderboard) active. We have 4 tabs now: Riders, Classes, Judges, Leaderboard
                // So index is 3
                document.querySelectorAll('.detail-tab-btn')[3].classList.add('active'); 
                document.getElementById('comp-riders-section').style.display = 'none';
                document.getElementById('comp-classes-section').style.display = 'none';
                document.getElementById('comp-judges-section').style.display = 'none';
                
                lbSection.style.display = 'block';
                // Brug renderLeaderboard fra scores.js
                if (typeof currentCompId !== 'undefined') {
                    window.renderLeaderboard(currentCompId, document.getElementById('admin-pl-list'), null);
                }
            }
        };
    }
});
