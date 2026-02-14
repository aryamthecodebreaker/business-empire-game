// Visual effects — floating text, notifications, button juice

function showNotif(msg, type = 'success') {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.className = 'notification';
    if (type === 'warning') el.classList.add('warning');
    if (type === 'error') el.classList.add('error');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function showFloatingText(text, x, y, color = '#0f0') {
    const floating = document.createElement('div');
    floating.className = 'floating-text';
    floating.textContent = text;
    floating.style.color = color;
    floating.style.left = x + 'px';
    floating.style.top = y + 'px';
    document.body.appendChild(floating);
    setTimeout(() => floating.remove(), 1500);
}

function showFloatingAtClick(event, text, color = '#0f0') {
    showFloatingText(text, event.clientX, event.clientY, color);
}

function shakeButton(buttonId) {
    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.classList.add('shake');
        setTimeout(() => btn.classList.remove('shake'), 500);
    }
}
