// ===== FILE: js/components/header.js =====
import * as state from '../state.js';
import { showNotification } from './notification.js';
import { updateInputUIForModel } from './chatInput.js';
// <<< MODIFIED: Import openSettings and updateSettingsModalSelect ONCE >>>
import { openSettings, updateSettingsModalSelect } from './settingsModal.js';
import { signInWithGoogle, signOutUser } from '../auth.js';
import { getCurrentUser } from '../state.js';

// --- DOM Elements ---
const headerModelSelectElement = document.getElementById('headerModelSelect'); // Default model selector
const activeGptDisplayElement = document.getElementById('activeGptDisplay'); // Span for active GPT name
const headerSettingsBtnElement = document.getElementById('headerSettingsBtn');

let loginButton;
let headerSettingsButton;
let headerNewChatButton;

// --- Header Logic ---

/**
 * Handles changes in the header *default* model select dropdown.
 * This only changes the setting used when NO custom GPT is active.
 */
function handleHeaderModelChange(event) {
    const newDefaultModel = event.target.value;
    console.log(`Header DEFAULT model selection changed to: ${newDefaultModel}`);

    const currentApiKey = state.getApiKey();
    const currentTtsInstructions = state.getTtsInstructions();
    const currentGeminiApiKey = state.getGeminiApiKey(); // Get current Gemini API key
    const currentXaiApiKey = state.getXaiApiKey(); // Get current X.AI API key

    state.saveSettings(currentApiKey, newDefaultModel, currentTtsInstructions, currentGeminiApiKey, currentXaiApiKey);

    if (!state.getActiveCustomGptConfig()) {
        updateInputUIForModel();
    }

    updateSettingsModalSelect(newDefaultModel);
}

/**
 * Updates the header dropdown's selected value (for the *default* model).
 * Called from settingsModal when the *default* model is changed there.
 * @param {string} newModelValue - The new default model value (e.g., 'gpt-4o').
 */
export function updateHeaderModelSelect(newModelValue) {
    if (headerModelSelectElement) {
        headerModelSelectElement.value = newModelValue;
        console.log(`Header default model dropdown synchronized to: ${newModelValue}`);
    }
}

/**
 * Updates the display in the header to show the active Custom GPT name
 * or the default model selector.
 */
export function updateActiveGptDisplay() {
    if (!activeGptDisplayElement || !headerModelSelectElement) {
        console.error("Header display elements not found.");
        return;
    }

    const activeGpt = state.getActiveCustomGptConfig();

    if (activeGpt) {
        // A Custom GPT is active
        activeGptDisplayElement.textContent = ` / ${activeGpt.name}`; // Prepend with '/' for visual separation
        activeGptDisplayElement.title = activeGpt.description || activeGpt.name; // Tooltip
        activeGptDisplayElement.style.display = 'inline'; // Show the name
        headerModelSelectElement.style.display = 'inline';
        console.log(`Header updated: Active Custom GPT "${activeGpt.name}"`);

        // Determine the correct model string for UI update (should usually be gpt-4o for custom GPTs)
        const effectiveModelForUI = 'gpt-4o'; // Assume custom GPTs use gpt-4o features
        updateInputUIForModel(effectiveModelForUI); // Pass the model string

    } else {
        // No Custom GPT active - show default model selector
        activeGptDisplayElement.textContent = '';
        activeGptDisplayElement.style.display = 'none'; // Hide the span
        headerModelSelectElement.style.display = 'inline-block'; // Ensure default selector is visible
        console.log("Header updated: No active Custom GPT.");

        // Update input UI based on the actual *default* model selected
        updateInputUIForModel(state.getSelectedModelSetting()); // Pass the default model string
    }
    // <<< REMOVED Duplicate code block from here >>>
}


// --- Initialization ---

/**
 * Initialize header component
 */
export function initializeHeader() {
    // Get header elements
    loginButton = document.getElementById('loginBtn');
    headerSettingsButton = document.getElementById('headerSettingsBtn');
    headerNewChatButton = document.getElementById('headerNewChatBtn');

    // Attach event listeners
    if (loginButton) {
        loginButton.addEventListener('click', handleAuthClick);
    }

    // Initialize other header buttons
    if (headerSettingsButton) {
        headerSettingsButton.addEventListener('click', () => {
            // Trigger settings modal
            document.getElementById('settingsModal').style.display = 'block';
        });
    }

    if (headerNewChatButton) {
        headerNewChatButton.addEventListener('click', () => {
            // Trigger new chat creation
            document.getElementById('newChatBtn').click();
        });
    }

    // Initialize Default Model Selector
    if (headerModelSelectElement) {
        const currentDefaultModel = state.getSelectedModelSetting();
        headerModelSelectElement.value = currentDefaultModel;
        headerModelSelectElement.addEventListener('change', handleHeaderModelChange);
        console.log("Header default model selector initialized.");
    } else {
        console.error("Header default model select element ('headerModelSelect') not found.");
    }

    // Initialize Active GPT Display Area
    if (!activeGptDisplayElement) {
        console.error("Active GPT display element ('activeGptDisplay') not found.");
    }

    // Set initial header state based on whether a GPT is active
    updateActiveGptDisplay();

    // Add listeners for other header buttons if they become interactive later
    const headerNewChatBtn = document.getElementById('headerNewChatBtn');
    if (headerNewChatBtn) {
        const sidebarNewChatBtn = document.getElementById('newChatBtn');
        if (sidebarNewChatBtn) {
            headerNewChatBtn.addEventListener('click', () => sidebarNewChatBtn.click());
        } else {
            console.error("Sidebar new chat button not found for header button proxy.");
        }
    }
    console.log("Header Initialized.");
}

/**
 * Handle authentication button click
 */
async function handleAuthClick() {
    const user = getCurrentUser();
    try {
        if (user) {
            await signOutUser();
        } else {
            await signInWithGoogle();
        }
    } catch (error) {
        console.error('Authentication error:', error);
        // Show error notification
        window.showNotification(
            error.message || 'Authentication failed. Please try again.',
            'error'
        );
    }
}

/**
 * Update header UI based on authentication state
 * @param {Object} user - Firebase user object
 */
export function updateAuthUI(user) {
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const userProfileDisplay = document.getElementById('userProfileDisplay');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (user) {
        // Update login button to show logout
        loginBtnText.textContent = 'Logout';
        loginBtn.title = 'Logout';

        // Show user profile
        userProfileDisplay.style.display = 'flex';
        userAvatar.src = user.photoURL || 'assets/default-avatar.png';
        userName.textContent = user.displayName || user.email;

        // Enable header buttons
        if (headerSettingsButton) headerSettingsButton.disabled = false;
        if (headerNewChatButton) headerNewChatButton.disabled = false;
    } else {
        // Reset to login state
        loginBtnText.textContent = 'Login';
        loginBtn.title = 'Login with Google';

        // Hide user profile
        userProfileDisplay.style.display = 'none';
        userAvatar.src = '';
        userName.textContent = '';

        // Disable header buttons
        if (headerSettingsButton) headerSettingsButton.disabled = true;
        if (headerNewChatButton) headerNewChatButton.disabled = true;
    }
}

/**
 * Update model selector in header
 * @param {string} model - Selected model name
 */
export function updateModelSelector(model) {
    const modelSelect = document.getElementById('headerModelSelect');
    if (modelSelect && model) {
        modelSelect.value = model;
    }
}

/**
 * Get the currently selected model from the header
 * @returns {string} Selected model name
 */
export function getSelectedModel() {
    const modelSelect = document.getElementById('headerModelSelect');
    return modelSelect ? modelSelect.value : null;
}