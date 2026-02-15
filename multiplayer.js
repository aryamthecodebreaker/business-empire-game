// Multiplayer state machine, UI, realtime subscriptions

const mpState = {
    connected: false,
    playerId: null,
    playerName: null,
    token: null,
    cityId: null,
    cityName: null,
    cityWeather: null,
    cityEconomyHealth: 1.0,
    cityAvgPrice: 1.0,
    cityJoinCode: null,
    competitorPrices: [],
    cityPlayerCount: 0,
    cityRank: null,
    dailyChallenges: [],
    cityFeed: [],
    chatMessages: [],
    mode: 'solo', // 'solo' | 'city'
    currentLeaderboard: { type: 'alltime', metric: 'revenue' },
    citySubscription: null
};

// ═══════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════

async function initMultiplayer() {
    const connected = await api.init();
    mpState.connected = connected;

    if (connected) {
        addLog('MP', '\uD83C\uDF10 Connected to multiplayer server');
        // Restore city if player was in one before reload
        if (mpState.mode === 'city' && mpState.cityId) {
            addLog('MP', '\uD83C\uDFD9\uFE0F Restored city: ' + mpState.cityName);
            mpState.citySubscription = api.subscribeToCityFeed(mpState.cityId, handleCityEvent);
            const messages = await api.fetchChatMessages(mpState.cityId);
            mpState.chatMessages = messages;
        }
        // Load initial leaderboard
        refreshLeaderboard();
        // Load daily challenges
        loadDailyChallenges();
    } else {
        addLog('MP', '\uD83C\uDF10 Playing in offline mode');
    }

    updateMultiplayerUI();
}

// ═══════════════════════════════════════════════════
//  LEADERBOARD
// ═══════════════════════════════════════════════════

async function refreshLeaderboard() {
    if (!mpState.connected) return;

    const entries = await api.fetchLeaderboard(
        mpState.currentLeaderboard.type,
        mpState.currentLeaderboard.metric,
        50
    );

    renderLeaderboard(entries);
}

function switchLeaderboardTab(type, metric) {
    mpState.currentLeaderboard = { type: type, metric: metric };
    // Update active tab styling
    document.querySelectorAll('.lb-tab').forEach(function(btn) {
        btn.classList.remove('active');
    });
    if (event && event.target) event.target.classList.add('active');
    refreshLeaderboard();
}

function renderLeaderboard(entries) {
    const container = document.getElementById('leaderboardBody');
    if (!container) return;

    if (entries.length === 0) {
        container.innerHTML = '<tr><td colspan="3" style="text-align:center; color: #0a0; padding: 1rem;">No entries yet. Play a day to appear!</td></tr>';
        return;
    }

    let html = '';
    entries.forEach(function(entry) {
        const rankClass = entry.rank <= 3 ? ' rank-' + entry.rank : '';
        const youClass = entry.isYou ? ' you' : '';
        const marker = entry.isYou ? ' \u25C0 YOU' : '';
        const medal = entry.rank === 1 ? '\uD83E\uDD47' : entry.rank === 2 ? '\uD83E\uDD48' : entry.rank === 3 ? '\uD83E\uDD49' : '#' + entry.rank;

        html += '<tr class="' + rankClass + youClass + '">' +
            '<td>' + medal + '</td>' +
            '<td>' + entry.playerName + marker + '</td>' +
            '<td style="text-align:right;">$' + Number(entry.score).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</td>' +
        '</tr>';
    });

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════
//  CITY
// ═══════════════════════════════════════════════════

async function joinCity() {
    if (!mpState.connected) {
        showNotif('Not connected to server', 'error');
        return;
    }

    showNotif('Finding a city...', 'success');
    const city = await api.joinCity();

    if (city) {
        addLog('CITY', '\uD83C\uDFD9\uFE0F Joined city: ' + mpState.cityName);
        showNotif('Joined ' + mpState.cityName + '!', 'success');

        // Subscribe to city events
        mpState.citySubscription = api.subscribeToCityFeed(mpState.cityId, handleCityEvent);

        // Load chat
        const messages = await api.fetchChatMessages(mpState.cityId);
        mpState.chatMessages = messages;

        updateMultiplayerUI();
    } else {
        showNotif('Failed to join city', 'error');
    }
}

async function createPrivateCity() {
    if (!mpState.connected) { showNotif('Not connected to server', 'error'); return; }
    if (mpState.mode === 'city') { showNotif('Leave your current city first!', 'error'); return; }
    showNotif('Creating private city\u2026', 'success');
    const city = await api.createPrivateCity();
    if (city) {
        addLog('CITY', '\uD83C\uDFD9\uFE0F Created private city: ' + city.name + ' [Code: ' + city.join_code + ']');
        showNotif('City created! Code: ' + city.join_code, 'success');
        mpState.citySubscription = api.subscribeToCityFeed(mpState.cityId, handleCityEvent);
        updateMultiplayerUI();
    } else {
        showNotif('Failed to create city', 'error');
    }
}

async function joinCityWithCode() {
    if (!mpState.connected) {
        showNotif('Not connected to server', 'error');
        return;
    }
    const input = document.getElementById('joinCodeInput');
    const code = input ? input.value.trim().toUpperCase() : '';
    if (!code || code.length !== 6) {
        showNotif('Enter a 6-character city code!', 'error');
        return;
    }
    showNotif('Joining city...', 'success');
    const city = await api.joinCityByCode(code);
    if (city) {
        addLog('CITY', '\uD83C\uDFD9\uFE0F Joined city via code: ' + city.name);
        showNotif('Joined ' + city.name + '!', 'success');
        mpState.citySubscription = api.subscribeToCityFeed(mpState.cityId, handleCityEvent);
        const messages = await api.fetchChatMessages(mpState.cityId);
        mpState.chatMessages = messages;
        if (input) input.value = '';
        updateMultiplayerUI();
    } else {
        showNotif('\u274C City code not found!', 'error');
    }
}

function copyCityCode() {
    const code = mpState.cityJoinCode || '------';
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function() {
            showNotif('\uD83D\uDCCB Code copied: ' + code, 'success');
        });
    } else {
        showNotif('Code: ' + code, 'success');
    }
}

