// ===== FILE: js/components/messageList.js =====
// MODIFIED: Corrected parser import. Add appendAIMessageContent, finalizeAIMessageContent. Update renderMessagesFromHistory.
import * as state from '../state.js';
import * as api from '../api.js'; // Needed for regenerate
import * as chatStore from '../stores/chatStore.js'; // Needed for regenerate save
import * as utils from '../utils.js';
import { showNotification } from '../notificationHelper.js';
// <<< FIXED IMPORT: Use the new function names from parser.js >>>
import { resetParser, parseFinalHtml, accumulateChunkAndGetEscaped } from '../parser.js';

// --- DOM Elements ---
const chatContainerElement = document.getElementById('chatContainer');
const welcomeScreenElement = document.getElementById('welcomeScreen');
const messageContainerElement = document.getElementById('messageContainer');
let typingIndicatorElement = null;

// --- Message List Logic ---

function scrollToBottom(behavior = 'smooth') {
    if (chatContainerElement) {
        setTimeout(() => {
            chatContainerElement.scrollTo({
                top: chatContainerElement.scrollHeight,
                behavior: behavior
            });
        }, 50);
    }
}

export function showChatInterface() {
    if (welcomeScreenElement) welcomeScreenElement.style.display = 'none';
    if (messageContainerElement) messageContainerElement.style.display = 'flex';
}

export function showWelcomeInterface() {
    if (welcomeScreenElement) welcomeScreenElement.style.display = 'flex';
    if (messageContainerElement) messageContainerElement.style.display = 'none';
    clearMessageListUI();
    removeTypingIndicator();
}

export function clearMessageListUI() {
    if (messageContainerElement) messageContainerElement.innerHTML = '';
    removeTypingIndicator();
}

/**
 * Creates HTML for file pills to be displayed in a message
 * @param {Array<{name: string, type: string}>} files - Array of file metadata objects
 * @returns {string} HTML string for the file pills container
 */
function createFilePillsHtml(files) {
    if (!files || files.length === 0) return '';

    const pillsHtml = files.map(file => {
        const extension = utils.getFileExtension(file.name);
        let iconClass = 'unknown';
        if (extension === 'txt') iconClass = 'txt';
        else if (extension === 'pdf') iconClass = 'pdf';
        else if (extension === 'md') iconClass = 'md';

        return `
            <div class="attached-file-pill">
                <span class="file-icon ${iconClass}"></span>
                <span class="filename-text">${utils.escapeHTML(file.name)}</span>
            </div>
        `;
    }).join('');

    return `<div class="message-attachments">${pillsHtml}</div>`;
}

export function addUserMessage(textContent, imageData = null, attachedFilesMeta = null) {
    if (!messageContainerElement) return;
    // Only proceed if there's text OR an image OR files
    if (!textContent && !imageData && (!attachedFilesMeta || attachedFilesMeta.length === 0)) return;

    showChatInterface();
    const userMessage = document.createElement('div');
    userMessage.className = 'user-message-container';

    let imageHtml = '';
    if (imageData) {
        imageHtml = `<img src="${imageData}" class="history-image" alt="User Uploaded Image">`;
    }

    let filesPillsHtml = '';
    if (attachedFilesMeta && attachedFilesMeta.length > 0) {
        filesPillsHtml = createFilePillsHtml(attachedFilesMeta);
    }

    userMessage.innerHTML = `<div class="user-bubble">${filesPillsHtml}${imageHtml}${utils.escapeHTML(textContent)}</div>`;
    messageContainerElement.appendChild(userMessage);
    scrollToBottom();
}

/**
 * Creates the initial HTML structure for an AI message container,
 * including placeholder for content and action buttons (Copy, Regenerate, Listen).
 * The content is populated later during streaming/finalization.
 * @returns {HTMLElement | null} The created container element, or null if the main container isn't found.
 */
export function createAIMessageContainer() {
    if (!messageContainerElement) {
        console.error("Message container element not found, cannot create AI message.");
        return null;
    }
    showChatInterface(); // Ensure the chat area is visible

    const aiMessage = document.createElement('div');
    aiMessage.className = 'ai-message-container';

    // Add the "Listen" button alongside Copy and Regenerate
    // The action buttons are hidden initially (style="display: none;") and shown in finalizeAIMessageContent
    aiMessage.innerHTML = `
        <div class="ai-message-content streaming-content"></div>
        <div class="ai-message-actions" style="display: none;">
            <button class="action-button listen-button" title="Listen to response">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
            </button>
            <button class="action-button copy-button" title="Copy to clipboard">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="action-button regenerate-button" title="Regenerate response">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
        </div>
    `;

    messageContainerElement.appendChild(aiMessage);
    return aiMessage;
}


