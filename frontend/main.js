window.activeClubId = null;
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



window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar-nav');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }
};

window.closeSidebar = function() {
    const sidebar = document.getElementById('sidebar-nav');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    }
};

window.copyPublicLink = function() {
    if (!window.currentCompId) return;
    const url = `${window.location.origin}/?leaderboard=${window.currentCompId}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            alert('Offentligt link er kopieret!\nDu kan nu indsætte det på Facebook, hjemmesider eller i en mail.');
        }).catch(err => {
            prompt('Kopiér dette link manuelt:', url);
        });
    } else {
        // Fallback for non-secure HTTP contexts
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('Offentligt link er kopieret!\nDu kan nu indsætte det på Facebook, hjemmesider eller i en mail.');
            } else {
                prompt('Kopiér dette link manuelt:', url);
            }
        } catch (err) {
            prompt('Kopiér dette link manuelt:', url);
        }
        document.body.removeChild(textArea);
    }
};

window.copyJudgeLink = function(uuid) {
    const url = `${window.location.origin}/?magic=${uuid}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            alert('Dommer-link er kopieret!\nDu kan nu sende det til dommeren.');
        }).catch(err => {
            prompt('Kopiér dette link manuelt:', url);
        });
    } else {
        // Fallback for non-secure HTTP contexts
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.position = 'fixed';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                alert('Dommer-link er kopieret!\nDu kan nu sende det til dommeren.');
            } else {
                prompt('Kopiér dette link manuelt:', url);
            }
        } catch (err) {
            prompt('Kopiér dette link manuelt:', url);
        }
        document.body.removeChild(textArea);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Undgå at main.js blander sig, hvis vi er på en dommer- eller leaderboard-side
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('magic') || urlParams.get('leaderboard')) return;

    if (urlParams.get('reset_token')) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('reset-password-section').style.display = 'block';
        document.getElementById('reset-token').value = urlParams.get('reset_token');
        
        document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('reset-btn');
            const msg = document.getElementById('reset-msg');
            btn.disabled = true;
            btn.innerText = "Gemmer...";
            try {
                const response = await fetch(`${API_BASE}/auth/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: document.getElementById('reset-token').value,
                        new_password: document.getElementById('reset-new-password').value
                    })
                });
                const data = await response.json();
                if(response.ok) {
                    msg.style.color = "#10b981";
                    msg.innerText = data.message;
                    msg.style.display = 'block';
                    setTimeout(() => { window.location.href = '/'; }, 3000);
                } else {
                    msg.style.color = "#ef4444";
                    msg.innerText = data.detail || "Fejl.";
                    msg.style.display = 'block';
                    btn.disabled = false;
                    btn.innerText = "Gem adgangskode";
                }
            } catch (err) {
                msg.style.color = "#ef4444";
                msg.innerText = "Netværksfejl.";
                msg.style.display = 'block';
                btn.disabled = false;
                btn.innerText = "Gem adgangskode";
            }
        });
        return;
    }

    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard');
    const clubSelectionSection = document.getElementById('club-selection-section');
    const loginForm = document.getElementById('login-form');
    
    // Auth Logic
    function getToken() {
        return localStorage.getItem('equievent_token') || sessionStorage.getItem('equievent_token');
    }

    if (getToken()) {
        checkUserClubs();
    }

    const forgotPasswordForm = document.getElementById('forgot-password-form');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();
            const btn = document.getElementById('forgot-btn');
            const msg = document.getElementById('forgot-msg');
            
            btn.disabled = true;
            btn.innerText = "Sender...";
            
            try {
                const response = await fetch(`${API_BASE}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                msg.style.color = "#10b981";
                msg.innerText = data.message || "Email sendt, hvis den findes i vores system.";
                msg.style.display = 'block';
            } catch (err) {
                msg.style.color = "#ef4444";
                msg.innerText = "Netværksfejl. Prøv igen.";
                msg.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.innerText = "Send link";
            }
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('login-remember').checked;

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (remember) {
                    localStorage.setItem('equievent_token', data.access_token);
                } else {
                    sessionStorage.setItem('equievent_token', data.access_token);
                }
                document.getElementById('login-error').style.display = 'none';
                checkUserClubs();
            } else {
                const errorData = await response.json().catch(() => ({}));
                const detail = errorData.detail || "Forkert email eller adgangskode.";
                const errElement = document.getElementById('login-error');
                errElement.innerText = detail === "Incorrect email or password" ? "Forkert email eller adgangskode." : detail;
                errElement.style.display = 'block';
            }
        } catch (err) {
            console.error(err);
            const errElement = document.getElementById('login-error');
            errElement.innerText = "Kunne ikke forbinde til serveren (" + err.message + "). Sørg for at API-serveren kører på " + API_BASE;
            errElement.style.display = 'block';
        }
    });

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const club_name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;

            try {
                const response = await fetch(`${API_BASE}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, club_name })
                });

                if (response.ok) {
                    localStorage.setItem('just_registered_club', 'true');
                    
                    // Auto-login after registration
                    try {
                        const formData = new URLSearchParams();
                        formData.append('username', email);
                        formData.append('password', password);

                        const loginResp = await fetch(`${API_BASE}/auth/login`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: formData
                        });

                        if (loginResp.ok) {
                            const loginData = await loginResp.json();
                            localStorage.setItem('equievent_token', loginData.access_token);
                            document.getElementById('register-section').style.display = 'none';
                            await checkUserClubs();
                        } else {
                            // Fallback: If auto-login fails, redirect to standard login form
                            document.getElementById('register-section').style.display = 'none';
                            document.getElementById('login-section').style.display = 'block';
                            document.getElementById('login-email').value = email;
                            document.getElementById('login-password').value = password;
                        }
                    } catch (err) {
                        console.error("Auto-login error:", err);
                        document.getElementById('register-section').style.display = 'none';
                        document.getElementById('login-section').style.display = 'block';
                        document.getElementById('login-email').value = email;
                        document.getElementById('login-password').value = password;
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    const detail = errorData.detail || "Fejl ved oprettelse (måske findes emailen allerede).";
                    const errElement = document.getElementById('reg-error');
                    errElement.innerText = detail;
                    errElement.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                const errElement = document.getElementById('reg-error');
                errElement.innerText = "Kunne ikke forbinde til serveren (" + err.message + "). Sørg for at API-serveren kører på " + API_BASE;
                errElement.style.display = 'block';
            }
        });
    }

    // Helper til at afkode JWT payload
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch(e) {
            return null;
        }
    }

    // MULTI-KLUB LOGIK
    async function checkUserClubs() {
        const token = getToken();
        if(!token) return;

        const payload = parseJwt(token);
        const email = payload ? payload.sub : null;
        const saBtn = document.getElementById('superadmin-tab-btn');
        if (saBtn) {
            if (email === 'arno@alkdata.dk' || email === 'arnolkristiansen@outlook.com') {
                saBtn.style.display = 'block';
            } else {
                saBtn.style.display = 'none';
            }
        }

        try {
            const response = await fetch(`${API_BASE}/clubs/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                const clubs = await response.json();
                if(clubs.length === 0) {
                    // Måske vise "Opret din første klub" skærm
                    showClubSelectionSection([]);
                } else if(clubs.length === 1) {
                    const justCreated = localStorage.getItem('just_registered_club') === 'true';
                    localStorage.removeItem('just_registered_club');
                    selectClub(clubs[0].id, justCreated);
                } else {
                    showClubSelectionSection(clubs);
                }
            } else {
                logout();
            }
        } catch(err) {
            console.error(err);
        }
    }

    function showClubSelectionSection(clubs) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'none';
        clubSelectionSection.style.display = 'block';

        const list = document.getElementById('club-selection-list');
        list.innerHTML = '';
        clubs.forEach(c => {
            list.innerHTML += `
                <div class="list-item" style="cursor: pointer; border-left: 4px solid var(--primary);" onclick="selectClub(${c.id})">
                    <div>
                        <strong>${c.name}</strong>
                    </div>
                    <i class="fas fa-arrow-right" style="color: var(--text-secondary);"></i>
                </div>
            `;
        });
    }

    window.selectClub = function(id, goToProfile = false) {
        window.activeClubId = id;
        showDashboard();
        if (goToProfile) {
            window.switchTab('profile');
        }
    };

    window.showClubSelection = function() {
        checkUserClubs();
    };

    document.getElementById('create-new-club-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-club-name').value;
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name })
            });
            if(response.ok) {
                const newClub = await response.json();
                document.getElementById('create-new-club-modal').style.display = 'none';
                document.getElementById('create-new-club-form').reset();
                selectClub(newClub.id, true);
            }
        } catch(err) { console.error(err); }
    });

    window.logout = function() {
        localStorage.removeItem('equievent_token');
        sessionStorage.removeItem('equievent_token');
        window.activeClubId = null;
        
        // Hide active club banner on logout
        const activeClubBanner = document.getElementById('active-club-banner');
        if (activeClubBanner) activeClubBanner.style.display = 'none';

        clubSelectionSection.style.display = 'none';
        showLogin();
    };

    function showLogin() {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }

    function showDashboard() {
        loginSection.style.display = 'none';
        clubSelectionSection.style.display = 'none';
        dashboardSection.style.display = 'flex';
        
        // Reset active competition state and hide details panel when switching clubs
        window.showCompetitionsList();

        fetchProfile();
        fetchGlobalDirectory();
        fetchClubPosts();
        window.updateScoringMethodOptions();
    }

    window.switchTab = function(tabName) {
        document.querySelectorAll('.tab-btn').forEach(b => {
            if (b.getAttribute('data-tab') === tabName) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        document.querySelectorAll('.tab-content').forEach(c => {
            if (c.id === `${tabName}-tab`) {
                c.style.display = 'block';
            } else {
                c.style.display = 'none';
            }
        });
        
        if (tabName === 'directory') fetchGlobalDirectory();
        window.closeSidebar();
    };

    // Tabs navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-tab');
            window.switchTab(tabName);
        });
    });

    // Profile Logic
    const profileForm = document.getElementById('profile-form');
    async function fetchProfile() {
        if(!window.activeClubId) return;
        const token = getToken();
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                document.getElementById('prof-name').value = data.name || '';
                document.getElementById('prof-contact-name').value = data.contact_name || '';
                document.getElementById('prof-phone').value = data.phone || '';
                document.getElementById('prof-contact-email').value = data.contact_email || '';
                document.getElementById('prof-zip').value = data.zip_code || '';
                document.getElementById('prof-city').value = data.city || '';
                document.getElementById('prof-address').value = data.address || '';
                
                // Update active club name in sidebar and topbar
                const clubName = data.name || 'Ingen klub valgt';
                const activeClubNameSidebar = document.getElementById('active-club-name-sidebar');
                if (activeClubNameSidebar) {
                    activeClubNameSidebar.innerText = clubName;
                    activeClubNameSidebar.style.display = 'block';
                }
                const activeClubNameTopbar = document.getElementById('active-club-name-topbar');
                if (activeClubNameTopbar) {
                    activeClubNameTopbar.innerText = clubName;
                    activeClubNameTopbar.style.display = 'inline-block';
                }

                // Update active club banner
                const activeClubBanner = document.getElementById('active-club-banner');
                const activeClubBannerName = document.getElementById('active-club-banner-name');
                if (activeClubBanner && activeClubBannerName) {
                    activeClubBannerName.innerText = clubName;
                    activeClubBanner.style.display = 'flex';
                }
            }
        } catch(err) { console.error(err); }
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!window.activeClubId) return;
            const token = getToken();
            const payload = {
                name: document.getElementById('prof-name').value,
                contact_name: document.getElementById('prof-contact-name').value,
                phone: document.getElementById('prof-phone').value,
                contact_email: document.getElementById('prof-contact-email').value,
                zip_code: document.getElementById('prof-zip').value,
                city: document.getElementById('prof-city').value,
                address: document.getElementById('prof-address').value
            };
            try {
                const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    // Update active club name in sidebar and topbar immediately
                    const newName = document.getElementById('prof-name').value;
                    const activeClubNameSidebar = document.getElementById('active-club-name-sidebar');
                    if (activeClubNameSidebar) {
                        activeClubNameSidebar.innerText = newName;
                        activeClubNameSidebar.style.display = 'block';
                    }
                    const activeClubNameTopbar = document.getElementById('active-club-name-topbar');
                    if (activeClubNameTopbar) {
                        activeClubNameTopbar.innerText = newName;
                        activeClubNameTopbar.style.display = 'inline-block';
                    }

                    // Update active club banner name immediately
                    const activeClubBanner = document.getElementById('active-club-banner');
                    const activeClubBannerName = document.getElementById('active-club-banner-name');
                    if (activeClubBanner && activeClubBannerName) {
                        activeClubBannerName.innerText = newName;
                        activeClubBanner.style.display = 'flex';
                    }

                    const msg = document.getElementById('prof-msg');
                    msg.style.display = 'block';
                    setTimeout(() => msg.style.display = 'none', 3000);
                }
            } catch(err) { console.error(err); }
        });
    }

    const profileAddClubForm = document.getElementById('profile-add-club-form');
    if (profileAddClubForm) {
        profileAddClubForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('prof-new-club-name').value;
            const token = getToken();
            try {
                const response = await fetch(`${API_BASE}/clubs/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ name })
                });
                if(response.ok) {
                    const newClub = await response.json();
                    document.getElementById('prof-new-club-name').value = '';
                    alert(`Klubben "${newClub.name}" er oprettet! Du skifter nu til denne klub.`);
                    selectClub(newClub.id, true);
                } else {
                    alert("Kunne ikke oprette klubben. Prøv igen.");
                }
            } catch(err) { console.error(err); }
        });
    }

    // --- GLOBALT KARTOTEK LOGIK ---
    let globalDirectory = { riders: [], judges: [] };

    async function fetchGlobalDirectory() {
        if(!window.activeClubId) return;
        const token = getToken();
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/directory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                globalDirectory = await response.json();
                renderGlobalDirectory();
                updateCompetitionSelects();
            }
        } catch(err) { console.error(err); }
    }

    function renderGlobalDirectory() {
        const ridersList = document.getElementById('dir-riders-list');
        const judgesList = document.getElementById('dir-judges-list');
        if(!ridersList || !judgesList) return;

        ridersList.innerHTML = '';
        if (globalDirectory.riders.length === 0) {
            ridersList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Ingen ryttere oprettet endnu.</p>';
        } else {
            globalDirectory.riders.forEach(rider => {
                const badges = rider.competitions.map(c => `<span class="badge">${c.name}</span>`).join('');
                const horses = rider.horses.map(h => `<span style="font-size: 0.8rem; color: #cbd5e1; margin-right: 0.5rem;"><i class="fas fa-horse-head"></i> ${h.name}</span>`).join('');
                
                ridersList.innerHTML += `
                    <div class="list-item" style="border-left: 4px solid var(--primary); cursor: pointer;" onclick="openDirRiderModal(${rider.id})">
                        <div>
                            <strong>${rider.name}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem;"><i class="fas fa-envelope"></i> ${rider.email} ${rider.phone ? `| <i class="fas fa-phone"></i> ${rider.phone}` : ''}</div>
                            <div style="margin-top: 0.5rem;">${horses}</div>
                            <div style="margin-top: 0.5rem;">${badges}</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
                    </div>
                `;
            });
        }

        judgesList.innerHTML = '';
        if (globalDirectory.judges.length === 0) {
            judgesList.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Ingen dommere oprettet endnu.</p>';
        } else {
            globalDirectory.judges.forEach(judge => {
                const badges = judge.competitions.map(c => `<span class="badge">${c.name}</span>`).join('');
                const emailStr = judge.email || 'Ingen email';
                
                judgesList.innerHTML += `
                    <div class="list-item" style="border-left: 4px solid #10b981; cursor: pointer;" onclick="openDirJudgeModal(${judge.id})">
                        <div>
                            <strong>${judge.name}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem;"><i class="fas fa-envelope"></i> ${emailStr} ${judge.phone ? `| <i class="fas fa-phone"></i> ${judge.phone}` : ''}</div>
                            <div style="margin-top: 0.5rem;">${badges}</div>
                        </div>
                        <i class="fas fa-chevron-right" style="color: var(--text-secondary);"></i>
                    </div>
                `;
            });
        }
    }

    // Modal Håndtering: Rytter
    window.openDirRiderModal = function(riderId = null) {
        const form = document.getElementById('dir-rider-form');
        form.reset();
        document.getElementById('dir-rider-horses-section').style.display = 'none';
        document.getElementById('dir-rider-id').value = '';

        if (riderId) {
            const rider = globalDirectory.riders.find(r => r.id === riderId);
            if (rider) {
                document.getElementById('dir-rider-title').innerText = 'Ret Rytter';
                document.getElementById('dir-rider-id').value = rider.id;
                document.getElementById('dir-rider-name').value = rider.name;
                document.getElementById('dir-rider-email').value = rider.email;
                document.getElementById('dir-rider-phone').value = rider.phone || '';
                
                renderRiderHorses(rider);
                document.getElementById('dir-rider-horses-section').style.display = 'block';
            }
        } else {
            document.getElementById('dir-rider-title').innerText = 'Opret Ny Rytter';
        }
        document.getElementById('dir-rider-modal').style.display = 'flex';
    };

    document.getElementById('dir-rider-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.activeClubId) return;
        const id = document.getElementById('dir-rider-id').value;
        const payload = {
            name: document.getElementById('dir-rider-name').value,
            email: document.getElementById('dir-rider-email').value,
            phone: document.getElementById('dir-rider-phone').value || null
        };

        const token = getToken();
        const url = id ? `${API_BASE}/clubs/${window.activeClubId}/club_riders/${id}` : `${API_BASE}/clubs/${window.activeClubId}/club_riders`;
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const savedRider = await response.json();
                document.getElementById('dir-rider-id').value = savedRider.id;
                document.getElementById('dir-rider-title').innerText = 'Ret Rytter';
                document.getElementById('dir-rider-horses-section').style.display = 'block';
                await fetchGlobalDirectory();
                const updatedRider = globalDirectory.riders.find(r => r.id === savedRider.id);
                if(updatedRider) renderRiderHorses(updatedRider);
                if (!id) {
                    if(!confirm("Rytter oprettet!\n\nVil du blive her og tilføje heste til rytteren med det samme?\n(Tryk 'Annuller' for at lukke og gå tilbage til oversigten)")) {
                        document.getElementById('dir-rider-modal').style.display = 'none';
                    }
                }
            }
        } catch(err) { console.error(err); }
    });

    // Heste Håndtering
    function renderRiderHorses(rider) {
        const list = document.getElementById('dir-rider-horses-list');
        list.innerHTML = '';
        if (rider.horses.length === 0) {
            list.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-secondary);">Ingen heste tilføjet endnu.</p>';
            return;
        }
        rider.horses.forEach(horse => {
            list.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 4px;">
                    <span><i class="fas fa-horse-head" style="color: var(--text-secondary);"></i> ${horse.name}</span>
                    <button class="btn btn-danger btn-sm" onclick="deleteHorse(${horse.id}, ${rider.id})" style="padding: 0.2rem 0.5rem;"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
    }

    document.getElementById('dir-add-horse-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.activeClubId) return;
        const riderId = document.getElementById('dir-rider-id').value;
        const horseName = document.getElementById('dir-new-horse-name').value;
        if (!riderId) return;

        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/club_riders/${riderId}/horses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: horseName })
            });
            if (response.ok) {
                document.getElementById('dir-new-horse-name').value = '';
                await fetchGlobalDirectory();
                const rider = globalDirectory.riders.find(r => r.id == riderId);
                renderRiderHorses(rider);
            }
        } catch(err) { console.error(err); }
    });

    window.deleteHorse = async function(horseId, riderId) {
        if(!window.activeClubId) return;
        if(!confirm("Vil du slette denne hest?")) return;
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/horses/${horseId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                await fetchGlobalDirectory();
                const rider = globalDirectory.riders.find(r => r.id == riderId);
                renderRiderHorses(rider);
            }
        } catch(err) { console.error(err); }
    };

    // Modal Håndtering: Dommer
    window.openDirJudgeModal = function(judgeId = null) {
        const form = document.getElementById('dir-judge-form');
        form.reset();
        document.getElementById('dir-judge-id').value = '';

        if (judgeId) {
            const judge = globalDirectory.judges.find(j => j.id === judgeId);
            if (judge) {
                document.getElementById('dir-judge-title').innerText = 'Ret Dommer';
                document.getElementById('dir-judge-id').value = judge.id;
                document.getElementById('dir-judge-name').value = judge.name;
                document.getElementById('dir-judge-email').value = judge.email || '';
                document.getElementById('dir-judge-phone').value = judge.phone || '';
            }
        } else {
            document.getElementById('dir-judge-title').innerText = 'Opret Ny Dommer';
        }
        document.getElementById('dir-judge-modal').style.display = 'flex';
    };

    document.getElementById('dir-judge-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.activeClubId) return;
        const id = document.getElementById('dir-judge-id').value;
        const payload = {
            name: document.getElementById('dir-judge-name').value,
            email: document.getElementById('dir-judge-email').value || null,
            phone: document.getElementById('dir-judge-phone').value || null
        };

        const token = getToken();
        const url = id ? `${API_BASE}/clubs/${window.activeClubId}/club_judges/${id}` : `${API_BASE}/clubs/${window.activeClubId}/club_judges`;
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                document.getElementById('dir-judge-modal').style.display = 'none';
                await fetchGlobalDirectory();
            }
        } catch(err) { console.error(err); }
    });

    // --- STÆVNER LOGIK ---
    let currentCompId = null;
    window.currentCompId = null;

    async function fetchCompetitions() {
        if(!window.activeClubId) return;
        const token = getToken();
        if(!token) return;
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const comps = await response.json();
                const list = document.getElementById('competitions-list');
                list.innerHTML = '';
                comps.forEach(c => {
                    const dateStr = new Date(c.date).toLocaleDateString('da-DK');
                    const timeStr = c.start_time ? ` | <i class="far fa-clock"></i> ${c.start_time} - ${c.end_time || '?'}` : '';
                    list.innerHTML += `
                        <div class="list-item" style="cursor: pointer;" onclick="openCompetition(${c.id}, '${c.name}')">
                            <div>
                                <strong>${c.name}</strong>
                                <div style="font-size: 0.8rem; color: var(--text-secondary);"><i class="far fa-calendar"></i> ${dateStr}${timeStr} | <i class="fas fa-map-marker-alt"></i> ${c.location}</div>
                            </div>
                            <button class="btn btn-secondary btn-sm">Vis</button>
                        </div>
                    `;
                });
            }
        } catch(err) { console.error(err); }
    }

    document.getElementById('new-comp-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.activeClubId) return;
        const token = getToken();
        const disciplines = Array.from(document.querySelectorAll('input[name="comp-discipline-cb"]:checked')).map(cb => cb.value).join(',');
        if (!disciplines) {
            alert('Vælg venligst mindst én disciplin.');
            return;
        }
        const importStandards = document.getElementById('comp-import-standards-cb').checked;
        const selectedPosts = Array.from(document.querySelectorAll('.new-comp-custom-class-cb:checked')).map(cb => parseInt(cb.value));

        const payload = {
            name: document.getElementById('comp-name').value,
            date: new Date(document.getElementById('comp-date').value).toISOString(),
            start_time: document.getElementById('comp-start-time')?.value || null,
            end_time: document.getElementById('comp-end-time')?.value || null,
            location: document.getElementById('comp-location').value,
            discipline: disciplines,
            scoring_method: document.getElementById('comp-scoring-method').value,
            import_standards: importStandards,
            post_ids: importStandards ? [] : selectedPosts
        };
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                window.showCompetitionsList();
            }
        } catch(err) { console.error(err); }
    });

    // Event listener to update custom classes when disciplines toggle
    document.querySelectorAll('input[name="comp-discipline-cb"]').forEach(cb => {
        cb.addEventListener('change', () => {
            const importCb = document.getElementById('comp-import-standards-cb');
            if (importCb && !importCb.checked) {
                window.updateNewCompCustomClassesList();
            }
        });
    });

    // Centralized visibility controllers for stævner
    console.log("main.js: Registering stævner visibility controllers");
    window.showCreateCompetitionForm = function() {
        console.log("main.js: showCreateCompetitionForm called");
        document.getElementById('competitions-list').style.display = 'none';
        document.getElementById('competition-details').style.display = 'none';
        document.getElementById('new-comp-form').style.display = 'block';
        
        const newCompBtn = document.getElementById('new-comp-btn');
        if (newCompBtn) newCompBtn.style.display = 'none';
        
        const headerTitle = document.getElementById('competitions-header-title');
        if (headerTitle) headerTitle.innerText = "Opret Nyt Stævne";
    };

    window.showCompetitionsList = function() {
        console.log("main.js: showCompetitionsList called");
        const newCompForm = document.getElementById('new-comp-form');
        if (newCompForm) {
            newCompForm.reset();
            newCompForm.style.display = 'none';
        }
        
        const customClassesContainer = document.getElementById('comp-creation-custom-classes-container');
        if (customClassesContainer) customClassesContainer.style.display = 'none';
        
        document.getElementById('competition-details').style.display = 'none';
        
        window.currentCompId = null;
        currentCompId = null;
        
        document.getElementById('competitions-list').style.display = 'flex';
        
        const newCompBtn = document.getElementById('new-comp-btn');
        if (newCompBtn) newCompBtn.style.display = 'inline-block';
        
        const headerTitle = document.getElementById('competitions-header-title');
        if (headerTitle) headerTitle.innerText = "Stævner";
        
        fetchCompetitions();
    };

    // STÆVNE DETALJER
    window.openCompetition = async function(id, name) {
        currentCompId = id;
        window.currentCompId = id;
        document.getElementById('competitions-list').style.display = 'none';
        document.getElementById('new-comp-form').style.display = 'none';
        
        const newCompBtn = document.getElementById('new-comp-btn');
        if (newCompBtn) newCompBtn.style.display = 'none';
        
        const headerTitle = document.getElementById('competitions-header-title');
        if (headerTitle) headerTitle.innerText = "Stævnedetaljer";

        document.getElementById('competition-details').style.display = 'block';
        document.getElementById('detail-comp-name').innerText = name;
        
        document.getElementById('competition-details').scrollIntoView({ behavior: 'smooth' });
        
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                window.activeCompetition = await response.json();
                
                const banner = document.getElementById('comp-payment-banner');
                if (banner) {
                    const now = new Date();
                    const compDate = window.activeCompetition.date ? new Date(window.activeCompetition.date) : null;
                    const activeUntil = window.activeCompetition.active_until ? new Date(window.activeCompetition.active_until) : null;
                    
                    const isArchived = compDate && (now - compDate) > (365 * 24 * 60 * 60 * 1000);
                    const isExpired = window.activeCompetition.is_active && activeUntil && activeUntil < now;
                    
                    if (isArchived) {
                        banner.style.background = 'rgba(148, 163, 184, 0.08)';
                        banner.style.borderColor = 'rgba(148, 163, 184, 0.25)';
                        banner.style.borderLeft = '4px solid #94a3b8';
                        banner.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <i class="fas fa-archive" style="color: #94a3b8; font-size: 1.5rem;"></i>
                                <div>
                                    <h4 style="color: #ffffff; margin: 0 0 0.25rem 0;">Dette stævne er arkiveret (Ældre end 1 år)</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">Stævnet er låst. Du kan se alle resultater, ryttere og klasser, men yderligere pointafgivelse er deaktiveret.</p>
                                </div>
                            </div>
                        `;
                        banner.style.display = 'flex';
                    } else if (isExpired) {
                        banner.style.background = 'rgba(239, 68, 68, 0.08)';
                        banner.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        banner.style.borderLeft = '4px solid #ef4444';
                        banner.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <i class="fas fa-lock" style="color: #ef4444; font-size: 1.5rem;"></i>
                                <div>
                                    <h4 style="color: #ffffff; margin: 0 0 0.25rem 0;">Dette stævne er lukket (Aktivering udløbet)</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">Perioden på 14 dage efter stævnets afholdelse er udløbet. Pointafgivelse er deaktiveret, men alle data kan stadig læses.</p>
                                </div>
                            </div>
                        `;
                        banner.style.display = 'flex';
                    } else if (window.activeCompetition.is_active) {
                        const validUntilStr = activeUntil ? activeUntil.toLocaleDateString('da-DK') : 'Ubegrænset';
                        banner.style.background = 'rgba(16, 185, 129, 0.08)';
                        banner.style.borderColor = 'rgba(16, 185, 129, 0.25)';
                        banner.style.borderLeft = '4px solid #10b981';
                        banner.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <i class="fas fa-check-circle" style="color: #10b981; font-size: 1.5rem;"></i>
                                <div>
                                    <h4 style="color: #ffffff; margin: 0 0 0.25rem 0;">Dette stævne er Aktivt & Betalt</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">Dommere kan frit afgive karakterer. Aktiveringen gælder indtil: <strong>${validUntilStr}</strong> (14 dage efter stævnets afholdelse).</p>
                                </div>
                            </div>
                        `;
                        banner.style.display = 'flex';
                    } else {
                        banner.style.background = 'rgba(251, 191, 36, 0.08)';
                        banner.style.borderColor = 'rgba(251, 191, 36, 0.25)';
                        banner.style.borderLeft = '4px solid #fbbf24';
                        banner.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <i class="fas fa-exclamation-triangle" style="color: #fbbf24; font-size: 1.5rem;"></i>
                                <div>
                                    <h4 style="color: #ffffff; margin: 0 0 0.25rem 0;">Dette stævne er inaktivt (Ikke betalt)</h4>
                                    <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">Dommere vil ikke kunne afgive karakterer, før stævnet aktiveres. Pris: 299 DKK. Gælder indtil 14 dage efter afholdelse.</p>
                                </div>
                            </div>
                            <button class="btn btn-primary" onclick="openPaymentModal()" style="background: #fbbf24; color: #0f172a; border: none; font-weight: bold; width: auto; white-space: nowrap; padding: 0.5rem 1rem;"><i class="fas fa-credit-card"></i> Aktiver Stævne</button>
                        `;
                        banner.style.display = 'flex';
                    }
                }
            }
        } catch(err) {
            console.error('Error fetching competition:', err);
        }
        
        showCompTab('classes');
        updateCompetitionSelects();
    };

    window.deleteCompetition = async function() {
        if(!currentCompId || !window.activeClubId) return;
        if(!confirm('Er du sikker på, at du vil slette dette stævne? Alt data (ryttere, dommere, scores) forbundet med stævnet vil gå tabt!')) return;
        
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${currentCompId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if(response.ok) {
                window.showCompetitionsList();
            } else {
                alert('Kunne ikke slette stævnet. Prøv igen.');
            }
        } catch(err) {
            console.error(err);
            alert('Der opstod en fejl.');
        }
    };

    window.sendJudgeEmail = async function(compJudgeId) {
        if(!window.activeClubId || !window.currentCompId) return;
        if(!confirm('Vil du sende en email med login-link til denne dommer?')) return;
        
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${window.currentCompId}/judges/${compJudgeId}/send-email`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
            } else {
                alert(data.detail || 'Kunne ikke sende email');
            }
        } catch(err) {
            console.error(err);
            alert('Der opstod en fejl.');
        }
    };

    window.showCompTab = function(tab) {
        document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('comp-riders-section').style.display = 'none';
        document.getElementById('comp-classes-section').style.display = 'none';
        document.getElementById('comp-judges-section').style.display = 'none';

        // Add active class based on onclick content
        document.querySelectorAll('.detail-tab-btn').forEach(b => {
            if (b.getAttribute('onclick').includes(`'${tab}'`)) {
                b.classList.add('active');
            }
        });

        if(tab === 'riders') {
            document.getElementById('comp-riders-section').style.display = 'block';
            fetchCompRiders();
            renderRiderClassesCheckboxes();
        } else if(tab === 'classes') {
            document.getElementById('comp-classes-section').style.display = 'block';
            loadCompetitionClassesSection();
        } else if(tab === 'judges') {
            document.getElementById('comp-judges-section').style.display = 'block';
            fetchCompJudges();
        }
    };

    function updateCompetitionSelects() {
        const riderSelect = document.getElementById('comp-rider-select');
        const judgeSelect = document.getElementById('comp-judge-select');
        if(!riderSelect || !judgeSelect) return;

        riderSelect.innerHTML = '<option value="">-- Vælg rytter --</option>';
        globalDirectory.riders.forEach(r => {
            riderSelect.innerHTML += `<option value="${r.id}">${r.name} (${r.email})</option>`;
        });

        judgeSelect.innerHTML = '<option value="">-- Vælg dommer --</option>';
        globalDirectory.judges.forEach(j => {
            judgeSelect.innerHTML += `<option value="${j.id}">${j.name}</option>`;
        });
    }

    window.updateHorseSelect = function() {
        const riderId = document.getElementById('comp-rider-select').value;
        const horseSelect = document.getElementById('comp-horse-select');
        horseSelect.innerHTML = '<option value="">-- Vælg hest --</option>';
        if(!riderId) return;

        const rider = globalDirectory.riders.find(r => r.id == riderId);
        if(rider && rider.horses) {
            rider.horses.forEach(h => {
                horseSelect.innerHTML += `<option value="${h.id}">${h.name}</option>`;
            });
        }
    };

    // Tilknyt Rytter
    document.getElementById('add-comp-rider-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.activeClubId || !currentCompId) return;

        const riderId = document.getElementById('comp-rider-select').value;
        const horseId = document.getElementById('comp-horse-select').value;

        if(!riderId || !horseId) {
            alert("Du skal vælge både rytter og hest.");
            return;
        }

        const riderPosts = [];
        document.querySelectorAll('.rider-class-cb:checked').forEach(cb => {
            const postId = parseInt(cb.value);
            const startNumInput = document.querySelector(`.rider-class-start-num[data-post-id="${postId}"]`);
            const startNumber = startNumInput && startNumInput.value ? parseInt(startNumInput.value) : null;
            riderPosts.push({
                club_post_id: postId,
                start_number: startNumber
            });
        });

        if (riderPosts.length === 0) {
            alert("Vælg venligst mindst én klasse at tilmelde rytteren til.");
            return;
        }

        const payload = {
            club_rider_id: parseInt(riderId),
            horse_id: parseInt(horseId),
            rider_posts: riderPosts
        };

        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${currentCompId}/riders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if(response.ok) {
                document.getElementById('add-comp-rider-form').reset();
                document.getElementById('comp-horse-select').innerHTML = '<option value="">-- Vælg rytter først --</option>';
                renderRiderClassesCheckboxes();
                fetchCompRiders();
                fetchGlobalDirectory();
            } else {
                const data = await response.json();
                alert(data.detail || 'Kunne ikke tilknytte rytter.');
            }
        } catch(err) { console.error(err); }
    });

    async function fetchCompRiders() {
        if(!window.activeClubId || !currentCompId) return;
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${currentCompId}/riders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                const riders = await response.json();
                const list = document.getElementById('comp-riders-list');
                list.innerHTML = '';
                riders.forEach(r => {
                    let classesHtml = '';
                    if (r.rider_posts && r.rider_posts.length > 0) {
                        classesHtml = r.rider_posts.map(rp => {
                            const discColor = rp.club_post.discipline === 'gait' ? '#fbbf24' : rp.club_post.discipline === 'dressage' ? '#60a5fa' : '#f87171';
                            const textColor = rp.club_post.discipline === 'gait' ? '#0f172a' : '#ffffff';
                            return `<span class="badge" style="background: ${discColor}; color: ${textColor}; margin-right: 0.3rem;">${rp.club_post.name} ${rp.start_number ? `#${rp.start_number}` : ''}</span>`;
                        }).join(' ');
                    }
                    
                    list.innerHTML += `
                        <div class="list-item" style="border-left: 4px solid var(--primary);">
                            <div>
                                <strong>${r.club_rider.name}</strong> 
                                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                                    <span><i class="fas fa-horse-head"></i> ${r.horse.name}</span>
                                    <span style="color: var(--text-secondary);">|</span>
                                    <span style="display: flex; gap: 0.25rem; flex-wrap: wrap;">${classesHtml}</span>
                                </div>
                            </div>
                            <button class="btn btn-danger btn-sm" onclick="deleteCompRider(${r.id})"><i class="fas fa-unlink"></i> Fjern</button>
                        </div>
                    `;
                });
            }
        } catch(err) { console.error(err); }
    }

    window.deleteCompRider = async function(compRiderId) {
        if(!window.activeClubId || !currentCompId) return;
        if(!confirm("Fjern rytter fra stævnet?")) return;
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${currentCompId}/riders/${compRiderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                fetchCompRiders();
                fetchGlobalDirectory();
            }
        } catch(err) { console.error(err); }
    };

    // Tilknyt Dommer
    document.getElementById('add-comp-judge-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.activeClubId || !currentCompId) return;

        const judgeId = document.getElementById('comp-judge-select').value;
        const role = document.getElementById('comp-judge-role').value;
        const postIds = Array.from(document.querySelectorAll('.post-checkbox:checked')).map(cb => parseInt(cb.value));

        if(!judgeId) return;

        const payload = {
            club_judge_id: parseInt(judgeId),
            role: role,
            post_ids: postIds
        };

        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${currentCompId}/judges`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if(response.ok) {
                document.getElementById('add-comp-judge-form').reset();
                fetchCompJudges();
                fetchGlobalDirectory();
            }
        } catch(err) { console.error(err); }
    });

    async function fetchCompJudges() {
        if(!window.activeClubId || !currentCompId) return;
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${currentCompId}/judges`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                const judges = await response.json();
                const list = document.getElementById('comp-judges-list');
                list.innerHTML = '';
                judges.forEach(j => {
                    const postBadges = j.club_posts && j.club_posts.length > 0 
                        ? j.club_posts.map(p => {
                            const bg = p.discipline === 'gait' ? '#fbbf24' : p.discipline === 'dressage' ? '#60a5fa' : '#f87171';
                            const text = p.discipline === 'gait' ? '#0f172a' : '#ffffff';
                            return `<span class="badge" style="background: ${bg}; color: ${text}; margin-right: 0.3rem;">${p.name}</span>`;
                        }).join('')
                        : '<span style="font-size: 0.8rem; color: var(--text-secondary);">Ingen poster tilknyttet</span>';
                        
                    list.innerHTML += `
                        <div class="list-item" style="border-left: 4px solid #10b981; flex-direction: column; align-items: stretch;">
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <div>
                                    <strong>${j.club_judge.name}</strong>
                                    <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem;">Rolle: ${j.role}</div>
                                    <div style="margin-top: 0.5rem;">${postBadges}</div>
                                </div>
                                <button class="btn btn-danger btn-sm" onclick="deleteCompJudge(${j.id})"><i class="fas fa-unlink"></i> Fjern</button>
                            </div>
                            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border); display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button class="btn btn-secondary btn-sm" onclick="window.copyJudgeLink('${j.magic_link_uuid}')"><i class="fas fa-copy"></i> Kopiér Link</button>
                                <button class="btn btn-secondary btn-sm" onclick="sendJudgeEmail(${j.id})"><i class="fas fa-envelope"></i> Send Email</button>
                                <button class="btn btn-primary btn-sm" style="background: #10b981;" onclick="window.open('?magic=${j.magic_link_uuid}', '_blank')"><i class="fas fa-external-link-alt"></i> Åbn Dommer Panel</button>
                            </div>
                        </div>
                    `;
                });
            }
        } catch(err) { console.error(err); }
    }

    window.deleteCompJudge = async function(compJudgeId) {
        if(!window.activeClubId || !currentCompId) return;
        if(!confirm("Fjern dommer fra stævnet?")) return;
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${currentCompId}/judges/${compJudgeId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                fetchCompJudges();
                fetchGlobalDirectory();
            }
        } catch(err) { console.error(err); }
    };

    // --- KLUB POSTER ---
    let clubPosts = [];

    async function loadClubPosts() {
        if(!window.activeClubId) return;
        const token = getToken();
        if(!token) return;
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/club_posts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                clubPosts = await response.json();
            }
        } catch(err) { console.error(err); }
    }

    window.toggleNewCompCustomClasses = async function() {
        const importCb = document.getElementById('comp-import-standards-cb');
        const container = document.getElementById('comp-creation-custom-classes-container');
        if (!importCb || !container) return;
        
        if (importCb.checked) {
            container.style.display = 'none';
        } else {
            container.style.display = 'flex';
            await window.updateNewCompCustomClassesList();
        }
    };

    window.updateNewCompCustomClassesList = async function() {
        const listContainer = document.getElementById('comp-creation-custom-classes-list');
        if (!listContainer) return;
        listContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-secondary);">Henter klasser...</span>';
        
        const checkedDisciplines = Array.from(document.querySelectorAll('input[name="comp-discipline-cb"]:checked')).map(cb => cb.value);
        if (checkedDisciplines.length === 0) {
            listContainer.innerHTML = '<span style="font-size: 0.85rem; color: #f43f5e;">Vælg mindst én disciplin ovenfor for at se klasser.</span>';
            return;
        }
        
        try {
            await loadClubPosts();
            
            const filteredPosts = clubPosts.filter(p => checkedDisciplines.includes(p.discipline || 'gait'));
            
            listContainer.innerHTML = '';
            if (filteredPosts.length === 0) {
                listContainer.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-secondary);">Ingen oprettede klubklasser fundet for de valgte discipliner. Opret dem under "Poster / Klasser" eller vælg standardklasser.</span>';
                return;
            }
            
            filteredPosts.forEach(p => {
                const discName = p.discipline === 'gait' ? 'Gangart' : p.discipline === 'dressage' ? 'Dressur' : 'Spring';
                const discColor = p.discipline === 'gait' ? '#fbbf24' : p.discipline === 'dressage' ? '#60a5fa' : '#f87171';
                
                listContainer.innerHTML += `
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; color: white;">
                        <input type="checkbox" class="new-comp-custom-class-cb" value="${p.id}" checked style="width: auto; margin: 0;">
                        <span>${p.name} <small style="color: ${discColor};">(${discName})</small></span>
                    </label>
                `;
            });
        } catch (err) {
            console.error('Error updating new competition custom classes:', err);
            listContainer.innerHTML = '<span style="font-size: 0.85rem; color: #f43f5e;">Fejl ved indlæsning af klasser.</span>';
        }
    };

    window.fetchClubPosts = async function() {
        if(!window.activeClubId) return;
        const token = getToken();
        if(!token) return;
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/club_posts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                clubPosts = await response.json();
                renderClubPosts();
                updateCompetitionJudgePostsCheckboxes();
            }
        } catch(err) { console.error(err); }
    };

    function renderClubPosts() {
        const list = document.getElementById('club-posts-list');
        if(!list) return;
        list.innerHTML = '';
        
        const filterVal = document.getElementById('club-post-filter')?.value || 'all';
        const filteredPosts = clubPosts.filter(p => {
            if (filterVal === 'all') return true;
            return (p.discipline || 'gait') === filterVal;
        });

        filteredPosts.forEach(p => {
            const locStr = p.location ? ` | <i class="fas fa-map-marker-alt"></i> ${p.location}` : '';
            const descStr = p.description ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem;">${p.description}</div>` : '';
            const discName = p.discipline === 'gait' ? 'Islandske Heste' : p.discipline === 'dressage' ? 'Dressur' : 'Spring';
            const discColor = p.discipline === 'gait' ? '#fbbf24' : p.discipline === 'dressage' ? '#60a5fa' : '#f87171';
            const textColor = p.discipline === 'gait' ? '#0f172a' : '#ffffff';
            const methodStr = p.scoring_method ? ` | Metode: ${p.scoring_method}` : '';
            const coefStr = ` <span style="color: #fbbf24; font-size: 0.8rem;">(Koefficient: ${p.coefficient || 1.0}, Max: ${p.max_value || 10.0})</span>`;
            list.innerHTML += `
                <div class="list-item" style="border-left: 4px solid ${discColor};">
                    <div>
                        <strong>${p.name}</strong> <span class="badge" style="background: ${discColor}; color: ${textColor}; font-size: 0.7rem; padding: 0.1rem 0.4rem; vertical-align: middle;">${discName}</span>${coefStr}${locStr}${methodStr}
                        ${descStr}
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deleteClubPost(${p.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
    }
    window.renderClubPosts = renderClubPosts;

    document.getElementById('club-post-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!window.activeClubId) return;

        const discipline = document.getElementById('club-post-discipline').value;
        if (discipline === 'all') {
            alert('Vælg venligst en specifik disciplin (Gangart, Dressur eller Spring) for at oprette en klasse.');
            return;
        }

        const token = getToken();
        const payload = {
            name: document.getElementById('club-post-name').value,
            coefficient: parseFloat(document.getElementById('club-post-coefficient').value || "1.0"),
            max_value: parseFloat(document.getElementById('club-post-max-value').value || "10.0"),
            location: document.getElementById('club-post-location').value || null,
            description: document.getElementById('club-post-description').value || null,
            discipline: document.getElementById('club-post-discipline').value,
            scoring_method: document.getElementById('club-post-scoring-method').value
        };
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/club_posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if(response.ok) {
                document.getElementById('club-post-form').reset();
                document.getElementById('club-post-coefficient').value = "1.0";
                document.getElementById('club-post-max-value').value = "10.0";
                window.updateClubPostScoringMethodOptions();
                fetchClubPosts();
            }
        } catch(err) { console.error(err); }
    });

    window.deleteClubPost = async function(postId) {
        if(!window.activeClubId) return;
        if(!confirm("Slet post/klasse?")) return;
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/club_posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(response.ok) {
                fetchClubPosts();
            }
        } catch(err) { console.error(err); }
    };

    function updateCompetitionJudgePostsCheckboxes() {
        const container = document.getElementById('comp-judge-posts-checkboxes');
        if(!container) return;
        container.innerHTML = '';
        
        const activePosts = (window.activeCompetition && window.activeCompetition.club_posts) || [];
        
        if(activePosts.length === 0) {
            container.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-secondary);">Ingen aktive stævneklasser endnu.</span>';
        } else {
            activePosts.forEach(p => {
                const discName = p.discipline === 'gait' ? 'Gangart' : p.discipline === 'dressage' ? 'Dressur' : 'Spring';
                container.innerHTML += `
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
                        <input type="checkbox" class="post-checkbox" value="${p.id}" style="width: auto; margin: 0;">
                        <span>${p.name} <small style="color: var(--text-secondary);">(${discName} x${p.coefficient || 1.0})</small></span>
                    </label>
                `;
            });
        }
    }

    window.updateClubPostScoringMethodOptions = function() {
        const disciplineSelect = document.getElementById('club-post-discipline');
        const methodSelect = document.getElementById('club-post-scoring-method');
        if (!disciplineSelect || !methodSelect) return;
        
        const discipline = disciplineSelect.value;
        methodSelect.innerHTML = '';

        if (discipline === 'all') {
            methodSelect.innerHTML += '<option value="">-- Vælg disciplin først --</option>';
        } else if (discipline === 'gait') {
            methodSelect.innerHTML += '<option value="standard" selected>Standard (sum/gns)</option>';
        } else if (discipline === 'dressage') {
            methodSelect.innerHTML += '<option value="percentage" selected>Procent-bedømmelse (%)</option>';
        } else if (discipline === 'jumping') {
            methodSelect.innerHTML += `
                <option value="clear_round" selected>B0 / Clear Round (Sløjfe)</option>
                <option value="faults_time">Fejl og tid (Metode A)</option>
                <option value="style">Stilspringning</option>
                <option value="jump_off">Metode med omspringning</option>
            `;
        }
    };

    window.loadCompetitionClassesSection = async function() {
        if (!window.activeClubId || !window.currentCompId) return;
        
        const container = document.getElementById('comp-classes-checkboxes');
        if (!container) return;
        container.innerHTML = '<span style="color: var(--text-secondary);">Henter klasser...</span>';
        
        try {
            const token = getToken();
            const compResponse = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${window.currentCompId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (compResponse.ok) {
                window.activeCompetition = await compResponse.json();
            }
            
            await loadClubPosts();
            
            container.innerHTML = '';
            if (clubPosts.length === 0) {
                container.innerHTML = '<span style="font-size: 0.9rem; color: var(--text-secondary); grid-column: 1/-1;">Ingen poster/klasser oprettet i klubben endnu. Opret poster under "Poster / Klasser"-fanen først.</span>';
                return;
            }
            
            const activePostIds = new Set(window.activeCompetition.club_posts.map(p => p.id));
            
            const disciplines = {
                gait: { name: 'Gangart (Islandske Heste)', color: '#fbbf24', posts: [] },
                dressage: { name: 'Dressur', color: '#60a5fa', posts: [] },
                jumping: { name: 'Springning', color: '#f87171', posts: [] }
            };
            
            clubPosts.forEach(p => {
                const disc = p.discipline || 'gait';
                if (disciplines[disc]) {
                    disciplines[disc].posts.push(p);
                } else {
                    disciplines.gait.posts.push(p);
                }
            });
            
            Object.keys(disciplines).forEach(key => {
                const group = disciplines[key];
                if (group.posts.length > 0) {
                    const groupTitle = document.createElement('h5');
                    groupTitle.style.gridColumn = '1 / -1';
                    groupTitle.style.color = group.color;
                    groupTitle.style.marginTop = '0.5rem';
                    groupTitle.style.borderBottom = '1px solid var(--glass-border)';
                    groupTitle.style.paddingBottom = '0.25rem';
                    groupTitle.innerText = group.name;
                    container.appendChild(groupTitle);
                    
                    group.posts.forEach(p => {
                        const isChecked = activePostIds.has(p.id) ? 'checked' : '';
                        const label = document.createElement('label');
                        label.className = 'glass-card';
                        label.style.display = 'flex';
                        label.style.alignItems = 'center';
                        label.style.gap = '0.75rem';
                        label.style.padding = '0.75rem';
                        label.style.cursor = 'pointer';
                        label.style.margin = '0';
                        label.innerHTML = `
                            <input type="checkbox" class="comp-class-cb" value="${p.id}" ${isChecked} style="width: auto; margin: 0;">
                            <div>
                                <span style="font-weight: bold; color: white; display: block; font-size: 0.9rem;">${p.name}</span>
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">${p.scoring_method === 'percentage' ? 'Procent' : p.scoring_method === 'standard' ? 'Standard' : 'Spring (' + p.scoring_method + ')'}</span>
                            </div>
                        `;
                        container.appendChild(label);
                    });
                }
            });
            
            if (container.children.length === 0) {
                container.innerHTML = '<span style="font-size: 0.9rem; color: var(--text-secondary); grid-column: 1/-1;">Ingen poster/klasser i systemet.</span>';
            }
            
        } catch(err) {
            console.error('Error loading classes selection:', err);
            container.innerHTML = '<span style="color: #ef4444;">Kunne ikke hente klasser.</span>';
        }
    };

    window.saveCompetitionClasses = async function() {
        if (!window.activeClubId || !window.currentCompId) return;
        
        const selectedIds = Array.from(document.querySelectorAll('.comp-class-cb:checked')).map(cb => parseInt(cb.value));
        const token = getToken();
        
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${window.currentCompId}/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(selectedIds)
            });
            
            if (response.ok) {
                alert('Klassevalg gemt succesfuldt!');
                window.activeCompetition = await response.json();
                loadCompetitionClassesSection();
                updateCompetitionJudgePostsCheckboxes();
            } else {
                alert('Kunne ikke gemme klassevalg. Prøv igen.');
            }
        } catch(err) {
            console.error(err);
            alert('Der opstod en fejl.');
        }
    };

    window.importStandardClasses = async function() {
        if (!window.activeClubId || !window.currentCompId) return;
        
        if (!confirm('Dette vil oprette standardklasser for de valgte discipliner og tilknytte dem til stævnet. Fortsæt?')) return;
        
        const token = getToken();
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${window.currentCompId}/import-standard-classes`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                alert('Standardklasser importeret succesfuldt!');
                window.activeCompetition = await response.json();
                loadCompetitionClassesSection();
            } else {
                alert('Kunne ikke importere standardklasser. Sørg for at du har valgt mindst én disciplin på stævnet.');
            }
        } catch(err) {
            console.error(err);
            alert('Der opstod en fejl.');
        }
    };

    window.renderRiderClassesCheckboxes = function() {
        const container = document.getElementById('comp-rider-classes-container');
        if (!container) return;
        container.innerHTML = '';
        
        if (!window.activeCompetition || !window.activeCompetition.club_posts || window.activeCompetition.club_posts.length === 0) {
            container.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-secondary);">Ingen aktive klasser på dette stævne endnu. Gå til tabben "Klasser / Poster" for at tilføje klasser.</span>';
            return;
        }
        
        const disciplines = {
            gait: { name: 'Gangart (Islandske Heste)', color: '#fbbf24', posts: [] },
            dressage: { name: 'Dressur', color: '#60a5fa', posts: [] },
            jumping: { name: 'Springning', color: '#f87171', posts: [] }
        };
        
        window.activeCompetition.club_posts.forEach(p => {
            const disc = p.discipline || 'gait';
            if (disciplines[disc]) {
                disciplines[disc].posts.push(p);
            } else {
                disciplines.gait.posts.push(p);
            }
        });
        
        Object.keys(disciplines).forEach(key => {
            const group = disciplines[key];
            if (group.posts.length > 0) {
                const groupTitle = document.createElement('div');
                groupTitle.style.color = group.color;
                groupTitle.style.fontWeight = 'bold';
                groupTitle.style.fontSize = '0.8rem';
                groupTitle.style.marginTop = '0.5rem';
                groupTitle.innerText = group.name.toUpperCase();
                container.appendChild(groupTitle);
                
                group.posts.forEach(p => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.justifyContent = 'space-between';
                    row.style.gap = '1rem';
                    row.style.padding = '0.25rem 0';
                    row.innerHTML = `
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer; margin: 0; flex: 1;">
                            <input type="checkbox" class="rider-class-cb" value="${p.id}" style="width: auto; margin: 0;">
                            <span>${p.name}</span>
                        </label>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">Startnr:</span>
                            <input type="number" class="rider-class-start-num" data-post-id="${p.id}" style="width: 70px; padding: 0.25rem; font-size: 0.8rem; margin: 0;" placeholder="Valgfrit">
                        </div>
                    `;
                    container.appendChild(row);
                });
            }
        });
    };

    // --- BETALING & AKTIVERING HANDLERS ---
    window.openPaymentModal = function() {
        if (!window.activeCompetition) return;
        
        document.getElementById('pay-discount-code-input').value = '';
        document.getElementById('pay-discount-error').style.display = 'none';
        document.getElementById('pay-discount-success').style.display = 'none';
        document.getElementById('pay-discount-row').style.display = 'none';
        
        document.getElementById('pay-card-number').value = '';
        document.getElementById('pay-card-expiry').value = '';
        document.getElementById('pay-card-cvc').value = '';
        
        document.getElementById('pay-comp-name').innerText = window.activeCompetition.name;
        document.getElementById('pay-total-amount-label').innerText = '299,00';
        
        const cardSec = document.getElementById('pay-card-details-section');
        cardSec.style.display = 'block';
        document.getElementById('pay-card-number').setAttribute('required', 'required');
        document.getElementById('pay-card-expiry').setAttribute('required', 'required');
        document.getElementById('pay-card-cvc').setAttribute('required', 'required');
        
        document.getElementById('payment-modal').style.display = 'flex';
    };

    window.closePaymentModal = function() {
        document.getElementById('payment-modal').style.display = 'none';
    };

    window.applyDiscountCode = async function() {
        const codeInput = document.getElementById('pay-discount-code-input');
        const code = codeInput.value.trim().toUpperCase();
        const errLabel = document.getElementById('pay-discount-error');
        const succLabel = document.getElementById('pay-discount-success');
        const discountRow = document.getElementById('pay-discount-row');
        
        errLabel.style.display = 'none';
        succLabel.style.display = 'none';
        discountRow.style.display = 'none';
        
        if (!code) {
            errLabel.innerText = "Indtast venligst en rabatkode.";
            errLabel.style.display = 'block';
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/check-discount?code=${code}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (response.ok) {
                const data = await response.json();
                const discountPct = data.discount_amount;
                
                document.getElementById('pay-discount-pct-label').innerText = discountPct;
                
                const savings = 299.0 * (discountPct / 100.0);
                const total = 299.0 - savings;
                
                document.getElementById('pay-discount-amount-label').innerText = savings.toFixed(2).replace('.', ',');
                document.getElementById('pay-total-amount-label').innerText = total.toFixed(2).replace('.', ',');
                
                discountRow.style.display = 'flex';
                succLabel.style.display = 'block';
                
                const cardSec = document.getElementById('pay-card-details-section');
                if (discountPct >= 100) {
                    cardSec.style.display = 'none';
                    document.getElementById('pay-card-number').removeAttribute('required');
                    document.getElementById('pay-card-expiry').removeAttribute('required');
                    document.getElementById('pay-card-cvc').removeAttribute('required');
                } else {
                    cardSec.style.display = 'block';
                    document.getElementById('pay-card-number').setAttribute('required', 'required');
                    document.getElementById('pay-card-expiry').setAttribute('required', 'required');
                    document.getElementById('pay-card-cvc').setAttribute('required', 'required');
                }
            } else {
                const errorData = await response.json();
                errLabel.innerText = errorData.detail || "Rabatkoden er ugyldig.";
                errLabel.style.display = 'block';
            }
        } catch(err) {
            console.error(err);
            errLabel.innerText = "Der opstod en fejl under verifikation af koden.";
            errLabel.style.display = 'block';
        }
    };

    window.submitPayment = async function(event) {
        event.preventDefault();
        
        const codeInput = document.getElementById('pay-discount-code-input');
        const discountCode = codeInput.value.trim().toUpperCase() || null;
        const submitBtn = document.getElementById('pay-submit-btn');
        
        const oldHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Behandler...';
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        try {
            const response = await fetch(`${API_BASE}/clubs/${window.activeClubId}/competitions/${window.currentCompId}/activate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    discount_code: discountCode
                })
            });
            
            if (response.ok) {
                alert('Stævnet blev aktiveret med succes! Karakterafgivelse er nu låst op.');
                window.closePaymentModal();
                if (window.activeCompetition) {
                    window.openCompetition(window.currentCompId, window.activeCompetition.name);
                }
            } else {
                const errData = await response.json();
                alert('Aktivering fejlede: ' + (errData.detail || 'Ukendt fejl'));
                submitBtn.disabled = false;
                submitBtn.innerHTML = oldHtml;
            }
        } catch(err) {
            console.error(err);
            alert('Netværksfejl under aktivering.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = oldHtml;
        }
    };

    // --- SUPER ADMIN LOGIK ---
    window.showSaTab = function(saTab) {
        document.querySelectorAll('.sa-tab-btn').forEach(btn => {
            if (btn.id === `sa-tab-${saTab}-btn`) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        if (saTab === 'stats') {
            document.getElementById('sa-stats-section').style.display = 'block';
            document.getElementById('sa-discount-section').style.display = 'none';
            fetchSaStats();
        } else {
            document.getElementById('sa-stats-section').style.display = 'none';
            document.getElementById('sa-discount-section').style.display = 'block';
            fetchSaDiscounts();
        }
    };

    async function fetchSaStats() {
        try {
            const response = await fetch(`${API_BASE}/admin/stats`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (response.ok) {
                const data = await response.json();
                
                document.getElementById('sa-stat-clubs').innerText = data.total_clubs;
                document.getElementById('sa-stat-active-comps').innerText = data.active_competitions;
                document.getElementById('sa-stat-inactive-comps').innerText = data.inactive_competitions;
                document.getElementById('sa-stat-outdated-comps').innerText = data.outdated_inactive_competitions;
                
                const clubList = document.getElementById('sa-club-stats-list');
                clubList.innerHTML = '';
                data.club_stats.forEach(c => {
                    clubList.innerHTML += `
                        <tr style="border-bottom: 1px solid var(--glass-border);">
                            <td style="padding: 0.75rem;"><strong>${c.club_name}</strong></td>
                            <td style="padding: 0.75rem; color: var(--text-secondary);">${c.owner_email}</td>
                            <td style="padding: 0.75rem;">${c.created_count} stævner</td>
                            <td style="padding: 0.75rem; color: #10b981;">${c.active_count} aktive</td>
                        </tr>
                    `;
                });
                
                const compList = document.getElementById('sa-comp-stats-list');
                compList.innerHTML = '';
                data.competitions.forEach(c => {
                    const dateStr = c.date ? new Date(c.date).toLocaleDateString('da-DK') : 'Ingen dato';
                    const statusHtml = c.is_active 
                        ? '<span style="color: #10b981; background: rgba(16,185,129,0.1); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid rgba(16,185,129,0.2); font-size: 0.8rem;">Aktiv / Betalt</span>' 
                        : '<span style="color: #f43f5e; background: rgba(244,63,94,0.1); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid rgba(244,63,94,0.2); font-size: 0.8rem;">Inaktiv</span>';
                    
                    const pricePaidStr = c.price_paid !== null ? `${c.price_paid.toFixed(2).replace('.', ',')} DKK` : '-';
                    
                    compList.innerHTML += `
                        <tr style="border-bottom: 1px solid var(--glass-border);">
                            <td style="padding: 0.75rem;"><strong>${c.name}</strong></td>
                            <td style="padding: 0.75rem;">${c.club_name}</td>
                            <td style="padding: 0.75rem; color: var(--text-secondary);">${dateStr}</td>
                            <td style="padding: 0.75rem;">${statusHtml}</td>
                            <td style="padding: 0.75rem; font-weight: bold;">${pricePaidStr}</td>
                            <td style="padding: 0.75rem; text-align: right;">
                                <button class="btn btn-danger btn-sm" onclick="deleteCompAsAdmin(${c.id})" style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); padding: 0.25rem 0.5rem; font-size: 0.75rem;"><i class="fas fa-trash"></i> Slet</button>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch(err) {
            console.error('Error fetching admin stats:', err);
        }
    }

    async function fetchSaDiscounts() {
        try {
            const response = await fetch(`${API_BASE}/admin/discount-codes`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (response.ok) {
                const codes = await response.json();
                const list = document.getElementById('sa-discount-list');
                list.innerHTML = '';
                codes.forEach(d => {
                    list.innerHTML += `
                        <tr style="border-bottom: 1px solid var(--glass-border);">
                            <td style="padding: 0.75rem;"><strong style="letter-spacing: 1px;">${d.code}</strong></td>
                            <td style="padding: 0.75rem; color: #10b981; font-weight: bold;">${d.discount_amount}% rabat</td>
                            <td style="padding: 0.75rem;">
                                ${d.is_active ? '<span style="color: #10b981;">Aktiv</span>' : '<span style="color: var(--text-secondary);">Inaktiv</span>'}
                            </td>
                            <td style="padding: 0.75rem; text-align: right;">
                                <button class="btn btn-danger btn-sm" onclick="deleteDiscountCode(${d.id})" style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); padding: 0.25rem 0.5rem; font-size: 0.75rem;"><i class="fas fa-trash"></i> Slet</button>
                            </td>
                        </tr>
                    `;
                });
            }
        } catch(err) {
            console.error(err);
        }
    }

    document.getElementById('sa-discount-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('sa-discount-code').value.trim().toUpperCase();
        const pct = parseFloat(document.getElementById('sa-discount-pct').value);
        
        try {
            const response = await fetch(`${API_BASE}/admin/discount-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    code: code,
                    discount_amount: pct,
                    is_active: true
                })
            });
            if (response.ok) {
                document.getElementById('sa-discount-code').value = '';
                fetchSaDiscounts();
            } else {
                const errData = await response.json();
                alert('Kunne ikke oprette rabatkode: ' + (errData.detail || 'Fejl'));
            }
        } catch(err) {
            console.error(err);
            alert('Netværksfejl.');
        }
    });

    window.deleteDiscountCode = async function(id) {
        if (!confirm('Vil du slette denne rabatkode?')) return;
        try {
            const response = await fetch(`${API_BASE}/admin/discount-codes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (response.ok) {
                fetchSaDiscounts();
            } else {
                alert('Kunne ikke slette koden.');
            }
        } catch(err) {
            console.error(err);
        }
    };

    window.deleteCompAsAdmin = async function(id) {
        if (!confirm('Er du sikker på, at du vil slette dette stævne som Super Admin? Dette vil permanent slette alt stævnets data og kan ikke fortrydes!')) return;
        try {
            const response = await fetch(`${API_BASE}/admin/competitions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (response.ok) {
                fetchSaStats();
            } else {
                alert('Kunne ikke slette stævnet.');
            }
        } catch(err) {
            console.error(err);
        }
    };

    // Initialize dropdown options on load
    window.updateClubPostScoringMethodOptions();
});