async function leaveCity() {
    await api.leaveCity();
    if (mpState.citySubscription) {
        api.unsubscribeAll();
        mpState.citySubscription = null;
    }
    mpState.cityFeed = [];
    mpState.chatMessages = [];
    addLog('CITY', '\uD83C\uDFD9\uFE0F Left city');
    showNotif('Left city', 'warning');
    updateMultiplayerUI();
}

function handleCityEvent(event) {
    switch (event.type) {
        case 'day_complete':
            const result = event.data;
            mpState.cityFeed.unshift({
                text: (result.player_name || 'A player') + ' earned $' + Number(result.revenue || 0).toFixed(2) + ' (Day ' + result.day_number + ')',
                time: new Date().toLocaleTimeString()
            });
            if (mpState.cityFeed.length > 50) mpState.cityFeed.pop();
            renderCityFeed();
            break;

        case 'city_update':
            const city = event.data;
            mpState.cityWeather = city.weather;
            mpState.cityEconomyHealth = city.economic_health;
            mpState.cityAvgPrice = city.avg_price;
            mpState.cityPlayerCount = city.total_businesses;
            updateCityInfoPanel();
            break;

        case 'chat':
            const msg = event.data;
            mpState.chatMessages.push(msg);
            if (mpState.chatMessages.length > 100) mpState.chatMessages.shift();
            renderChatMessages();
            break;
    }
}

// ═══════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════

let _lastChatSend = 0;

function sendChat() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg || !mpState.cityId) return;

    // Rate limit: 1 message per 5 seconds
    if (Date.now() - _lastChatSend < 5000) {
        showNotif('Chat cooldown (5s)', 'warning');
        return;
    }

    api.sendChatMessage(mpState.cityId, msg);
    input.value = '';
    _lastChatSend = Date.now();
}

function sendQuickChat(msg) {
    if (!mpState.cityId) return;
    if (Date.now() - _lastChatSend < 5000) {
        showNotif('Chat cooldown (5s)', 'warning');
        return;
    }
    api.sendChatMessage(mpState.cityId, msg);
    _lastChatSend = Date.now();
}

function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    let html = '';
    mpState.chatMessages.forEach(function(msg) {
        html += '<div class="chat-msg">' +
            '<span class="sender">[' + (msg.player_name || '???') + ']</span> ' +
            '<span class="text">' + escapeHtml(msg.message) + '</span>' +
        '</div>';
    });

    container.innerHTML = html || '<div style="color: #0a0; padding: 0.5rem;">No messages yet...</div>';
    container.scrollTop = container.scrollHeight;
}

// ═══════════════════════════════════════════════════
//  DAILY CHALLENGES
// ═══════════════════════════════════════════════════

async function loadDailyChallenges() {
    mpState.dailyChallenges = await api.fetchDailyChallenges();
    renderChallenges();
}

