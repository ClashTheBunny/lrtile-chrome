// options.js - MV3 Options Script for NovaSnap

let nsOptions = { on: 1, border: 2, logLevel: 0 };

function g(id) { return document.getElementById(id); }

function clGet(entry, fn) {
    chrome.storage.local.get(entry, ret => {
        fn(ret);
    });
}

function openKeyConfig() {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
}

function initOptionsPage() {
    // Build a <table> with current key mappings and link to update
    chrome.commands.getAll(function(commands) {
	const change = "<a id='set_keys' href='#'>(change)</a>";
	let t = "<tr><th>Action</th><th>Key " + change + "</th></tr>";
	commands.forEach(cmd => {
	    const val = cmd.shortcut ? cmd.shortcut.replace(" Arrow","") : "Not set";
            const action = cmd.name.replace(/^[0-9]+-/, '');
            const iconClass = action.replace('ns-', ''); // e.g. "left-half"
            
            const iconHtml = `<div class="action-cell">
                <div class="mini-icon ${iconClass}"><div class="mini-fill"></div></div>
                <span>${cmd.description}</span>
            </div>`;
            
	    t += "<tr><td>" + iconHtml + "</td><td>" + val + "</td></tr>";
	});
	g('keys').innerHTML = '<table>' + t + '</table>';
	g('set_keys').addEventListener('click', openKeyConfig);
    });

    // restore input fields from local storage.
    clGet(nsOptions, ret => {
        if (ret) {
            nsOptions = { ...nsOptions, ...ret };
            g('on').checked = nsOptions.on;
            if (g('border')) g('border').value = nsOptions.border;
        }
    });

    const doSave = (ev) => {
	nsOptions.on = g('on').checked;
        if (g('border')) nsOptions.border = g('border').value;
	console.log("--- Saved values", nsOptions);
	chrome.storage.local.set(nsOptions, () => {
            // Notify background service worker to reload options
            chrome.runtime.sendMessage({"update": true});
            window.close();
        });
    };
    g('save').addEventListener('click', doSave);
}

document.addEventListener('DOMContentLoaded', initOptionsPage);
