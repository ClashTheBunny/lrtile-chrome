// Copyright 2019 Google LLC
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// NovaSnap - Manifest V3 Service Worker

let nsOptions = { on: 1, border: 2, logLevel: 0 };
let nsDisplays = [];

// Cycle state for subsequent keypresses
let lastAction = null;
let lastWindowId = null;
let lastActionTime = 0;
let cycleIndex = 0;
const CYCLE_TIMEOUT = 1000; // 1 second timeout to cycle layouts

// printf-like logging, no deep object print
function L(level, ...args) {
    if (level <= nsOptions.logLevel) {
        console.log(PF(...args));
    }
}

// simplified printf
function PF() {
    let n = arguments.length, res = arguments[0];
    for (let i = 1; i < n; i++) {
        res = res.replace(/%[dus]/, arguments[i]);
    }
    return res;
}

// Returns the display area that contains the center of the window.
function getDisplayArea(win) {
    if (!win) return null;
    
    // Calculate window center
    const cX = win.left + Math.floor(win.width / 2);
    const cY = win.top + Math.floor(win.height / 2);
    
    for (let i = 0; i < nsDisplays.length; i++) {
        const d = nsDisplays[i].workArea;
        if (cX >= d.left && cX < d.left + d.width &&
            cY >= d.top && cY < d.top + d.height) {
            return [ d.left, d.top, d.width, d.height ];
        }
    }
    // Fallback to first display if not found
    if (nsDisplays.length > 0) {
        const d = nsDisplays[0].workArea;
        return [ d.left, d.top, d.width, d.height ];
    }
    return null;
}

