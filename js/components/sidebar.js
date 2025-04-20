// ===== FILE: js/components/sidebar.js =====
import * as state from '../state.js';
import * as api from '../api.js';
import * as chatStore from '../stores/chatStore.js';
import * as gptStore from '../customGpt/gptStore.js';
import { openCreatorModal } from '../customGpt/creatorScreen.js';
import { showWelcomeInterface, showChatInterface, addUserMessage, renderMessagesFromHistory, clearMessageListUI } from './messageList.js';
import { removeImagePreview, updateInputUIForModel, clearMessageInput, renderFilePreviews } from './chatInput.js';
import { showNotification } from '../components/notification.js';
import { escapeHTML } from '../utils.js';
import { updateActiveGptDisplay } from './header.js';
import { showConfirmDialog } from './dialog.js';

// --- DOM Elements ---
const sidebarElement = document.getElementById('sidebar');
const overlayElement = document.getElementById('overlay');
const menuButton = document.getElementById('menuButton');
const newChatBtn = document.getElementById('newChatBtn');
const chatListContainer = document.getElementById('chatListContainer');
const addCustomGptBtn = document.getElementById('addCustomGptBtn');
const customGptListContainer = document.getElementById('customGptListContainer');
const darkModeBtn = document.getElementById('darkModeBtn');
const clearConversationsBtn = document.getElementById('clearConversationsBtn');
const helpFAQBtn = document.getElementById('helpFAQBtn');
const logoutBtn = document.getElementById('logoutBtn');

// --- Loading States ---
let isLoading = false;

function setLoading(loading) {
    isLoading = loading;
    document.body.classList.toggle('loading', loading);
    // Disable buttons during loading
    const buttons = document.querySelectorAll('.chat-item button, .gpt-list-item button, #newChatBtn, #clearConversationsBtn');
    buttons.forEach(button => button.disabled = loading);
}

function toggleSidebar(visible) {
    sidebarElement?.classList.toggle('visible', visible);
    overlayElement?.classList.toggle('visible', visible);
}

function handleOverlayClick() {
    toggleSidebar(false);
}

// --- Chat History List ---

