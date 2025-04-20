// ===== FILE: ui.js =====
/**
 * Update UI elements based on authentication state
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
        userAvatar.src = user.photoURL || 'path/to/default/avatar.png';
        userName.textContent = user.displayName || user.email;
    } else {
        // Reset to login state
        loginBtnText.textContent = 'Login';
        loginBtn.title = 'Login with Google';

        // Hide user profile
        userProfileDisplay.style.display = 'none';
        userAvatar.src = '';
        userName.textContent = '';
    }
}

/**
 * Show the logged-in view
 */
export function showLoggedInView() {
    // Enable relevant UI elements
    document.querySelector('.chat-container').style.display = 'block';
    document.querySelector('.input-container').style.display = 'block';
}

/**
 * Show the logged-out view
 */
export function showLoggedOutView() {
    // Show welcome screen or login prompt
    document.querySelector('.chat-container').style.display = 'none';
    document.querySelector('.input-container').style.display = 'none';
}

/**
 * Enable chat features
 */
export function enableChatFeatures() {
    const chatInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const toolButtons = document.querySelectorAll('.tool-button, .circle-button');

    chatInput.disabled = false;
    sendButton.disabled = false;
    toolButtons.forEach(button => button.disabled = false);
}

/**
 * Disable chat features
 */
export function disableChatFeatures() {
    const chatInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const toolButtons = document.querySelectorAll('.tool-button, .circle-button');

    chatInput.disabled = true;
    sendButton.disabled = true;
    toolButtons.forEach(button => button.disabled = true);
}

/**
 * Render chat list
 * @param {Array} chats - List of chat objects
 */
export function renderChatList(chats) {
    const chatListContainer = document.getElementById('chatListContainer');
    chatListContainer.innerHTML = ''; // Clear existing chats

    chats.forEach(chat => {
        const chatElement = createChatListItem(chat);
        chatListContainer.appendChild(chatElement);
    });
}

/**
 * Create a chat list item element
 * @param {Object} chat - Chat object
 * @returns {HTMLElement}
 */
function createChatListItem(chat) {
    const div = document.createElement('div');
    div.className = 'chat-list-item';
    div.dataset.chatId = chat.id;
    div.innerHTML = `
        <span class="chat-title">${chat.title}</span>
        <div class="chat-actions">
            <button class="chat-action edit" title="Edit">✎</button>
            <button class="chat-action delete" title="Delete">×</button>
        </div>
    `;
    return div;
}

/**
 * Render custom GPT list
 * @param {Array} gpts - List of GPT config objects
 */
export function renderCustomGptList(gpts) {
    const gptListContainer = document.getElementById('customGptListContainer');
    gptListContainer.innerHTML = ''; // Clear existing GPTs

    gpts.forEach(gpt => {
        const gptElement = createGptListItem(gpt);
        gptListContainer.appendChild(gptElement);
    });
}

/**
 * Create a GPT list item element
 * @param {Object} gpt - GPT config object
 * @returns {HTMLElement}
 */
function createGptListItem(gpt) {
    const div = document.createElement('div');
    div.className = 'gpt-list-item';
    div.dataset.gptId = gpt.id;
    div.innerHTML = `
        <div class="gpt-icon"></div>
        <div class="gpt-name">${gpt.name}</div>
        <div class="gpt-list-item-actions">
            <button class="gpt-list-action-button edit" title="Edit">✎</button>
            <button class="gpt-list-action-button delete" title="Delete">×</button>
        </div>
    `;
    return div;
}

/**
 * Clear chat list
 */
export function clearChatList() {
    const chatListContainer = document.getElementById('chatListContainer');
    chatListContainer.innerHTML = '';
}

/**
 * Clear GPT list
 */
export function clearGptList() {
    const gptListContainer = document.getElementById('customGptListContainer');
    gptListContainer.innerHTML = '';
} 