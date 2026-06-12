// popup.js - MV3 Popup Script for NovaSnap

document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', async () => {
        const action = el.getAttribute('data-action');
        
        // Find the last focused normal/popup window (the one behind this popup)
        // We exclude 'app' and 'devtools' to be safe.
        const wt = {"windowTypes": ["normal", "popup"]};
        try {
            const win = await chrome.windows.getLastFocused(wt);
            if (win) {
                // Pass the specific window ID to the background
                chrome.runtime.sendMessage({ action: action, windowId: win.id });
            }
        } catch (e) {
            console.error("Failed to get window in popup:", e);
        }
        window.close();
    });
});

document.getElementById('open-options').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        window.open(chrome.runtime.getURL('options.html'));
    }
});