export function renderChatList(chats = null) {
    if (!chatListContainer) {
        console.error("Chat list container not found in sidebar.");
        return;
    }

    chatListContainer.innerHTML = ''; // Clear previous list

    // Show loading state if no chats provided
    if (chats === null) {
        chatListContainer.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    // Show empty state
    if (chats.length === 0) {
        chatListContainer.innerHTML = '<div class="empty-state">No conversations yet</div>';
        return;
    }

    const activeChatId = state.getActiveChatId();

    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-item ${chat.id === activeChatId ? 'active' : ''}`;
        item.dataset.chatId = chat.id;

        item.innerHTML = `
            <div class="chat-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div class="chat-title">${escapeHTML(chat.title)}</div>
            <div class="chat-options">
                 <button class="delete-chat-button" title="Delete Chat" data-chat-id="${chat.id}" ${isLoading ? 'disabled' : ''}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                 </button>
            </div>
        `;
        chatListContainer.appendChild(item);
    });
}

async function handleLoadChat(chatId) {
    if (isLoading || !state.getIsAuthenticated()) return;
    
    try {
        setLoading(true);
        console.log("Attempting to load chat:", chatId);
        
        const history = await chatStore.loadChat(
            state.getCurrentUser().uid,
            state.getDbInstance(),
            chatId
        );

        if (history) {
            const wasCustomGptActive = !!state.getActiveCustomGptConfig();

            state.clearLastGeneratedImageUrl();
            state.setActiveChat(history, chatId);
            
            if (wasCustomGptActive) {
                state.clearActiveCustomGptConfig();
                updateActiveGptDisplay();
            }

            clearMessageListUI();
            renderMessagesFromHistory(history);
            removeImagePreview();
            renderFilePreviews();
            clearMessageInput();
            updateInputUIForModel();
            showChatInterface();
            renderChatList(await chatStore.getChatList(state.getCurrentUser().uid, state.getDbInstance()));
            renderCustomGptList();
            toggleSidebar(false);
        } else {
            showNotification("Failed to load chat.", 'error');
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        showNotification("Error loading chat: " + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function handleDeleteChat(chatId) {
    if (isLoading || !state.getIsAuthenticated()) return;

    try {
        const userId = state.getCurrentUser().uid;
        const db = state.getDbInstance();
        const chatList = await chatStore.getChatList(userId, db);
        const chatToDelete = chatList.find(c => c.id === chatId);
        const titleToDelete = chatToDelete ? `"${chatToDelete.title}"` : `this chat (ID: ${chatId})`;

        showConfirmDialog(`Are you sure you want to delete the chat ${titleToDelete}?`, 
            async () => {
                setLoading(true);
                try {
                    await chatStore.deleteChat(userId, db, chatId);
                    showNotification('Chat deleted.', 'success', 1500);
                    
                    if (state.getActiveChatId() === chatId) {
                        state.clearChatHistory(); 
                        state.clearActiveCustomGptConfig();
                        updateActiveGptDisplay();
                        showWelcomeInterface();
                    }
                    renderChatList(await chatStore.getChatList(userId, db));
                    renderCustomGptList();
                } catch (error) {
                    console.error('Error deleting chat:', error);
                    showNotification('Failed to delete chat: ' + error.message, 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
    } catch (error) {
        console.error('Error preparing to delete chat:', error);
        showNotification('Error preparing to delete chat: ' + error.message, 'error');
    }
}

// --- Custom GPT List ---

export function renderCustomGptList(configs = null) {
    if (!customGptListContainer) {
        console.error("Custom GPT list container not found.");
        return;
    }

    customGptListContainer.innerHTML = '';

    // Show loading state if no configs provided
    if (configs === null) {
        customGptListContainer.innerHTML = '<div class="loading-spinner"></div>';
        return;
    }

    // Show empty state
    if (configs.length === 0) {
        customGptListContainer.innerHTML = '<div class="empty-state">No Custom GPTs created</div>';
        return;
    }

    const activeGptId = state.getActiveCustomGptConfig()?.id;

    configs.forEach(config => {
        const item = document.createElement('div');
        item.className = `gpt-list-item ${config.id === activeGptId ? 'active' : ''}`;
        item.dataset.gptId = config.id;
        item.title = config.description || config.name;

        item.innerHTML = `
            <div class="gpt-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9Z"></path>
                    <path d="m9 9 6 6"></path>
                    <path d="m15 9-6 6"></path>
                </svg>
            </div>
            <div class="gpt-name">${escapeHTML(config.name)}</div>
            <div class="gpt-list-item-actions">
                 <button class="gpt-list-action-button edit-gpt-button" title="Edit GPT" data-gpt-id="${config.id}" ${isLoading ? 'disabled' : ''}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                 </button>
                 <button class="gpt-list-action-button delete-gpt-button delete" title="Delete GPT" data-gpt-id="${config.id}" ${isLoading ? 'disabled' : ''}>
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                 </button>
            </div>
        `;
        customGptListContainer.appendChild(item);
    });
}

async function handleLoadCustomGpt(gptId) {
    if (isLoading || !state.getIsAuthenticated()) return;

    try {
        setLoading(true);
        console.log(`Attempting to load Custom GPT: ${gptId}`);
        
        const config = await gptStore.loadConfig(
            state.getCurrentUser().uid,
            state.getDbInstance(),
            gptId
        );

        if (config) {
            await handleAutoSaveCurrentChat();

            state.setActiveCustomGptConfig(config);
            state.clearLastGeneratedImageUrl();
            state.clearChatHistory();
            
            clearMessageListUI();
            removeImagePreview();
            renderFilePreviews();
            clearMessageInput();
            showWelcomeInterface();
            updateInputUIForModel();
            updateActiveGptDisplay();
            
            renderCustomGptList(await gptStore.getConfigList(state.getCurrentUser().uid, state.getDbInstance()));
            renderChatList(await chatStore.getChatList(state.getCurrentUser().uid, state.getDbInstance()));
            
            toggleSidebar(false);
            showNotification(`Switched to Custom GPT: ${config.name}`, 'success');
        } else {
            showNotification("Failed to load Custom GPT.", "error");
        }
    } catch (error) {
        console.error('Error loading Custom GPT:', error);
        showNotification("Error loading Custom GPT: " + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function handleEditCustomGpt(gptId) {
    if (isLoading || !state.getIsAuthenticated()) return;

    try {
        setLoading(true);
        console.log(`Attempting to edit Custom GPT: ${gptId}`);
        
        const config = await gptStore.loadConfig(
            state.getCurrentUser().uid,
            state.getDbInstance(),
            gptId
        );

        if (config) {
            openCreatorModal(config);
        } else {
            showNotification("Could not load GPT data for editing.", "error");
        }
    } catch (error) {
        console.error('Error loading GPT for editing:', error);
        showNotification("Error loading GPT for editing: " + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function handleDeleteCustomGpt(gptId) {
    if (isLoading || !state.getIsAuthenticated()) return;

    try {
        const userId = state.getCurrentUser().uid;
        const db = state.getDbInstance();
        const configList = await gptStore.getConfigList(userId, db);
        const configToDelete = configList.find(c => c.id === gptId);
        const nameToDelete = configToDelete ? `"${configToDelete.name}"` : `this Custom GPT (ID: ${gptId})`;

        showConfirmDialog(`Are you sure you want to delete ${nameToDelete}? This cannot be undone.`, 
            async () => {
                setLoading(true);
                try {
                    await gptStore.deleteConfig(userId, db, gptId);
                    showNotification('Custom GPT deleted.', 'success', 1500);
                    
                    if (state.getActiveCustomGptConfig()?.id === gptId) {
                        state.clearActiveCustomGptConfig();
                        state.clearChatHistory();
                        updateActiveGptDisplay();
                        showWelcomeInterface();
                    }
                    
                    renderCustomGptList(await gptStore.getConfigList(userId, db));
                } catch (error) {
                    console.error('Error deleting Custom GPT:', error);
                    showNotification('Failed to delete Custom GPT: ' + error.message, 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
    } catch (error) {
        console.error('Error preparing to delete Custom GPT:', error);
        showNotification('Error preparing to delete Custom GPT: ' + error.message, 'error');
    }
}

async function handleAutoSaveCurrentChat() {
    const currentHistory = state.getChatHistory();
    const currentChatId = state.getActiveChatId();
    
    if (currentHistory.length > 0) {
        try {
            await chatStore.saveChat(
                state.getCurrentUser().uid,
                state.getDbInstance(),
                currentHistory,
                currentChatId
            );
        } catch (error) {
            console.error('Error auto-saving chat:', error);
            // Don't show notification for auto-save failures
        }
    }
}

async function handleNewChat() {
    if (isLoading || !state.getIsAuthenticated()) return;

    try {
        setLoading(true);
        await handleAutoSaveCurrentChat();
        
        state.clearChatHistory();
        state.clearActiveCustomGptConfig();
        state.clearLastGeneratedImageUrl();
        
        clearMessageListUI();
        removeImagePreview();
        renderFilePreviews();
        clearMessageInput();
        showWelcomeInterface();
        updateInputUIForModel();
        updateActiveGptDisplay();
        
        renderChatList(await chatStore.getChatList(state.getCurrentUser().uid, state.getDbInstance()));
        renderCustomGptList(await gptStore.getConfigList(state.getCurrentUser().uid, state.getDbInstance()));
        
        toggleSidebar(false);
    } catch (error) {
        console.error('Error creating new chat:', error);
        showNotification("Error creating new chat: " + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function handleClearAllConversations() {
    if (isLoading || !state.getIsAuthenticated()) return;

    showConfirmDialog("Are you sure you want to clear all conversations? This cannot be undone.", 
        async () => {
            try {
                setLoading(true);
                
                await chatStore.deleteAllChats(
                    state.getCurrentUser().uid,
                    state.getDbInstance()
                );

                state.clearChatHistory();
                state.clearActiveCustomGptConfig();
                state.clearLastGeneratedImageUrl();
                
                clearMessageListUI();
                removeImagePreview();
                renderFilePreviews();
                clearMessageInput();
                showWelcomeInterface();
                updateInputUIForModel();
                updateActiveGptDisplay();
                
                renderChatList([]);
                renderCustomGptList(await gptStore.getConfigList(state.getCurrentUser().uid, state.getDbInstance()));
                
                showNotification('All conversations cleared.', 'success', 1500);
            } catch (error) {
                console.error('Error clearing all conversations:', error);
                showNotification("Error clearing conversations: " + error.message, 'error');
            } finally {
                setLoading(false);
            }
        }
    );
}

function handleNotImplemented(event) {
    event.preventDefault();
    showNotification('This feature is not implemented yet.', 'info');
}

export function initializeSidebar() {
    // Attach event listeners
    overlayElement?.addEventListener('click', handleOverlayClick);
    menuButton?.addEventListener('click', () => toggleSidebar(true));
    newChatBtn?.addEventListener('click', handleNewChat);
    clearConversationsBtn?.addEventListener('click', handleClearAllConversations);
    helpFAQBtn?.addEventListener('click', handleNotImplemented);
    darkModeBtn?.addEventListener('click', handleNotImplemented);

    // Chat list click handlers
    chatListContainer?.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        const deleteBtn = e.target.closest('.delete-chat-button');

        if (deleteBtn) {
            e.stopPropagation();
            handleDeleteChat(deleteBtn.dataset.chatId);
        } else if (chatItem) {
            handleLoadChat(chatItem.dataset.chatId);
        }
    });

    // Custom GPT list click handlers
    customGptListContainer?.addEventListener('click', (e) => {
        const gptItem = e.target.closest('.gpt-list-item');
        const editBtn = e.target.closest('.edit-gpt-button');
        const deleteBtn = e.target.closest('.delete-gpt-button');

        if (editBtn) {
            e.stopPropagation();
            handleEditCustomGpt(editBtn.dataset.gptId);
        } else if (deleteBtn) {
            e.stopPropagation();
            handleDeleteCustomGpt(deleteBtn.dataset.gptId);
        } else if (gptItem) {
            handleLoadCustomGpt(gptItem.dataset.gptId);
        }
    });

    // Add Custom GPT button
    addCustomGptBtn?.addEventListener('click', () => {
        openCreatorModal(); // Opens for new creation when no config passed
    });

    console.log("Sidebar initialized.");
}