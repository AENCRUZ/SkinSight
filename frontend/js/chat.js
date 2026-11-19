/**
 * Chat Controller for SKINSIGHT AI Assistant
 * Connects frontend/ai-chat.html with the backend AI service.
 */

(function () {
  const chatBody = document.querySelector('.chat-body');
  const chatInput = document.querySelector('.chat-inputbar textarea, .chat-inputbar input[type="text"]');
  const sendBtn = document.querySelector('.chat-inputbar button.send');
  const attachToggle = document.getElementById('attach-toggle');
  const fileInputs = document.querySelectorAll('.attach-panel input[type="file"]');
  const summaryBtn = document.querySelector('.chat-cta a');

  let conversationHistory = [];
  let selectedImageFile = null;
  let isWaitingForResponse = false;

  // Selected image preview container
  let previewBar = document.getElementById('selected-image-preview');
  if (!previewBar) {
    previewBar = document.createElement('div');
    previewBar.id = 'selected-image-preview';
    previewBar.className = 'attach-preview';
    previewBar.style.display = 'none';
    const inputBar = document.querySelector('.chat-inputbar');
    if (inputBar && inputBar.parentNode) {
      inputBar.parentNode.insertBefore(previewBar, inputBar);
    }
  }

  const DEFAULT_WELCOME_MSG =
    "Hello! I am your **SKINSIGHT AI Intake Assistant**.\n\n" +
    "I'm here to help you document and organize your skin symptoms before you speak with a dermatologist.\n\n" +
    "To get started, please **describe what you're noticing or feeling on your skin** (e.g., redness, itching, bumps), or attach a clear photo using the camera button.";

  function resetChatToWelcome() {
    conversationHistory = [];
    selectedImageFile = null;
    clearImagePreview();
    if (chatBody) {
      chatBody.innerHTML = '';
      appendAIMessage(DEFAULT_WELCOME_MSG);
    }
  }

  function initChat() {
    // Try to load any existing session history
    const saved = sessionStorage.getItem('skinsight_chat_history');
    if (saved) {
      try {
        conversationHistory = JSON.parse(saved);
      } catch (e) {
        conversationHistory = [];
      }
    }

    if (conversationHistory.length > 0) {
      renderAllMessages();
    } else {
      resetChatToWelcome();
    }

    attachEventListeners();
  }

  function attachEventListeners() {
    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendMessage);
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
        }
      });
    }

    // Attach file selection listeners
    fileInputs.forEach((input) => {
      input.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
          selectedImageFile = e.target.files[0];
          showImagePreview(selectedImageFile.name);
          if (attachToggle) attachToggle.checked = false; // close panel
        }
      });
    });

    if (summaryBtn) {
      summaryBtn.addEventListener('click', function (e) {
        // Save current history and clear stale summary cache
        sessionStorage.setItem('skinsight_chat_history', JSON.stringify(conversationHistory));
        sessionStorage.removeItem('skinsight_consultation_summary');
      });
    }
  }

  let previewUrl = '';

  function revokePreviewUrl() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    }
  }

  function showImagePreview(filename) {
    revokePreviewUrl();
    try {
      previewUrl = selectedImageFile ? URL.createObjectURL(selectedImageFile) : '';
    } catch (e) {
      previewUrl = '';
    }
    previewBar.style.display = 'flex';
    previewBar.innerHTML =
      (previewUrl ? '<img class="attach-preview-thumb" src="' + previewUrl + '" alt="">' : '') +
      '<span class="attach-preview-name">Attached photo: <strong>' + escapeHtml(filename) + '</strong></span>' +
      '<button type="button" class="attach-preview-remove" aria-label="Remove attached photo" title="Remove photo">&times;</button>';
    const removeBtn = previewBar.querySelector('button');
    removeBtn.addEventListener('click', () => {
      selectedImageFile = null;
      revokePreviewUrl();
      previewBar.style.display = 'none';
      fileInputs.forEach((i) => (i.value = ''));
    });
  }

  function clearImagePreview() {
    selectedImageFile = null;
    revokePreviewUrl();
    previewBar.style.display = 'none';
    fileInputs.forEach((i) => (i.value = ''));
  }

  function appendUserMessage(text, imageFile) {
    if (imageFile) {
      const photoWrap = document.createElement('div');
      photoWrap.className = 'msg-photo-wrap';
      photoWrap.innerHTML = `
        <div class="msg-photo">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6l2-3h4l2 3"/><circle cx="12" cy="13" r="3.5"/></svg>
        </div>
        <p class="msg-caption">${escapeHtml(imageFile.name)}</p>
      `;
      try {
        const thumbUrl = URL.createObjectURL(imageFile);
        const img = document.createElement('img');
        img.alt = 'Photo you attached: ' + imageFile.name;
        img.onload = function () { URL.revokeObjectURL(thumbUrl); scrollToBottom(); };
        img.onerror = function () { URL.revokeObjectURL(thumbUrl); img.remove(); };
        img.src = thumbUrl;
        const holder = photoWrap.querySelector('.msg-photo');
        holder.textContent = '';
        holder.appendChild(img);
      } catch (e) { /* keep the icon placeholder */ }
      chatBody.appendChild(photoWrap);
    }

    if (text && text.trim()) {
      const bubble = document.createElement('div');
      bubble.className = 'msg msg-user';
      bubble.textContent = text;
      chatBody.appendChild(bubble);
    }

    scrollToBottom();
  }

  function appendAIMessage(rawMarkdown) {
    const bubble = document.createElement('div');
    bubble.className = 'msg msg-ai';
    bubble.innerHTML = formatMarkdownToHTML(rawMarkdown);
    chatBody.appendChild(bubble);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const typing = document.createElement('div');
    typing.className = 'msg msg-ai typing-indicator';
    typing.id = 'typingIndicator';
    typing.setAttribute('role', 'status');
    typing.innerHTML =
      '<span class="typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="visually-hidden">SKINSIGHT is reviewing and preparing questions…</span>';
    chatBody.appendChild(typing);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
  }

  function scrollToBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  async function handleSendMessage() {
    if (isWaitingForResponse) return;

    const messageText = chatInput.value.trim();
    const imageToUpload = selectedImageFile;

    if (!messageText && !imageToUpload) {
      chatInput.focus();
      return;
    }

    // Render user message on screen
    appendUserMessage(messageText, imageToUpload);

    // Clear input bar and attached image preview
    chatInput.value = '';
    clearImagePreview();

    // Show typing indicator & lock input
    isWaitingForResponse = true;
    showTypingIndicator();
    chatInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    try {
      const response = await window.SkinsightAPI.sendMessage({
        message: messageText,
        history: conversationHistory,
        imageFile: imageToUpload,
      });

      hideTypingIndicator();

      if (response && response.reply) {
        appendAIMessage(response.reply);
        conversationHistory = response.history || conversationHistory;
        sessionStorage.setItem('skinsight_chat_history', JSON.stringify(conversationHistory));
      } else {
        appendAIMessage("I received your message, but couldn't generate a response. Please try again.");
      }
    } catch (err) {
      hideTypingIndicator();
      console.error('Chat error:', err);
      const isAuthErr = err.message && (err.message.includes('token') || err.message.includes('Authentication'));
      if (isAuthErr) {
        appendAIMessage(
          `🔒 **Session Expired or Login Required:** ${err.message}\n\n` +
          'Please **log in** (or sign in again) at [login.html](login.html) to chat with the AI Assistant.'
        );
      } else {
        appendAIMessage(
          `⚠️ **Error connecting to AI service:** ${err.message || 'Server error'}.\n\n` +
          "Please check your connection and try again. If the problem continues, the assistant may be temporarily unavailable."
        );
      }
    } finally {
      isWaitingForResponse = false;
      chatInput.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  function renderAllMessages() {
    chatBody.innerHTML = '';
    conversationHistory.forEach((turn) => {
      const role = turn.role === 'model' || turn.role === 'assistant' ? 'ai' : 'user';
      const text = turn.parts ? turn.parts.map((p) => p.text).join(' ') : (turn.text || turn.content || '');

      if (role === 'user') {
        appendUserMessage(text, null);
      } else {
        appendAIMessage(text);
      }
    });
    scrollToBottom();
  }

  // Simple Markdown to HTML helper: **bold**, bullet / numbered lists, paragraphs
  function formatMarkdownToHTML(text) {
    if (!text) return '';
    const out = [];
    let para = [];
    let list = null;

    const inline = (str) => str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const flushPara = () => {
      if (para.length) {
        out.push('<p>' + para.join('<br>') + '</p>');
        para = [];
      }
    };
    const closeList = () => {
      if (list) {
        out.push('</' + list + '>');
        list = null;
      }
    };

    escapeHtml(text).split('\n').forEach((raw) => {
      const line = raw.replace(/\s+$/, '');
      const bullet = line.match(/^\s*[*-]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

      if (bullet || numbered) {
        flushPara();
        const type = bullet ? 'ul' : 'ol';
        if (list !== type) {
          closeList();
          out.push('<' + type + ' class="msg-list">');
          list = type;
        }
        out.push('<li>' + inline((bullet || numbered)[1]) + '</li>');
      } else if (line.trim() === '') {
        closeList();
        flushPara();
      } else {
        closeList();
        para.push(inline(line));
      }
    });
    closeList();
    flushPara();
    return out.join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Handle Back-Forward Cache (bfcache) navigation
  window.addEventListener('pageshow', function (event) {
    const saved = sessionStorage.getItem('skinsight_chat_history');
    if (!saved) {
      // If history was purged (e.g. user signed out), wipe stale messages immediately
      resetChatToWelcome();
    } else if (event.persisted) {
      try {
        conversationHistory = JSON.parse(saved);
        renderAllMessages();
      } catch (e) {
        resetChatToWelcome();
      }
    }
  });

  // Cross-tab logout listener
  window.addEventListener('storage', function (e) {
    if (e.key === 'skinsight_user' && !e.newValue) {
      try {
        sessionStorage.removeItem('skinsight_chat_history');
        sessionStorage.removeItem('skinsight_consultation_summary');
      } catch (err) { }
      resetChatToWelcome();
    }
  });

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }
})();