function renderChallenges() {
    const container = document.getElementById('challengesList');
    if (!container) return;

    if (mpState.dailyChallenges.length === 0) {
        container.innerHTML = '<div style="color: #0a0; padding: 1rem;">No challenges today. Play more to unlock!</div>';
        return;
    }

    let html = '';
    mpState.dailyChallenges.forEach(function(ch) {
        html += '<div class="challenge-card">' +
            '<div class="challenge-title">\uD83C\uDFAF ' + ch.title + '</div>' +
            '<div class="challenge-desc">' + ch.description + '</div>' +
            '<div class="challenge-reward">\uD83C\uDFC6 Reward: $' + Number(ch.reward_value || 0).toFixed(0) + ' bonus</div>' +
        '</div>';
    });

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════
//  CITY FEED
// ═══════════════════════════════════════════════════

function renderCityFeed() {
    const container = document.getElementById('cityFeed');
    if (!container) return;

    if (mpState.cityFeed.length === 0) {
        container.innerHTML = '<div style="color: #0a0; padding: 0.5rem;">Waiting for activity...</div>';
        return;
    }

    let html = '';
    mpState.cityFeed.forEach(function(entry) {
        html += '<div class="feed-entry">' +
            '<span class="time">[' + entry.time + ']</span> ' +
            entry.text +
        '</div>';
    });

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════
//  CITY INFO PANEL
// ═══════════════════════════════════════════════════

function updateCityInfoPanel() {
    const el = document.getElementById('cityInfoContent');
    if (!el || !mpState.cityId) return;

    const economyLabel = mpState.cityEconomyHealth > 1.1 ? 'BOOMING' :
                         mpState.cityEconomyHealth < 0.9 ? 'RECESSION' : 'STABLE';
    const economyColor = mpState.cityEconomyHealth > 1.1 ? '#0f0' :
                         mpState.cityEconomyHealth < 0.9 ? '#f00' : '#ff0';

    el.innerHTML = '<div class="city-stats">' +
        '<div class="city-stat"><div class="label">WEATHER</div><div class="value">' + (mpState.cityWeather ? WEATHER[mpState.cityWeather].icon + ' ' + WEATHER[mpState.cityWeather].name : '---') + '</div></div>' +
        '<div class="city-stat"><div class="label">PLAYERS</div><div class="value">' + (mpState.cityPlayerCount || 0) + '</div></div>' +
        '<div class="city-stat"><div class="label">ECONOMY</div><div class="value" style="color:' + economyColor + '">' + economyLabel + '</div></div>' +
        '<div class="city-stat"><div class="label">AVG PRICE</div><div class="value">$' + Number(mpState.cityAvgPrice || 0).toFixed(2) + '</div></div>' +
    '</div>' +
    '<div style="margin-top:0.75rem; padding:0.5rem; border:1px solid #ff0; background:rgba(255,255,0,0.05); display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">' +
        '<span style="color:#ff0; font-size:0.85rem;">\uD83D\uDD11 INVITE CODE:</span>' +
        '<strong style="color:#0ff; font-size:1.1rem; letter-spacing:3px;">' + (mpState.cityJoinCode || '------') + '</strong>' +
        '<button onclick="copyCityCode()" style="width:auto; padding:0.2rem 0.6rem; font-size:0.7rem; margin:0; border-color:#ff0; color:#ff0;">\uD83D\uDCCB COPY</button>' +
        '<span style="color:#0a0; font-size:0.75rem;">Share with friends!</span>' +
    '</div>';

    // Price ticker
    const tickerEl = document.getElementById('priceTicker');
    if (tickerEl && mpState.competitorPrices.length > 0) {
        const prices = mpState.competitorPrices;
        const low = Math.min.apply(null, prices);
        const high = Math.max.apply(null, prices);
        const avg = prices.reduce(function(s, p) { return s + p; }, 0) / prices.length;

        tickerEl.innerHTML = '<div class="ticker-row"><span>City Avg:</span><span style="color:#0ff">$' + avg.toFixed(2) + '</span></div>' +
            '<div class="ticker-row"><span>Lowest:</span><span style="color:#0f0">$' + low.toFixed(2) + '</span></div>' +
            '<div class="ticker-row"><span>Highest:</span><span style="color:#f00">$' + high.toFixed(2) + '</span></div>' +
            '<div class="ticker-row"><span>Your Price:</span><span style="color:#ff0">$' + game.price.toFixed(2) + '</span></div>';
        tickerEl.classList.remove('hidden');
    }
}

// ═══════════════════════════════════════════════════
//  MAIN UI UPDATE
// ═══════════════════════════════════════════════════

function updateMultiplayerUI() {
    // Status indicator
    const statusEl = document.getElementById('mpStatus');
    if (statusEl) {
        if (mpState.connected) {
            statusEl.className = 'mp-status online';
            statusEl.innerHTML = '<span class="mp-status-dot"></span> ONLINE' + (mpState.mode === 'city' ? ' \u2022 ' + mpState.cityName : '');
        } else {
            statusEl.className = 'mp-status offline';
            statusEl.innerHTML = '<span class="mp-status-dot"></span> OFFLINE';
        }
    }

    // City section visibility
    const citySection = document.getElementById('citySection');
    const joinBtn = document.getElementById('joinCityBtn');
    const leaveBtn = document.getElementById('leaveCityBtn');

    // Hide join code input when in a city
    const codeRow = document.getElementById('joinCodeRow');
    if (codeRow) {
        codeRow.style.display = (mpState.mode === 'city') ? 'none' : '';
    }

    if (citySection) {
        if (mpState.mode === 'city' && mpState.cityId) {
            citySection.classList.remove('hidden');
            const nameDisplay = document.getElementById('cityNameDisplay');
            if (nameDisplay) nameDisplay.textContent = mpState.cityName || 'City';
            if (joinBtn) joinBtn.classList.add('hidden');
            if (leaveBtn) leaveBtn.classList.remove('hidden');
            updateCityInfoPanel();
            renderCityFeed();
            renderChatMessages();
        } else {
            citySection.classList.add('hidden');
            if (joinBtn) joinBtn.classList.remove('hidden');
            if (leaveBtn) leaveBtn.classList.add('hidden');
        }
    }
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
