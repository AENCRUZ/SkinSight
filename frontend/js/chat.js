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
    wakeBackend();
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
          const file = e.target.files[0];
          const problem = validateImage(file);
          if (problem) {
            showImageError(problem);
            e.target.value = '';
            return;
          }
          clearImageError();
          selectedImageFile = file;
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

  // ---- photo checks (the server re-checks everything; this just gives instant feedback)
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

  function validateImage(file) {
    if (IMAGE_TYPES.indexOf((file.type || '').toLowerCase()) === -1) {
      return /heic|heif/i.test(file.type + file.name)
        ? 'HEIC photos aren’t supported. On iPhone, choose a JPEG (Settings › Camera › Formats › Most Compatible) or upload a screenshot of the photo.'
        : 'That file type isn’t supported. Please choose a JPEG, PNG or WebP photo.';
    }
    if (file.size > IMAGE_MAX_BYTES) {
      return 'That photo is ' + (file.size / 1048576).toFixed(1) + ' MB. Please choose one under 5 MB.';
    }
    return '';
  }

  let imageErrorEl = null;
  function showImageError(message) {
    if (!imageErrorEl) {
      imageErrorEl = document.createElement('p');
      imageErrorEl.id = 'image-error';
      imageErrorEl.className = 'chat-note is-error';
      imageErrorEl.setAttribute('role', 'alert');
      const inputBar = document.querySelector('.chat-inputbar');
      if (inputBar && inputBar.parentNode) inputBar.parentNode.insertBefore(imageErrorEl, inputBar);
    }
    imageErrorEl.textContent = message;
    imageErrorEl.hidden = false;
  }
  function clearImageError() {
    if (imageErrorEl) imageErrorEl.hidden = true;
  }

  // ---- connection note: the hosted backend sleeps when idle and can need up to a minute to wake up
  let connNote = null;
  function setConnNote(message, isError) {
    if (!connNote) {
      connNote = document.createElement('p');
      connNote.id = 'chatConnNote';
      connNote.className = 'chat-note';
      connNote.setAttribute('role', 'status');
      const inputBar = document.querySelector('.chat-inputbar');
      if (inputBar && inputBar.parentNode) inputBar.parentNode.insertBefore(connNote, inputBar);
    }
    if (!message) { connNote.hidden = true; return; }
    connNote.textContent = message;
    connNote.classList.toggle('is-error', !!isError);
    connNote.hidden = false;
  }

  function wakeBackend() {
    if (!window.SkinsightAPI || !window.SkinsightAPI.wakeUp) return;
    window.SkinsightAPI.wakeUp(function () {
      setConnNote('Connecting to the assistant… the first time can take up to a minute while the server wakes up. You can already type your message.', false);
    }).then(function (ok) {
      if (ok) setConnNote('');
      else setConnNote('The assistant isn’t responding yet. You can still send your message and we’ll try again.', true);
    });
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
    const added = [];
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
      added.push(photoWrap);
    }

    if (text && text.trim()) {
      const bubble = document.createElement('div');
      bubble.className = 'msg msg-user';
      bubble.textContent = text;
      chatBody.appendChild(bubble);
      added.push(bubble);
    }

    scrollToBottom();
    return added;
  }

  function appendAIMessage(rawMarkdown) {
    const bubble = document.createElement('div');
    bubble.className = 'msg msg-ai';
    bubble.innerHTML = formatMarkdownToHTML(rawMarkdown);
    chatBody.appendChild(bubble);
    scrollToBottom();
  }

  let slowTimer = null;

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
    clearTimeout(slowTimer);
    slowTimer = setTimeout(function () {
      const el = document.getElementById('typingIndicator');
      if (!el) return;
      const hint = document.createElement('span');
      hint.className = 'typing-slow';
      hint.textContent = 'Still working… the assistant may be waking up, which can take up to a minute.';
      el.appendChild(hint);
      scrollToBottom();
    }, 8000);
  }

  function hideTypingIndicator() {
    clearTimeout(slowTimer);
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
    const sentNodes = appendUserMessage(messageText, imageToUpload);

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
      const code = err && err.code;
      // Failures where nothing reached the assistant: undo the bubble and put the message back so it can be re-sent.
      const retryable = code === 'network' || code === 'timeout' || code === 'unavailable' || code === 'rate-limit';
      if (retryable) {
        sentNodes.forEach(function (n) { n.remove(); });
        chatInput.value = messageText;
        if (imageToUpload) {
          selectedImageFile = imageToUpload;
          showImagePreview(imageToUpload.name);
        }
      }

      if (code === 'auth') {
        appendAIMessage(
          '🔒 **Your session has expired or you are not logged in.** ' +
          'Please **log in** again at [login.html](login.html) to keep chatting. Your earlier messages are saved to your account.'
        );
      } else if (code === 'too-large') {
        appendAIMessage('⚠️ **That photo is too large.** Please choose a JPEG, PNG or WebP photo under 5 MB and send again.');
      } else if (code === 'rate-limit') {
        appendAIMessage('⚠️ **Too many messages in a short time.** Please wait a few seconds, then press Send again. Your message is still in the box.');
      } else if (code === 'bad-request' && /too long/i.test(err.message || '')) {
        appendAIMessage('⚠️ **This consultation has become very long.** Please generate your summary and start a **New consultation** from the history panel to continue.');
      } else if (code === 'bad-request') {
        appendAIMessage('⚠️ **' + (err.message || 'That message couldn’t be sent.') + '**');
      } else {
        appendAIMessage(
          '⚠️ **We couldn’t reach the assistant.** ' + (err.message || '') + '\n\n' +
          'Your message is back in the box, so just press **Send** to try again.'
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

    // **bold**, and links ONLY to plain local pages like [log in](login.html). Anything else stays literal text
    // (the text has already been HTML-escaped, so no markup can get through).
    const inline = (str) => str
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]\n]{1,60})\]\(([a-z0-9-]+\.html)\)/gi, '<a href="$2">$1</a>');
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