/**
 * <<< NEW >>> Appends HTML-escaped text content during streaming.
 * Uses innerHTML += for simplicity with <br> tags.
 * @param {HTMLElement} aiMessageElement - The container element for the AI message.
 * @param {string} escapedChunk - The HTML-escaped text chunk to append.
 */
export function appendAIMessageContent(aiMessageElement, escapedChunk) {
    const contentDiv = aiMessageElement?.querySelector('.ai-message-content');
    if (contentDiv) {
        // Replace newline characters in the chunk with <br> tags for display
        const chunkWithBreaks = escapedChunk.replace(/\n/g, '<br>');
        // Append the chunk with breaks to the innerHTML
        contentDiv.innerHTML += chunkWithBreaks;
    } else {
        console.error("Could not find content div to append chunk.");
    }
    scrollToBottom();
}


/**
 * <<< NEW >>> Replaces the content with the final parsed HTML and shows actions.
 * @param {HTMLElement} aiMessageElement - The container element for the AI message.
 * @param {string} finalHtmlContent - The fully parsed HTML content to set.
 */
export function finalizeAIMessageContent(aiMessageElement, finalHtmlContent) {
    const contentDiv = aiMessageElement?.querySelector('.ai-message-content');
    const actionsDiv = aiMessageElement?.querySelector('.ai-message-actions');
    if (contentDiv) {
        contentDiv.innerHTML = finalHtmlContent; // Replace content with final parsed HTML
        contentDiv.classList.remove('streaming-content'); // Optional: remove streaming class
    } else {
        console.error("Could not find content div to finalize content.");
    }
    if (actionsDiv) {
        actionsDiv.style.display = 'flex'; // Show the action buttons
    }
    // Ensure scrolling happens after final content replacement
    scrollToBottom('auto'); // Use auto or instant might be better here
}


function handleCopyClick(contentToCopy) {
    utils.copyTextToClipboard(contentToCopy);
    showNotification('Response copied to clipboard!', 'success');
}


function handleRegenerateClick(aiMessageElement) {
    if (aiMessageElement && messageContainerElement?.contains(aiMessageElement)) {
        messageContainerElement.removeChild(aiMessageElement);
    } else {
        console.warn("Could not find AI message element to remove for regeneration.");
    }

    const currentHistory = state.getChatHistory();
    const currentActiveChatId = state.getActiveChatId();
    if (currentActiveChatId && currentHistory.length > 0) {
        console.log(`Saving chat ${currentActiveChatId} before regenerating...`);
        chatStore.saveChat(currentHistory, currentActiveChatId);
    }

    state.removeLastAssistantMessageFromHistory();

    const selectedModelSetting = state.getSelectedModelSetting();
    const useWebSearch = false;
    api.routeApiCall(selectedModelSetting, useWebSearch); // Pass only needed params
}

// ===== Add this block inside js/components/messageList.js =====

// Keep track of the currently playing audio and its associated button element
let currentAudio = null;
let currentListenButton = null;

/**
 * Stops any currently playing audio generated by the listen feature,
 * releases resources, and resets the button's visual state.
 */
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause(); // Stop playback
        // Remove event listeners to prevent memory leaks
        currentAudio.onplaying = null;
        currentAudio.onended = null;
        currentAudio.onerror = null;
        // Revoke the Blob URL to free up memory
        if (currentAudio.src && currentAudio.src.startsWith('blob:')) {
            URL.revokeObjectURL(currentAudio.src);
            console.log("Revoked Blob URL:", currentAudio.src);
        }
        currentAudio.src = ''; // Clear the source
        currentAudio = null; // Remove reference to the Audio object
        console.log("Stopped current audio playback.");
    }
    // Reset the visual state of the button that was playing
    if (currentListenButton) {
        currentListenButton.classList.remove('playing', 'loading');
        // Optional: Restore original icon if you changed it during playback
        // const svg = currentListenButton.querySelector('svg');
        // if (svg) { /* Reset SVG path if needed */ }
        currentListenButton = null; // Remove reference to the button
    }
}

/**
 * Handles the click event on the "Listen" button for an AI message.
 * Fetches the speech audio using saved settings and plays it.
 * @param {string} textToSpeak The raw text content of the AI message.
 * @param {HTMLElement} buttonElement The specific listen button element that was clicked.
 */
