// Entry point — init, event binding, module wiring

function selectMode(mode) {
    const screen = document.getElementById('modeSelectScreen');
    if (screen) screen.style.display = 'none';
    localStorage.setItem('preferredMode', mode);
    if (mode === 'online') {
        setTimeout(function() { switchTab('multiplayer'); }, 300);
    }
}

function init() {
    loadGame();
    updateUI();
    if (typeof updateLocationsList === 'function') { updateLocationsList(); }

    // Show mode selection screen on first visit (or if preference not set)
    const modeScreen = document.getElementById('modeSelectScreen');
    if (modeScreen) {
        if (!localStorage.getItem('preferredMode')) {
            modeScreen.style.display = 'flex';
        } else {
            modeScreen.style.display = 'none';
            // If user previously chose online, switch to multiplayer tab
            if (localStorage.getItem('preferredMode') === 'online') {
                setTimeout(function() { switchTab('multiplayer'); }, 300);
            }
        }
    }

    // Show welcome modal for first-time players (after mode screen is dismissed)
    if (!localStorage.getItem('hasPlayedBefore') && !localStorage.getItem('preferredMode')) {
        setTimeout(function() {
            document.getElementById('welcomeModal').classList.remove('hidden');
        }, 500);
    }

    addLog('SYSTEM', '█▓▒░ BUSINESS EMPIRE SIMULATOR ░▒▓█');
    addLog('INFO', 'Start with $5. Build your empire! 🚀');
    addLog('WARNING', '⚠️ Random catastrophes can happen!');

    // Attach click handlers explicitly
    const nameEl = document.getElementById('businessName');
    if (nameEl) {
        nameEl.style.cursor = 'pointer';
        nameEl.addEventListener('click', function() {
            window.editName();
        });
    }

    // Tab click handlers
    document.querySelectorAll('.tab-button[data-tab]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    // Chat enter key
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendChat();
        });
    }

    // Initialize multiplayer (async, doesn't block game)
    initMultiplayer();
}

window.onload = init;