// Handler for the various commands.
async function doCmd(cmd, win) {
    let triggeredViaShortcut = false;
    // 1. Ensure we have the active window.
    if (!win) {
        triggeredViaShortcut = true;
        const wt = {"windowTypes": ["normal", "popup"]};
        try {
            win = await chrome.windows.getLastFocused(wt);
        } catch (e) {
            L(0, "Failed to get last focused window: %s", e);
            return;
        }
    }
    if (!win) return L(0, "no window, nothing to do");

    // Safety check: If triggered via a global keyboard shortcut,
    // ensure the target Chrome window actually has system focus.
    // This prevents accidentally moving background Chrome windows
    // when the user is currently working in a Linux app or another user's window.
    if (triggeredViaShortcut && !win.focused) {
        L(0, "Chrome window is not active system-wide, aborting to prevent background movement");
        return;
    }

    try {
        // 2. Fetch options and display info ON-DEMAND.
        const [options, displays] = await Promise.all([
            chrome.storage.local.get(null),
            chrome.system.display.getInfo()
        ]);

        if (options && Object.keys(options).length > 0) {
            nsOptions = { ...nsOptions, ...options };
        }
        nsDisplays = displays;

        if (!nsOptions.on) return;
        
        let [wX, wY, wW, wH] = [ win.left, win.top, win.width, win.height ];
        L(0, "CMD %s window %dx%d@%d,%d type %s id %s",
          cmd, wW, wH, wX, wY, win.type, win.id);

        const displayArea = getDisplayArea(win);
        if (!displayArea) return L(0, "no display area found");
        const [mX, mY, mW, mH] = displayArea;
        
        const border = parseInt(nsOptions.border) || 0;
        
        let newX = wX, newY = wY, newW = wW, newH = wH;
        
        // Normalize command name (remove prefix like "01-")
        const action = cmd.replace(/^[0-9]+-/, '');
        
        // Calculate cycle index
        const now = Date.now();
        if (action === lastAction && win.id === lastWindowId && (now - lastActionTime) < CYCLE_TIMEOUT) {
            cycleIndex = (cycleIndex + 1) % 3; // Cycle through 3 sizes: 1/2 -> 1/3 -> 2/3
        } else {
            cycleIndex = 0;
        }
        
        lastAction = action;
        lastWindowId = win.id;
        lastActionTime = now;

        // Helper dimensions
        const oneHalfW = Math.floor(mW / 2);
        const oneThirdW = Math.floor(mW / 3);
        const twoThirdsW = Math.floor(mW * 2 / 3);
        
        const oneHalfH = Math.floor(mH / 2);
        const oneThirdH = Math.floor(mH / 3);
        const twoThirdsH = Math.floor(mH * 2 / 3);

        switch (action) {
        case 'ns-left-half':
            newX = mX;
            newY = mY;
            newH = mH - border;
            if (cycleIndex === 0) {
                newW = oneHalfW - border;
            } else if (cycleIndex === 1) {
                newW = oneThirdW - border;
            } else { // 2
                newW = twoThirdsW - border;
            }
            break;
            
        case 'ns-right-half':
            newY = mY;
            newH = mH - border;
            if (cycleIndex === 0) {
                newX = mX + oneHalfW;
                newW = oneHalfW - border;
            } else if (cycleIndex === 1) {
                newX = mX + twoThirdsW; // occupies right 1/3
                newW = oneThirdW - border;
            } else { // 2
                newX = mX + oneThirdW; // occupies right 2/3
                newW = twoThirdsW - border;
            }
            break;
            
        case 'ns-top-half':
            newX = mX;
            newW = mW - border;
            if (cycleIndex === 0) {
                newY = mY;
                newH = oneHalfH - border;
            } else if (cycleIndex === 1) {
                newY = mY;
                newH = oneThirdH - border;
            } else { // 2
                newY = mY;
                newH = twoThirdsH - border;
            }
            break;
            
        case 'ns-bottom-half':
            newX = mX;
            newW = mW - border;
            if (cycleIndex === 0) {
                newY = mY + oneHalfH;
                newH = oneHalfH - border;
            } else if (cycleIndex === 1) {
                newY = mY + twoThirdsH; // occupies bottom 1/3
                newH = oneThirdH - border;
            } else { // 2
                newY = mY + oneThirdH; // occupies bottom 2/3
                newH = twoThirdsH - border;
            }
            break;

        case 'ns-top-left':
            newX = mX;
            newY = mY;
            newW = oneHalfW - border;
            newH = oneHalfH - border;
            break;
        case 'ns-top-right':
            newX = mX + oneHalfW;
            newY = mY;
            newW = oneHalfW - border;
            newH = oneHalfH - border;
            break;
        case 'ns-bottom-left':
            newX = mX;
            newY = mY + oneHalfH;
            newW = oneHalfW - border;
            newH = oneHalfH - border;
            break;
        case 'ns-bottom-right':
            newX = mX + oneHalfW;
            newY = mY + oneHalfH;
            newW = oneHalfW - border;
            newH = oneHalfH - border;
            break;
            
        case 'ns-maximize':
            newX = mX;
            newY = mY;
            newW = mW - border;
            newH = mH - border;
            break;
        case 'ns-center':
            newX = mX + Math.floor((mW - wW) / 2);
            newY = mY + Math.floor((mH - wH) / 2);
            break;
        default:
            L(0, "unrecognized command %s", cmd);
            return;
        }

        // Ensure window is in "normal" state to allow moving/resizing
        if (win.state !== "normal" && win.state !== "maximized") {
            await chrome.windows.update(win.id, { state: "normal" });
            await chrome.windows.update(win.id, { left: newX, top: newY, width: newW, height: newH });
        } else {
            await chrome.windows.update(win.id, { state: "normal", left: newX, top: newY, width: newW, height: newH });
        }
    } catch (err) {
        console.error("Error in doCmd:", err);
    }
}

// Listen for messages from popup or options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.update) {
        chrome.storage.local.get(null, options => {
            if (options) nsOptions = { ...nsOptions, ...options };
        });
    } else if (request.action) {
        if (request.windowId) {
            // Get the specific window requested by the popup
            chrome.windows.get(request.windowId, win => {
                if (win) doCmd(request.action, win);
            });
        } else {
            doCmd(request.action);
        }
    }
});

// Listen for keyboard commands
chrome.commands.onCommand.addListener(cmd => {
    doCmd(cmd);
});