async function handleListenClick(textToSpeak, buttonElement) {
    // ... (Check if clicking playing button, stop previous audio logic) ...
    console.log("Stopping any previously playing audio.");
    stopCurrentAudio();

    // --- Set Loading State ---
    console.log("Setting loading state on button.");
    buttonElement.classList.add('loading');
    currentListenButton = buttonElement;

    // --- Choose Voice & Format ---
    const voice = 'onyx'; // Or get from settings later?
    const format = 'mp3';

    // --- GET SAVED INSTRUCTIONS FROM STATE --- <<< MODIFIED
    const ttsInstructions = state.getTtsInstructions() || null; // Get saved instructions, use null if empty

    // --- Add AI Disclosure (Important!) ---
    showNotification("Playing AI-generated voice (OpenAI).", 'info', 4000);

    // --- Call the API (Pass the retrieved instructions) ---
    console.log(`Fetching speech. Instructions: ${ttsInstructions ? `"${ttsInstructions}"` : "[None]"}`);
    const audioBlob = await api.fetchSpeech(textToSpeak, voice, format, ttsInstructions); // <<< PASS instructions

    // --- Handle API Response ---
    buttonElement.classList.remove('loading');

    if (audioBlob) {
        // ... (rest of the audio playback logic: createObjectURL, new Audio, event handlers, play()) ...
        console.log("Audio Blob received, setting up playback.");
        try {
            const audioUrl = URL.createObjectURL(audioBlob);
            console.log("Created Blob URL:", audioUrl);
            currentAudio = new Audio(audioUrl);

            currentAudio.onplaying = () => { /* ... */ };
            currentAudio.onended = () => { stopCurrentAudio(); };
            currentAudio.onerror = (e) => { /* ... */ stopCurrentAudio(); };

            currentAudio.play();

        } catch (playError) { /* ... */ stopCurrentAudio(); }
    } else {
        console.log("fetchSpeech returned null, playback aborted.");
        currentListenButton = null;
    }
}

// ===== End of block to add =====


/**
 * Sets up event listeners for message action buttons (Copy, Regenerate, Listen).
 * For image messages, only the Copy button will be enabled.
 * @param {HTMLElement} aiMessageElement - The container element for the AI message.
 * @param {string} rawContentToCopy - The raw content to copy (text or image URL).
 * @param {boolean} isImageMessage - Whether this is an image generation message.
 */
export function setupMessageActions(aiMessageElement, rawContentToCopy, isImageMessage = false) {
    if (!aiMessageElement) return;

    const copyButton = aiMessageElement.querySelector('.copy-button');
    const regenerateButton = aiMessageElement.querySelector('.regenerate-button');
    const listenButton = aiMessageElement.querySelector('.listen-button');

    if (copyButton) {
        copyButton.addEventListener('click', () => handleCopyClick(rawContentToCopy));
    }

    // For image messages, disable regenerate and listen buttons
    if (isImageMessage) {
        if (regenerateButton) {
            regenerateButton.style.display = 'none';
        }
        if (listenButton) {
            listenButton.style.display = 'none';
        }
    } else {
        if (regenerateButton) {
            regenerateButton.addEventListener('click', () => handleRegenerateClick(aiMessageElement));
        }
        if (listenButton) {
            listenButton.addEventListener('click', () => handleListenClick(rawContentToCopy, listenButton));
        }
    }
}

export function showTypingIndicator(text = "Thinking...") {
    if (!messageContainerElement) return;
    removeTypingIndicator();
    showChatInterface();
    typingIndicatorElement = document.createElement('div');
    typingIndicatorElement.className = 'ai-message-container typing-indicator';
    typingIndicatorElement.innerHTML = `<div class="ai-message-content">${utils.escapeHTML(text)}</div>`;
    messageContainerElement.appendChild(typingIndicatorElement);
    scrollToBottom();
}


export function removeTypingIndicator() {
    if (typingIndicatorElement && messageContainerElement?.contains(typingIndicatorElement)) {
        messageContainerElement.removeChild(typingIndicatorElement);
    }
    typingIndicatorElement = null;
}


/**
 * Renders all messages from the chat history.
 * Now handles both regular messages and image generation messages.
 * @param {Array} history - The chat history array.
 */
export function renderMessagesFromHistory(history) {
    if (!messageContainerElement) return;
    clearMessageListUI();

    history.forEach(message => {
        if (message.role === 'user') {
            addUserMessage(message.content, message.imageData, message.attachedFilesMeta);
        } else if (message.role === 'assistant') {
            const aiMessageElement = createAIMessageContainer();
            if (aiMessageElement) {
                // For AI messages, we need to parse the content as it may contain markdown/code
                const finalHtmlContent = parseFinalHtml(message.content);
                finalizeAIMessageContent(aiMessageElement, finalHtmlContent);
                setupMessageActions(aiMessageElement, message.content);
            }
        }
    });

    scrollToBottom('auto');
}


// --- Initialization ---
export function initializeMessageList() {
    // Event listeners for copy/regen are added dynamically when messages are finalized
}
