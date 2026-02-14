// Entry point — init, event binding, module wiring

function init() {
    loadGame();
    updateUI();
    if (typeof updateLocationsList === 'function') { updateLocationsList(); }

    // Show welcome modal for first-time players
    if (!localStorage.getItem('hasPlayedBefore')) {
        setTimeout(function() {
            document.getElementById('welcomeModal').classList.remove('hidden');
        }, 500);
    }

    addLog('SYSTEM', '\u2588\u2593\u2592\u2591 BUSINESS EMPIRE SIMULATOR \u2591\u2592\u2593\u2588');
    addLog('INFO', 'Start with $5. Build your empire! \uD83D\uDE80');
    addLog('WARNING', '\u26A0\uFE0F Random catastrophes can happen!');

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
