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
window.drfDressageTemplates = [];

async function loadDrfTemplates() {
    try {
        let res = await fetch(`${API_BASE}/public/drf-templates`);
        if (!res.ok) {
            res = await fetch('/drf_dressage_templates.json');
        }
        if (res.ok) {
            window.drfDressageTemplates = await res.json();
            console.log(`Loaded ${window.drfDressageTemplates.length} DRF dressage templates in scores.js`);
        }
    } catch(e) {
        console.log("Could not load drf templates:", e);
    }
}
loadDrfTemplates();

window.clubClassDefinitions = [];

function findMatchingDrfTemplate(name, discipline, clubPost) {
    if (discipline && discipline !== 'dressage') return null;
    
    // 1. Direct configuration from active post
    const post = clubPost || window.activeClass;
    if (post && post.configuration) {
        try {
            const config = typeof post.configuration === 'string' ? JSON.parse(post.configuration) : post.configuration;
            if (config && config.exercises && config.exercises.length) {
                return {
                    code: post.name,
                    name: post.name,
                    configuration: config
                };
            }
        } catch (e) {
            console.error("Error parsing post configuration:", e);
        }
    }
    
    if (!name) return null;
    
    // 2. Check club-customized templates
    if (window.clubClassDefinitions && window.clubClassDefinitions.length) {
        const clean = name.trim().toUpperCase().replace(/[\s\-_]/g, '');
        let found = window.clubClassDefinitions.find(t => {
            if (t.discipline !== 'dressage') return false;
            const tCode = (t.code || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
            const tName = (t.name || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
            return clean === tCode || clean === tName || clean.includes(tCode) || tCode.includes(clean) || clean.includes(tName) || tName.includes(clean);
        });
        if (found) {
            let config = typeof found.configuration === 'string' ? JSON.parse(found.configuration) : (found.configuration || {});
            return {
                code: found.code,
                name: found.name,
                configuration: config
            };
        }
    }
    
    if (!window.drfDressageTemplates || !window.drfDressageTemplates.length) return null;
    const clean = name.trim().toUpperCase().replace(/[\s\-_]/g, '');
    
    // Exact code match
    let found = window.drfDressageTemplates.find(t => {
        const tCode = t.code.trim().toUpperCase().replace(/[\s\-_]/g, '');
        return clean === tCode || clean === tCode.replace('DRF', '');
    });
    if (found) return found;
    
    // Substring match
    found = window.drfDressageTemplates.find(t => {
        const tCode = t.code.trim().toUpperCase().replace(/[\s\-_]/g, '');
        const tName = t.name.trim().toUpperCase().replace(/[\s\-_]/g, '');
        return clean.includes(tCode) || tCode.includes(clean) || clean.includes(tName) || tName.includes(clean);
    });
    return found || null;
}

function findMatchingGaitTemplate(name, clubPost) {
    // 1. Direct configuration from active post
    const post = clubPost || window.activeClass;
    if (post && post.configuration) {
        try {
            const config = typeof post.configuration === 'string' ? JSON.parse(post.configuration) : post.configuration;
            if (config && config.sections && config.sections.length) {
                return {
                    code: post.name,
                    name: post.name,
                    sections: config.sections
                };
            }
        } catch (e) {
            console.error("Error parsing post configuration:", e);
        }
    }

    if (!name) return null;

    // 2. Check club-customized templates
    if (window.clubClassDefinitions && window.clubClassDefinitions.length) {
        const clean = name.trim().toUpperCase().replace(/[\s\-_]/g, '');
        let found = window.clubClassDefinitions.find(t => {
            if (t.discipline !== 'gait') return false;
            const tCode = (t.code || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
            const tName = (t.name || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
            return clean === tCode || clean === tName || clean.includes(tCode) || tCode.includes(clean) || clean.includes(tName) || tName.includes(clean);
        });
        if (found) {
            let config = typeof found.configuration === 'string' ? JSON.parse(found.configuration) : (found.configuration || {});
            if (config.sections && config.sections.length) {
                return {
                    code: found.code,
                    name: found.name,
                    sections: config.sections
                };
            }
        }
    }

    // 3. Fallback standard FEIF templates
    const clean = name.trim().toUpperCase();
    if (clean.includes('T8')) {
        return {
            code: 'T8',
            name: name,
            sections: [
                { sequence: 1, name: 'Valgfrit tempo tølt', weight: 1, is_active: true },
                { sequence: 2, name: 'Valgfrit tempo tølt efter håndskifte', weight: 1, is_active: true }
            ]
        };
    } else if (clean.includes('T1')) {
        return {
            code: 'T1',
            name: name,
            sections: [
                { sequence: 1, name: 'Langsomt tempo tølt', weight: 1, is_active: true },
                { sequence: 2, name: 'Arbejdstempo tølt med store volter', weight: 1, is_active: true },
                { sequence: 3, name: 'Hurtigt tempo tølt', weight: 1, is_active: true }
            ]
        };
    } else if (clean.includes('T2')) {
        return {
            code: 'T2',
            name: name,
            sections: [
                { sequence: 1, name: 'Valgfrit tempo tølt', weight: 1, is_active: true },
                { sequence: 2, name: 'Langsomt tempo tølt med tydelig tøjleeftergift', weight: 1, is_active: true },
                { sequence: 3, name: 'Hurtigt tempo tølt', weight: 1, is_active: true }
            ]
        };
    } else if (clean.includes('4.1') || clean.includes('V1')) {
        return {
            code: '4.1',
            name: name,
            sections: [
                { sequence: 1, name: 'Langsomt tempo tølt', weight: 1, is_active: true },
                { sequence: 2, name: 'Langsom til middel trav', weight: 1, is_active: true },
                { sequence: 3, name: 'Middelskridt', weight: 1, is_active: true },
                { sequence: 4, name: 'Langsom til middel galop', weight: 1, is_active: true },
                { sequence: 5, name: 'Hurtigt tempo tølt', weight: 1, is_active: true }
            ]
        };
    } else if (clean.includes('5.1') || clean.includes('F1')) {
        return {
            code: '5.1',
            name: name,
            sections: [
                { sequence: 1, name: 'Langsomt til middel tempo tølt', weight: 1, is_active: true },
                { sequence: 2, name: 'Langsom til middel trav', weight: 1, is_active: true },
                { sequence: 3, name: 'Middelskridt', weight: 1, is_active: true },
                { sequence: 4, name: 'Langsom til middel galop', weight: 1, is_active: true },
                { sequence: 5, name: 'Pasgang', weight: 1, is_active: true }
            ]
        };
    }

    return null;
}

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

// --- STÆVNE AKTIVERINGS KONTROL FOR DOMMER ---
window.isCompetitionActiveForJudge = function() {
    if (!magicJudge) return false;
    const comp = magicJudge.competition || (window.leaderboardData ? window.leaderboardData.competition : null);
    if (!comp) return true; // Hvis stævneobjektet ikke er indlejret, lad serveren validere
    
    // Tjek eksplicit om stævnet er sat inaktivt
    if (comp.is_active === false || comp.is_active === 0 || comp.is_active === 'false' || comp.is_active === 'f') {
        return false;
    }
    
    if (comp.active_until) {
        const until = new Date(comp.active_until);
        if (until instanceof Date && !isNaN(until.getTime())) {
            if (until < new Date()) {
                return false;
            }
        }
    }
    return true;
};

window.refreshJudgeSession = async function() {
    if (!magicUuid) return;
    try {
        const res = await fetch(`${API_BASE}/magic/${magicUuid}`);
        if (res.ok) {
            magicJudge = await res.json();
            window.updateJudgeActivationUI();
        }
    } catch(e) {
        console.log("Could not refresh judge session:", e);
    }
};

window.updateJudgeActivationUI = function() {
    const isActive = window.isCompetitionActiveForJudge();
    const badge = document.getElementById('mj-comp-status-badge');
    const notice = document.getElementById('mj-inactive-notice');
    const submitBtn = document.getElementById('mj-submit-score-btn');
    
    if (badge) {
        if (!isActive) {
            badge.style.display = 'inline-flex';
            badge.style.background = 'rgba(239, 68, 68, 0.15)';
            badge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
            badge.style.color = '#f87171';
            badge.innerHTML = '<i class="fas fa-lock"></i> ⚠️ Stævne ikke aktiveret';
            badge.title = 'Stævnet er endnu ikke aktiveret af klubben. Pointafgivelse er låst.';
        } else {
            badge.style.display = 'none'; // Skjul markering når stævnet er aktivt
        }
    }
    
    if (notice) {
        if (!isActive) {
            notice.style.display = 'flex';
        } else {
            notice.style.display = 'none';
        }
    }
    
    if (submitBtn) {
        if (!isActive) {
            submitBtn.disabled = true;
            submitBtn.style.background = '#475569';
            submitBtn.style.color = '#94a3b8';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.style.opacity = '0.6';
            submitBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            submitBtn.innerHTML = '<i class="fas fa-lock"></i> Gem Resultat (Stævne ikke aktiveret)';
            submitBtn.title = 'Point kan ikke gemmes, før stævnet er aktiveret af arrangøren.';
        } else {
            submitBtn.disabled = false;
            submitBtn.style.background = '#10b981';
            submitBtn.style.color = '#ffffff';
            submitBtn.style.cursor = 'pointer';
            submitBtn.style.opacity = '1';
            submitBtn.style.border = 'none';
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Gem Resultat';
            submitBtn.title = '';
        }
    }
};

// --- MAGIC LINK / DOMMER PANEL ---
async function initMagicJudge(uuid) {
    magicUuid = uuid;
    const landing = document.getElementById('landing-section');
    if (landing) landing.style.display = 'none';
    document.querySelectorAll('main').forEach(m => m.style.display = 'none'); // Skjul alt andet
    const mjSection = document.getElementById('magic-judge-section');
    if (mjSection) mjSection.style.display = 'block';
    
    await loadDrfTemplates();
    
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
        
        if (window.leaderboardData && window.leaderboardData.competition && window.leaderboardData.competition.club_id) {
            try {
                const defsRes = await fetch(`${API_BASE}/api/v1/clubs/${window.leaderboardData.competition.club_id}/class-definitions`);
                if (defsRes.ok) {
                    window.clubClassDefinitions = await defsRes.json();
                }
            } catch(e) {
                console.log("Could not load club class definitions:", e);
            }
        }
        
        // Opdater stævne aktiverings-status badge og lås i dommerpanelet
        window.updateJudgeActivationUI();
        
        const select = document.getElementById('mj-post-select');
        // Fyld poster dropdown - sorteret efter sværhedsgrad med disciplin markering
        select.innerHTML = '<option value="">-- Vælg klasse / post --</option>';
        const sortedPosts = (window.sortClassesByDifficulty ? window.sortClassesByDifficulty(magicJudge.club_posts) : magicJudge.club_posts);
        
        sortedPosts.forEach(post => {
            let discBadge = '🐎 [Dressur]';
            if (post.discipline === 'jumping') discBadge = '🚧 [Spring]';
            else if (post.discipline === 'gait') discBadge = '🇮🇸 [Islænder]';
            select.innerHTML += `<option value="${post.id}">${discBadge} ${post.name}</option>`;
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
        const rid = r.competition_rider_id || r.rider_id;
        resultsContainer.innerHTML += `
            <div class="list-item" style="cursor: pointer; border-left: 4px solid #10b981; margin-bottom: 0;" onclick="selectRiderFromSearch(${rid}, '${r.rider_name}', '${r.horse_name}', ${r.start_number})">
                <div>
                    <strong>${r.rider_name}</strong> ${startNo}
                    <div style="font-size: 0.8rem; color: var(--text-secondary);"><i class="fas fa-horse-head"></i> ${r.horse_name}</div>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
            </div>
        `;
    });
};

window.selectRiderFromSearch = function(riderId, riderName, horseName, startNo) {
    document.getElementById('mj-rider-search-results').innerHTML = '';
    document.getElementById('mj-rider-search').value = '';
    const riderData = window.activeClassRiders.find(r => (r.competition_rider_id === riderId || r.rider_id === riderId));
    window.selectRiderToScore(riderId, riderName, horseName, startNo, riderData);
};

window.selectRiderToScore = function(riderId, riderName, horseName, startNo, existingScore) {
    const isScored = existingScore && ((existingScore.status !== 'pending' && existingScore.points !== null) || existingScore.faults !== null || existingScore.is_eliminated || existingScore.is_retired || existingScore.is_clear);
    
    if (isScored) {
        document.getElementById('mj-score-id').value = existingScore.score_id || '';
        if (window.activeClass.discipline === 'jumping') {
            const status = existingScore.is_eliminated ? 'eliminated' : (existingScore.is_retired ? 'retired' : (existingScore.is_clear ? 'clear' : 'completed'));
            document.getElementById('mj-jump-status').value = status;
            document.getElementById('mj-jump-faults-nedslag').value = existingScore.faults || 0;
            document.getElementById('mj-jump-faults-refus').value = 0;
            document.getElementById('mj-jump-faults-time').value = 0;
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
    
    const disc = (window.activeClass?.discipline || '').toLowerCase();
    const jumpDyn = document.getElementById('mj-jumping-exercises-container');
    const dressDyn = document.getElementById('mj-drf-exercises-container');
    const gaitDyn = document.getElementById('mj-gait-exercises-container');
    
    if (disc === 'jumping') {
        if (dressDyn) dressDyn.style.display = 'none';
        if (gaitDyn) gaitDyn.style.display = 'none';
        window.activeDrfTemplate = null;
        window.activeGaitTemplate = null;
        renderJumpingObstaclesForm(window.activeClass?.name, existingScore, window.activeClass);
    } else if (disc === 'dressage') {
        if (jumpDyn) jumpDyn.style.display = 'none';
        if (gaitDyn) gaitDyn.style.display = 'none';
        window.activeGaitTemplate = null;
        window.activeDrfTemplate = findMatchingDrfTemplate(window.activeClass?.name, disc, window.activeClass);
        if (window.activeDrfTemplate) {
            renderDrfDressageExercisesForm(window.activeDrfTemplate, existingScore);
        } else {
            if (dressDyn) dressDyn.style.display = 'none';
            document.getElementById('mj-points-group').style.display = 'block';
            document.getElementById('mj-deductions-group').style.display = 'block';
            document.getElementById('mj-jumping-fields').style.display = 'none';
        }
    } else if (disc === 'gait') {
        if (jumpDyn) jumpDyn.style.display = 'none';
        if (dressDyn) dressDyn.style.display = 'none';
        window.activeDrfTemplate = null;
        window.activeGaitTemplate = findMatchingGaitTemplate(window.activeClass?.name, window.activeClass);
        if (window.activeGaitTemplate && window.activeGaitTemplate.sections && window.activeGaitTemplate.sections.length) {
            renderGaitSectionsForm(window.activeGaitTemplate, existingScore);
        } else {
            if (gaitDyn) gaitDyn.style.display = 'none';
            document.getElementById('mj-points-group').style.display = 'block';
            document.getElementById('mj-deductions-group').style.display = 'none';
            document.getElementById('mj-jumping-fields').style.display = 'none';
        }
    }
    
    document.getElementById('mj-score-form').style.display = 'block';
    document.getElementById('mj-rider-id').value = riderId;
    
    // Opdater låsestatus på Gem-knap og advarselsbjælke
    window.updateJudgeActivationUI();
    window.refreshJudgeSession();
    
    const num = startNo ? `#${startNo} - ` : '';
    document.getElementById('mj-selected-rider-name').innerText = `${num}${riderName} på ${horseName}`;
};

function getDefaultObstacleCount(className) {
    const clean = (className || '').toUpperCase().trim();
    if (clean.includes('S1') || clean.includes('S2') || clean.startsWith('S')) return 20;
    if (clean.includes('MA')) return 18;
    if (clean.includes('MB')) return 16;
    if (clean.includes('LA')) return 14;
    if (clean.includes('LB')) return 12;
    return 10; // LF, LE, LD, LC default to 10
}

window.currentJumpingObstaclesCount = 10;

function getJumpingObstaclesForClass(className, clubPost) {
    const post = clubPost || window.activeClass;
    if (post && post.configuration) {
        try {
            const config = typeof post.configuration === 'string' ? JSON.parse(post.configuration) : post.configuration;
            if (config && config.obstacles && config.obstacles.length) {
                return config.obstacles.filter(obs => obs.is_active !== false);
            }
        } catch (e) {
            console.error("Error parsing post configuration:", e);
        }
    }
    
    if (window.clubClassDefinitions && window.clubClassDefinitions.length) {
        const clean = (className || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
        const found = window.clubClassDefinitions.find(t => {
            if (t.discipline !== 'jumping') return false;
            const tCode = (t.code || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
            const tName = (t.name || '').trim().toUpperCase().replace(/[\s\-_]/g, '');
            return clean === tCode || clean === tName || clean.includes(tCode) || tCode.includes(clean) || clean.includes(tName) || tName.includes(clean);
        });
        if (found && found.configuration) {
            const cfg = typeof found.configuration === 'string' ? JSON.parse(found.configuration) : found.configuration;
            if (cfg.obstacles && cfg.obstacles.length) {
                return cfg.obstacles.filter(obs => obs.is_active !== false);
            }
        }
    }
    const defaultCount = getDefaultObstacleCount(className);
    const obsList = [];
    for (let i = 1; i <= defaultCount; i++) {
        const type = (i === 4 || i === 8) ? 'Oxer' : (i === 7) ? 'Kombination' : 'Lodret';
        obsList.push({ sequence: i, code: `Spring ${i}`, name: type, is_active: true });
    }
    return obsList;
}

function renderJumpingObstaclesForm(className, existingScore) {
    window.currentObstaclesList = getJumpingObstaclesForClass(className);
    window.currentJumpingObstaclesCount = window.currentObstaclesList.length;
    
    let dynContainer = document.getElementById('mj-jumping-exercises-container');
    if (!dynContainer) {
        dynContainer = document.createElement('div');
        dynContainer.id = 'mj-jumping-exercises-container';
        const form = document.getElementById('mj-score-form');
        form.insertBefore(dynContainer, document.getElementById('mj-comment').parentNode);
    }
    
    // Hide single fields
    document.getElementById('mj-points-group').style.display = 'none';
    document.getElementById('mj-deductions-group').style.display = 'none';
    document.getElementById('mj-jumping-fields').style.display = 'none';
    
    renderJumpingObstacleRows(className);
    dynContainer.style.display = 'block';
}

function renderJumpingObstacleRows(className) {
    const dynContainer = document.getElementById('mj-jumping-exercises-container');
    if (!dynContainer) return;
    const obstacles = window.currentObstaclesList || [];
    const count = obstacles.length;
    const name = className || window.activeClass?.name || 'Springklasse';
    
    let html = `
        <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); padding: 0.9rem; border-radius: 10px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
                <strong style="color: #60a5fa; font-size: 1rem;">🚧 ${name}: ${count} Forhindringer</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">Hver nedrivning giver <strong>-2 point</strong> fradrag</div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-sm" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #10b981; font-weight: 700; padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer;" onclick="setJumpingClearRound()">
                    ✨ Sæt Fejlfri Runde (0 fejl)
                </button>
            </div>
        </div>
        
        <div style="max-height: 440px; overflow-y: auto; padding-right: 4px; margin-bottom: 1rem;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); text-align: left;">
                        <th style="padding: 6px 4px; width: 120px;">Spring</th>
                        <th style="padding: 6px 4px; text-align: center; width: 140px;">Nedrivning (-2 p)</th>
                        <th style="padding: 6px 4px; text-align: center; width: 130px;">Refusering</th>
                        <th style="padding: 6px 4px; text-align: right; width: 65px;">Point</th>
                    </tr>
                </thead>
                <tbody id="mj-jumping-tbody">
    `;
    
    obstacles.forEach((obs, idx) => {
        const i = obs.sequence || (idx + 1);
        const obsName = obs.code || `Spring ${i}`;
        const obsType = obs.name ? ` (${obs.name})` : '';
        html += `
            <tr style="border-bottom: 1px dashed rgba(255,255,255,0.06); vertical-align: middle;">
                <td style="padding: 8px 4px; font-weight: 700; color: #fff;">
                    <span style="color: #60a5fa;">${obsName}</span><span style="font-size: 0.72rem; color: var(--text-secondary);">${obsType}</span>
                </td>
                <td style="padding: 8px 4px; text-align: center;">
                    <select class="jump-obs-knockdowns" data-obs="${i}" style="padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.15); width: 125px; font-weight: 700;" onchange="calculateJumpingTotal()">
                        <option value="0">0 (Fejlfri)</option>
                        <option value="1">1 nedrivning (-2 p)</option>
                        <option value="2">2 nedrivninger (-4 p)</option>
                        <option value="3">3 nedrivninger (-6 p)</option>
                    </select>
                </td>
                <td style="padding: 8px 4px; text-align: center;">
                    <select class="jump-obs-refusals" data-obs="${i}" style="padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.15); width: 120px; font-weight: 700;" onchange="calculateJumpingTotal()">
                        <option value="0">Ingen refusering</option>
                        <option value="1">1. refusering</option>
                        <option value="2">2. refusering (ELI)</option>
                    </select>
                </td>
                <td style="padding: 8px 4px; text-align: right; font-weight: 700; color: #10b981;" class="jump-obs-points" data-obs="${i}">0 p</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                <td colspan="4" style="padding: 0 4px 8px 4px;">
                    <input type="text" class="jump-obs-comment" data-obs="${i}" placeholder="💬 Bemærkning til Spring ${i} (f.eks. nedslag på bagbom, tæt afstand)..." style="width: 100%; padding: 5px 10px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #cbd5e1; font-size: 0.78rem;" oninput="updateJumpingCommentsSummary()">
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
        <div id="jump-comments-summary-preview" style="display: none; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); padding: 0.8rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.82rem; color: #cbd5e1; line-height: 1.4;"></div>

        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); padding: 1rem; border-radius: 10px; margin-bottom: 1rem;">
            <div style="display: flex; gap: 1rem; margin-bottom: 0.8rem;">
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Ridetid (sekunder):</label>
                    <input type="number" step="0.01" min="0" id="mj-jump-time-live" value="0.0" style="width: 100%; padding: 0.6rem; background: rgba(15,23,42,0.6); border: 1px solid var(--glass-border); border-radius: 8px; color: #fff; font-size: 1.1rem; font-weight: bold; text-align: center;" oninput="calculateJumpingTotal()">
                </div>
                <div style="flex: 1;">
                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.3rem;">Rytterens Status:</label>
                    <select id="mj-jump-status-live" style="width: 100%; padding: 0.6rem; background: rgba(15,23,42,0.6); border: 1px solid var(--glass-border); border-radius: 8px; color: #fbbf24; font-size: 1rem; font-weight: bold;" onchange="calculateJumpingTotal()">
                        <option value="completed">Gennemført</option>
                        <option value="clear">Fejlfri (Clear)</option>
                        <option value="eliminated">Elimineret (ELI)</option>
                        <option value="retired">Udgået (RET)</option>
                    </select>
                </div>
            </div>
            
            <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.9rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Samlet Straf / Fradrag</div>
                <div id="jump-live-penalty" style="font-size: 2rem; font-weight: 800; color: #38bdf8; margin: 2px 0;">0 point fradrag</div>
                <div id="jump-live-summary" style="font-size: 0.82rem; color: var(--text-muted);">0 nedrivninger (-0 point) • 0 refuseringer</div>
            </div>
        </div>
    `;
    
    dynContainer.innerHTML = html;
    calculateJumpingTotal();
}

window.setJumpingClearRound = function() {
    document.querySelectorAll('.jump-obs-knockdowns').forEach(sel => sel.value = '0');
    document.querySelectorAll('.jump-obs-refusals').forEach(sel => sel.value = '0');
    const statusSel = document.getElementById('mj-jump-status-live');
    if (statusSel) statusSel.value = 'clear';
    calculateJumpingTotal();
};

window.addJumpingObstacle = function() {
    window.currentJumpingObstaclesCount++;
    renderJumpingObstacleRows();
};

window.calculateJumpingTotal = function() {
    let totalKnockdowns = 0;
    let totalRefusals = 0;
    
    document.querySelectorAll('.jump-obs-knockdowns').forEach(sel => {
        const obs = sel.getAttribute('data-obs');
        const k = parseInt(sel.value || 0);
        totalKnockdowns += k;
        const ptsCell = document.querySelector(`.jump-obs-points[data-obs="${obs}"]`);
        if (ptsCell) {
            ptsCell.innerText = k > 0 ? `-${k * 2} p` : '0 p';
            ptsCell.style.color = k > 0 ? '#ef4444' : '#10b981';
        }
    });
    
    document.querySelectorAll('.jump-obs-refusals').forEach(sel => {
        const r = parseInt(sel.value || 0);
        totalRefusals += r;
    });
    
    const statusSel = document.getElementById('mj-jump-status-live');
    if (statusSel && totalRefusals >= 2) {
        statusSel.value = 'eliminated';
    }
    
    const totalPenaltyPoints = totalKnockdowns * 2;
    const penEl = document.getElementById('jump-live-penalty');
    if (penEl) {
        if (statusSel && statusSel.value === 'eliminated') {
            penEl.innerText = 'ELIMINERET (ELI)';
            penEl.style.color = '#ef4444';
        } else if (statusSel && statusSel.value === 'retired') {
            penEl.innerText = 'UDGÅET (RET)';
            penEl.style.color = '#ef4444';
        } else if (totalPenaltyPoints === 0 && totalRefusals === 0) {
            penEl.innerText = '0 point fradrag (FEJLFRI)';
            penEl.style.color = '#10b981';
            if (statusSel && statusSel.value === 'completed') {
                statusSel.value = 'clear';
            }
        } else {
            penEl.innerText = `-${totalPenaltyPoints} point (${totalKnockdowns} nedrivninger)`;
            penEl.style.color = '#ef4444';
            if (statusSel && statusSel.value === 'clear') {
                statusSel.value = 'completed';
            }
        }
    }
    
    const sumEl = document.getElementById('jump-live-summary');
    if (sumEl) {
        const timeVal = parseFloat(document.getElementById('mj-jump-time-live')?.value || 0);
        sumEl.innerText = `${totalKnockdowns} nedrivninger (-${totalPenaltyPoints} point) • ${totalRefusals} refuseringer • Tid: ${timeVal.toFixed(2)}s`;
    }
    
    // Set hidden fields for standard payload
    const timeVal = parseFloat(document.getElementById('mj-jump-time-live')?.value || 0);
    const hiddenStatus = document.getElementById('mj-jump-status');
    if (hiddenStatus && statusSel) hiddenStatus.value = statusSel.value;
    const hiddenFaults = document.getElementById('mj-jump-faults-nedslag');
    if (hiddenFaults) hiddenFaults.value = totalKnockdowns;
    const hiddenRefus = document.getElementById('mj-jump-faults-refus');
    if (hiddenRefus) hiddenRefus.value = totalRefusals;
    const hiddenTime = document.getElementById('mj-jump-time');
    if (hiddenTime) hiddenTime.value = timeVal;
    
    updateJumpingCommentsSummary();
};

window.updateJumpingCommentsSummary = function() {
    const comments = [];
    document.querySelectorAll('.jump-obs-comment').forEach(inp => {
        const txt = (inp.value || '').trim();
        if (txt) {
            const obs = inp.getAttribute('data-obs');
            comments.push(`<strong>Spring ${obs}:</strong> ${txt}`);
        }
    });
    
    const summaryBox = document.getElementById('jump-comments-summary-preview');
    if (summaryBox) {
        if (comments.length > 0) {
            summaryBox.style.display = 'block';
            summaryBox.innerHTML = `<div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px;">📝 Indtastede bemærkninger til spring (${comments.length}):</div>` + comments.join('<br>');
        } else {
            summaryBox.style.display = 'none';
            summaryBox.innerHTML = '';
        }
    }
};

function renderDrfDressageExercisesForm(tpl, existingScore) {
    const config = tpl.configuration || {};
    const rawExercises = config.exercises || [];
    const exercises = rawExercises.filter(ex => ex.is_active !== false);
    
    let dynContainer = document.getElementById('mj-drf-exercises-container');
    if (!dynContainer) {
        dynContainer = document.createElement('div');
        dynContainer.id = 'mj-drf-exercises-container';
        const form = document.getElementById('mj-score-form');
        form.insertBefore(dynContainer, document.getElementById('mj-comment').parentNode);
    }
    
    // Hide single points and deductions
    document.getElementById('mj-points-group').style.display = 'none';
    document.getElementById('mj-deductions-group').style.display = 'none';
    document.getElementById('mj-jumping-fields').style.display = 'none';
    
    let html = `
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); padding: 0.8rem; border-radius: 10px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong style="color: #10b981; font-size: 0.95rem;">${tpl.name}</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">${config.arena_dimensions || 'Bane'} • ${exercises.length} aktive øvelser</div>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 0.72rem; color: var(--text-secondary);">DRF / Klub Program</span>
            </div>
        </div>
        <div style="max-height: 480px; overflow-y: auto; padding-right: 4px; margin-bottom: 1rem;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); text-align: left;">
                        <th style="padding: 6px 2px; width: 28px;">Nr</th>
                        <th style="padding: 6px 4px;">Øvelse & Anvisning</th>
                        <th style="padding: 6px 2px; width: 36px; text-align: center;">Koeff</th>
                        <th style="padding: 6px 4px; width: 75px; text-align: center;">Karakter</th>
                        <th style="padding: 6px 4px; width: 45px; text-align: right;">Point</th>
                    </tr>
                </thead>
                <tbody>
    `;

    exercises.forEach(ex => {
        const isCol = ex.is_collective;
        let options = '<option value="">-</option>';
        for (let m = 10; m >= 0; m -= 0.5) {
            options += `<option value="${m.toFixed(1)}">${m.toFixed(1)}</option>`;
        }
        
        html += `
            <tr style="border-bottom: 1px dashed rgba(255,255,255,0.06); vertical-align: top; ${isCol ? 'background: rgba(139, 92, 246, 0.05);' : ''}">
                <td style="padding: 8px 2px; font-weight: bold; color: ${isCol ? '#a78bfa' : 'var(--text-secondary)'};">${ex.sequence}</td>
                <td style="padding: 8px 4px;">
                    <div style="font-weight: 600; color: #fff;">${ex.letter ? '<span style="color: #38bdf8; font-weight: 700;">' + ex.letter + '</span> ' : ''}${ex.name || ex.description}</div>
                    <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">${(ex.directiveIdeas || ex.directives || []).join(' • ') || ex.description}</div>
                </td>
                <td style="padding: 8px 2px; text-align: center; font-weight: 600; color: ${ex.coefficient > 1 ? '#f59e0b' : 'var(--text-muted)'};">${ex.coefficient > 1 ? 'x' + ex.coefficient : '1'}</td>
                <td style="padding: 8px 4px; text-align: center;">
                    <select class="drf-ex-mark" data-seq="${ex.sequence}" data-coeff="${ex.coefficient || 1}" style="padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.15); width: 68px; font-weight: 700;" onchange="calculateDrfDressageTotal()">
                        ${options}
                    </select>
                </td>
                <td style="padding: 8px 4px; text-align: right; font-weight: 700; color: #10b981;" class="drf-ex-weighted" data-seq="${ex.sequence}">-</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); ${isCol ? 'background: rgba(139, 92, 246, 0.05);' : ''}">
                <td colspan="5" style="padding: 0 4px 8px 4px;">
                    <input type="text" class="drf-ex-comment" data-seq="${ex.sequence}" data-name="${ex.letter ? ex.letter + ' ' : ''}${ex.name || ex.description}" placeholder="💬 Bemærkning / kommentar til ${isCol ? 'samlet indtryk' : 'øvelse ' + ex.sequence} (valgfrit)..." style="width: 100%; padding: 6px 10px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #cbd5e1; font-size: 0.8rem;" oninput="updateDrfCommentsSummary()">
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        
        <div id="drf-comments-summary-preview" style="display: none; background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.82rem; color: #e2e8f0; line-height: 1.4;">
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 0.8rem 1rem; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.2rem;">Fradrag (Fejlridning)</label>
                <select id="drf-fejlridning-select" style="padding: 4px 8px; border-radius: 6px; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.15); font-size: 0.85rem;" onchange="calculateDrfDressageTotal()">
                    <option value="0">Ingen fejlridning (0 p)</option>
                    <option value="2">1. gang fejlridning (-2 p)</option>
                    <option value="6">2. gang fejlridning (-6 p totalt)</option>
                    <option value="999">3. gang fejlridning (Diskvalificeret)</option>
                </select>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 0.75rem; color: var(--text-secondary);">Samlet Procent:</div>
                <div id="drf-live-percentage" style="font-size: 1.4rem; font-weight: 800; color: #10b981;">0.00 %</div>
                <div id="drf-live-points-summary" style="font-size: 0.75rem; color: var(--text-muted);">0 / 0 point</div>
            </div>
        </div>
    `;

    dynContainer.innerHTML = html;
    dynContainer.style.display = 'block';
    calculateDrfDressageTotal();
}

window.updateDrfCommentsSummary = function() {
    const comments = [];
    document.querySelectorAll('.drf-ex-comment').forEach(inp => {
        const txt = (inp.value || '').trim();
        if (txt) {
            const seq = inp.getAttribute('data-seq');
            const name = inp.getAttribute('data-name') || `Øv. ${seq}`;
            comments.push(`<strong>Øv. ${seq} (${name}):</strong> ${txt}`);
        }
    });
    
    const summaryBox = document.getElementById('drf-comments-summary-preview');
    if (summaryBox) {
        if (comments.length > 0) {
            summaryBox.style.display = 'block';
            summaryBox.innerHTML = `<div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px;">📝 Indtastede bemærkninger til øvelser (${comments.length}):</div>` + comments.join('<br>');
        } else {
            summaryBox.style.display = 'none';
            summaryBox.innerHTML = '';
        }
    }
};

window.calculateDrfDressageTotal = function() {
    let totalWeighted = 0;
    let maxPoints = 0;
    let scoredCount = 0;
    
    document.querySelectorAll('.drf-ex-mark').forEach(sel => {
        const coeff = parseFloat(sel.getAttribute('data-coeff') || 1);
        const seq = sel.getAttribute('data-seq');
        const wCell = document.querySelector(`.drf-ex-weighted[data-seq="${seq}"]`);
        maxPoints += 10 * coeff;
        
        if (sel.value !== '') {
            const mark = parseFloat(sel.value);
            const w = mark * coeff;
            totalWeighted += w;
            scoredCount++;
            if (wCell) wCell.innerText = w.toFixed(1);
        } else {
            if (wCell) wCell.innerText = '-';
        }
    });
    
    const dedSel = document.getElementById('drf-fejlridning-select');
    const dedVal = dedSel ? parseFloat(dedSel.value || 0) : 0;
    
    if (dedVal === 999) {
        document.getElementById('drf-live-percentage').innerText = 'DIS';
        document.getElementById('drf-live-points-summary').innerText = 'Diskvalificeret (3. gang fejlridning)';
        return;
    }
    
    const netPoints = Math.max(0, totalWeighted - dedVal);
    const pct = maxPoints > 0 ? (netPoints / maxPoints) * 100 : 0;
    
    window.activeDrfCalculatedPct = pct;
    window.activeDrfCalculatedPoints = netPoints;
    window.activeDrfCalculatedMaxPoints = maxPoints;
    
    const pctEl = document.getElementById('drf-live-percentage');
    if (pctEl) pctEl.innerText = `${pct.toFixed(2)} % (${netPoints.toFixed(1)} p)`;
    
    const sumEl = document.getElementById('drf-live-points-summary');
    if (sumEl) sumEl.innerText = `${netPoints.toFixed(1)} opnåede point ud af ${maxPoints} maks (${scoredCount} øvelser bedømt)`;
    
    const ptsInput = document.getElementById('mj-points');
    if (ptsInput) ptsInput.value = pct.toFixed(2);
    const dedInput = document.getElementById('mj-deductions');
    if (dedInput) dedInput.value = dedVal;
};

// ==========================================
// GAIT / ISLÆNDER OPGAVEDELE BEDØMMELSE
// ==========================================

function renderGaitSectionsForm(tpl, existingScore) {
    const rawSections = tpl.sections || [];
    const sections = rawSections.filter(s => s.is_active !== false);
    
    let dynContainer = document.getElementById('mj-gait-exercises-container');
    if (!dynContainer) {
        dynContainer = document.createElement('div');
        dynContainer.id = 'mj-gait-exercises-container';
        const form = document.getElementById('mj-score-form');
        form.insertBefore(dynContainer, document.getElementById('mj-comment').parentNode);
    }
    
    // Hide single points and deductions
    document.getElementById('mj-points-group').style.display = 'none';
    document.getElementById('mj-deductions-group').style.display = 'none';
    document.getElementById('mj-jumping-fields').style.display = 'none';
    
    let html = `
        <div style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); padding: 0.8rem; border-radius: 10px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong style="color: #fbbf24; font-size: 0.95rem;">🇮🇸 ${tpl.name}</strong>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">${sections.length} aktive opgavedele / øvelser</div>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 0.72rem; color: var(--text-secondary);">Islandsk Hest Bedømmelse</span>
            </div>
        </div>
        <div style="max-height: 480px; overflow-y: auto; padding-right: 4px; margin-bottom: 1rem;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary); text-align: left;">
                        <th style="padding: 6px 2px; width: 28px;">Del</th>
                        <th style="padding: 6px 4px;">Opgave / Gangart</th>
                        <th style="padding: 6px 2px; width: 40px; text-align: center;">Vægt</th>
                        <th style="padding: 6px 4px; width: 80px; text-align: center;">Karakter</th>
                        <th style="padding: 6px 4px; width: 50px; text-align: right;">Point</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sections.forEach((sec, idx) => {
        const seq = sec.sequence || (idx + 1);
        const weight = sec.weight || 1;
        let options = '<option value="">-</option>';
        for (let m = 10; m >= 0; m -= 0.5) {
            options += `<option value="${m.toFixed(1)}">${m.toFixed(1)}</option>`;
        }
        
        html += `
            <tr style="border-bottom: 1px dashed rgba(255,255,255,0.06); vertical-align: top;">
                <td style="padding: 8px 2px; font-weight: bold; color: #fbbf24;">${seq}</td>
                <td style="padding: 8px 4px;">
                    <div style="font-weight: 600; color: #fff;">${sec.name}</div>
                </td>
                <td style="padding: 8px 2px; text-align: center; font-weight: 600; color: ${weight > 1 ? '#f59e0b' : 'var(--text-muted)'};">${weight > 1 ? 'x' + weight : '1'}</td>
                <td style="padding: 8px 4px; text-align: center;">
                    <select class="gait-sec-mark" data-seq="${seq}" data-weight="${weight}" style="padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,0.6); color: #fff; border: 1px solid rgba(255,255,255,0.15); width: 72px; font-weight: 700;" onchange="calculateGaitTotal()">
                        ${options}
                    </select>
                </td>
                <td style="padding: 8px 4px; text-align: right; font-weight: 700; color: #fbbf24;" class="gait-sec-weighted" data-seq="${seq}">-</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                <td colspan="5" style="padding: 0 4px 8px 4px;">
                    <input type="text" class="gait-sec-comment" data-seq="${seq}" data-name="${sec.name}" placeholder="💬 Bemærkning / kommentar til ${sec.name} (valgfrit)..." style="width: 100%; padding: 6px 10px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #cbd5e1; font-size: 0.8rem;" oninput="updateGaitCommentsSummary()">
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        
        <div id="gait-comments-summary-preview" style="display: none; background: rgba(251, 191, 36, 0.08); border: 1px dashed rgba(251, 191, 36, 0.3); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.82rem; color: #e2e8f0; line-height: 1.4;">
        </div>

        <div style="background: rgba(0,0,0,0.3); padding: 0.8rem 1rem; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">Samlet Karakter (0-10):</span>
            </div>
            <div style="text-align: right;">
                <div id="gait-live-total" style="font-size: 1.5rem; font-weight: 800; color: #fbbf24;">0.00</div>
                <div id="gait-live-summary" style="font-size: 0.75rem; color: var(--text-muted);">0 / ${sections.length} opgavedele bedømt</div>
            </div>
        </div>
    `;

    dynContainer.innerHTML = html;
    dynContainer.style.display = 'block';
    calculateGaitTotal();
}

window.updateGaitCommentsSummary = function() {
    const comments = [];
    document.querySelectorAll('.gait-sec-comment').forEach(inp => {
        const txt = (inp.value || '').trim();
        if (txt) {
            const seq = inp.getAttribute('data-seq');
            const name = inp.getAttribute('data-name') || `Del ${seq}`;
            comments.push(`<strong>${name}:</strong> ${txt}`);
        }
    });
    
    const summaryBox = document.getElementById('gait-comments-summary-preview');
    if (summaryBox) {
        if (comments.length > 0) {
            summaryBox.style.display = 'block';
            summaryBox.innerHTML = `<div style="font-weight: 700; color: #fbbf24; margin-bottom: 4px;">📝 Indtastede bemærkninger til opgaver (${comments.length}):</div>` + comments.join('<br>');
        } else {
            summaryBox.style.display = 'none';
            summaryBox.innerHTML = '';
        }
    }
};

window.calculateGaitTotal = function() {
    let totalWeighted = 0;
    let totalWeight = 0;
    let scoredCount = 0;
    const totalCount = document.querySelectorAll('.gait-sec-mark').length;
    
    document.querySelectorAll('.gait-sec-mark').forEach(sel => {
        const weight = parseFloat(sel.getAttribute('data-weight') || 1);
        const seq = sel.getAttribute('data-seq');
        const wCell = document.querySelector(`.gait-sec-weighted[data-seq="${seq}"]`);
        totalWeight += weight;
        
        if (sel.value !== '') {
            const mark = parseFloat(sel.value);
            const w = mark * weight;
            totalWeighted += w;
            scoredCount++;
            if (wCell) wCell.innerText = mark.toFixed(1);
        } else {
            if (wCell) wCell.innerText = '-';
        }
    });
    
    const avg = totalWeight > 0 ? (totalWeighted / totalWeight) : 0;
    
    const totEl = document.getElementById('gait-live-total');
    if (totEl) totEl.innerText = avg.toFixed(2);
    
    const sumEl = document.getElementById('gait-live-summary');
    if (sumEl) sumEl.innerText = `${scoredCount} ud af ${totalCount} opgavedele bedømt`;
    
    const ptsInput = document.getElementById('mj-points');
    if (ptsInput) ptsInput.value = avg.toFixed(2);
};

window.cancelScore = function() {
    document.getElementById('mj-score-form').style.display = 'none';
    document.getElementById('mj-rider-id').value = '';
};

window.submitJudgeScore = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (!magicUuid) {
        const urlParams = new URLSearchParams(window.location.search);
        magicUuid = urlParams.get('magic') || '';
    }
    
    if (!activePostId) {
        const postSelect = document.getElementById('mj-post-select');
        if (postSelect && postSelect.value) {
            activePostId = parseInt(postSelect.value);
        }
    }
    
    if (!window.activeClass && activePostId && magicJudge && magicJudge.club_posts) {
        window.activeClass = magicJudge.club_posts.find(p => p.id === activePostId);
    }
    
    if (!window.activeClass) {
        alert('Vælg venligst en klasse/post først.');
        return;
    }
    
    // Hvis stævnet ser inaktivt ud, prøv en hurtig live session-opdatering fra serveren
    if (!window.isCompetitionActiveForJudge()) {
        await window.refreshJudgeSession();
    }
    
    if (!window.isCompetitionActiveForJudge()) {
        alert("Dette stævne er ikke aktiveret endnu. Pointafgivelse er deaktiveret, indtil klubben har aktiveret stævnet.");
        return;
    }
    
    const riderId = document.getElementById('mj-rider-id')?.value;
    if (!riderId) {
        alert('Vælg venligst en rytter/ekvipage at bedømme.');
        return;
    }
    
    const submitBtn = document.getElementById('mj-submit-score-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gemmer resultat...';
    }
    
    const scoreId = document.getElementById('mj-score-id')?.value;
    const comment = document.getElementById('mj-comment')?.value || '';
    
    // Genberegn samlet resultat så mj-points altid er opdateret
    if (window.activeDrfTemplate && typeof calculateDrfDressageTotal === 'function') {
        calculateDrfDressageTotal();
    } else if (window.activeGaitTemplate && typeof calculateGaitTotal === 'function') {
        calculateGaitTotal();
    } else if (window.activeClass?.discipline === 'jumping' && typeof calculateJumpingPenaltyTotal === 'function') {
        calculateJumpingPenaltyTotal();
    }
    
    let finalComment = comment.trim();
    if (window.activeDrfTemplate) {
        const exComments = [];
        document.querySelectorAll('.drf-ex-comment').forEach(inp => {
            const txt = (inp.value || '').trim();
            if (txt) {
                const seq = inp.getAttribute('data-seq');
                const name = inp.getAttribute('data-name') || `Øv. ${seq}`;
                exComments.push(`• Øv. ${seq} (${name}): ${txt}`);
            }
        });
        if (exComments.length > 0) {
            const compiled = "Bemærkninger til øvelser:\n" + exComments.join('\n');
            if (finalComment) {
                finalComment = compiled + "\n\nGenerel kommentar:\n" + finalComment;
            } else {
                finalComment = compiled;
            }
        }
    } else if (window.activeClass?.discipline === 'jumping') {
        const jumpComments = [];
        document.querySelectorAll('.jump-obs-comment').forEach(inp => {
            const txt = (inp.value || '').trim();
            if (txt) {
                const obs = inp.getAttribute('data-obs');
                jumpComments.push(`• Spring ${obs}: ${txt}`);
            }
        });
        if (jumpComments.length > 0) {
            const compiled = "Bemærkninger til spring:\n" + jumpComments.join('\n');
            if (finalComment) {
                finalComment = compiled + "\n\nGenerel kommentar:\n" + finalComment;
            } else {
                finalComment = compiled;
            }
        }
    } else if (window.activeGaitTemplate) {
        const gaitComments = [];
        document.querySelectorAll('.gait-sec-comment').forEach(inp => {
            const txt = (inp.value || '').trim();
            if (txt) {
                const seq = inp.getAttribute('data-seq');
                const name = inp.getAttribute('data-name') || `Opgavedel ${seq}`;
                gaitComments.push(`• ${name}: ${txt}`);
            }
        });
        if (gaitComments.length > 0) {
            const compiled = "Bemærkninger til opgavedele:\n" + gaitComments.join('\n');
            if (finalComment) {
                finalComment = compiled + "\n\nGenerel kommentar:\n" + finalComment;
            } else {
                finalComment = compiled;
            }
        }
    }
    
    const payload = {
        comment: finalComment || null,
        club_post_id: activePostId,
        competition_rider_id: parseInt(riderId)
    };
    
    if (window.activeClass.discipline === 'jumping') {
        const status = document.getElementById('mj-jump-status')?.value || 'completed';
        payload.is_eliminated = (status === 'eliminated');
        payload.is_retired = (status === 'retired');
        payload.is_clear = (status === 'clear');
        
        if (!payload.is_eliminated && !payload.is_retired) {
            const nedslag = parseInt(document.getElementById('mj-jump-faults-nedslag')?.value || 0);
            const refus = parseInt(document.getElementById('mj-jump-faults-refus')?.value || 0);
            const tidsfejl = parseInt(document.getElementById('mj-jump-faults-time')?.value || 0);
            
            payload.faults = (nedslag * 4) + (refus * 4) + tidsfejl;
            payload.time_seconds = parseFloat(document.getElementById('mj-jump-time')?.value || 0);
            payload.style_points = parseFloat(document.getElementById('mj-jump-style')?.value || 0);
            payload.is_clear = (payload.faults === 0 && status !== 'completed');
            
            if (window.activeClass.scoring_method === 'jump_off') {
                payload.jump_off_faults = parseInt(document.getElementById('mj-jump-off-faults')?.value || 0);
                payload.jump_off_time = parseFloat(document.getElementById('mj-jump-off-time')?.value || 0);
            }
        } else {
            payload.faults = 0;
            payload.time_seconds = 0.0;
            payload.style_points = 0.0;
        }
    } else {
        const pointsStr = (document.getElementById('mj-points')?.value || '').trim();
        const pts = parseFloat(pointsStr);
        payload.points = (!isNaN(pts)) ? pts : (window.activeDrfCalculatedPct || 0.0);
        payload.deductions = parseFloat(document.getElementById('mj-deductions')?.value || 0);
        if (window.activeClass?.discipline === 'dressage' && window.activeDrfCalculatedPoints !== undefined) {
            payload.style_points = window.activeDrfCalculatedPoints;
        }
    }
    
    console.log("Submitting judge score:", payload);
    
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
            const savedData = await res.json();
            console.log("Score saved:", savedData);
            alert('Resultat gemt!');
            cancelScore();
            if (magicJudge && magicJudge.competition_id) {
                await fetchCompetitionRidersForJudge(magicJudge.competition_id);
                if (window.leaderboardData && window.leaderboardData.classes) {
                    const classData = window.leaderboardData.classes.find(c => c.class_id === activePostId);
                    window.activeClassRiders = classData ? classData.leaderboard : [];
                }
            }
        } else {
            const err = await res.json();
            console.error("Score submit error response:", err);
            alert(`Fejl: ${err.detail || 'Kunne ikke gemme bedømmelsen.'}`);
        }
    } catch(err) {
        console.error("Score submit network error:", err);
        alert(`Der opstod en netværksfejl ved gemning: ${err.message}`);
    } finally {
        window.updateJudgeActivationUI();
    }
};

document.getElementById('mj-score-form')?.addEventListener('submit', window.submitJudgeScore);

// --- PUBLIC LEADERBOARD ---
async function initPublicLeaderboard(compId) {
    const landing = document.getElementById('landing-section');
    if (landing) landing.style.display = 'none';
    document.querySelectorAll('main').forEach(m => m.style.display = 'none'); // Skjul alt andet
    const plSection = document.getElementById('public-leaderboard-section');
    if (plSection) plSection.style.display = 'block';
    
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
            
            const methodLabel = cls.scoring_method === 'percentage' ? 'Procent & Point' : cls.scoring_method === 'standard' ? 'Karakterer' : `Spring (${cls.scoring_method})`;
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
                                const pctStr = d.percentage !== undefined ? `${d.percentage.toFixed(2)}%` : '';
                                const ptsStr = `${d.points} p`;
                                pointsLabel = pctStr ? `${pctStr} (${ptsStr})` : ptsStr;
                                if (d.deductions > 0) {
                                    pointsLabel += ` • Fradrag: -${d.deductions} p`;
                                }
                            }
                            detailsHtml += `
                                <div style="margin-bottom: 0.8rem; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 6px;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <strong>${cls.discipline === 'dressage' ? 'Dressurbedømmelse' : 'Pointbedømmelse'}</strong>
                                        <span style="color: #10b981; font-weight: bold;">${pointsLabel}</span>
                                    </div>
                                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem;">Dommer: ${d.judge_name}</div>
                                    ${d.comment ? `<div style="font-size: 0.86rem; color: #cbd5e1; margin-top: 0.5rem; background: rgba(0,0,0,0.3); padding: 0.6rem; border-radius: 6px; border-left: 3px solid #10b981; white-space: pre-line; line-height: 1.5;">${d.comment}</div>` : ''}
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
