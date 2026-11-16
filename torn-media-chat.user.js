// ==UserScript==
// @name         Torn Media Chat
// @namespace    https://github.com/YOUR_USERNAME/torn-media-chat
// @version      1.6.0
// @description  Media toolbar (Full Searchable Emoji API, Mobile & Desktop Image Upload, Live GIF Search) + Inline Media Previews for all Torn chats
// @author       viberaterr
// @match        https://www.torn.com/*
// @updateURL    https://raw.githubusercontent.com/MichaelJamesLabao/torn-media-chat/main/torn-media-chat.user.js
// @downloadURL  https://raw.githubusercontent.com/MichaelJamesLabao/torn-media-chat/main/torn-media-chat.user.js
// @grant        GM_xmlhttpRequest
// @connect      freeimage.host
// @connect      api.imgur.com
// @connect      api.giphy.com
// @connect      cdn.jsdelivr.net
// ==/UserScript==

(() => {
  'use strict';

  document
    .querySelectorAll('.tmc-anchor, #tmc-lightbox')
    .forEach((el) => el.remove());

  const SELECTORS = {
    chatRoot: '#chatRoot, #faction',
    textarea: 'textarea[class*="textarea___"]',
    wrapper: 'div[class*="root___"]'
  };

  const STORAGE_KEYS = {
    emojiCatalog: 'tmc_emoji_catalog_v1',
    recentEmojis: 'tmc_recent_emojis_v1',
    giphyApiKey: 'tmc_giphy_api_key_v1'
  };

  const EMOJI_API_URL =
    'https://cdn.jsdelivr.net/npm/unicode-emoji-json@0.6.0/data-by-group.json';

  const ICONS = {
    emoji: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    gif: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`
  };

  const FALLBACK_EMOJIS = [
    { emoji: '😀', name: 'grinning face', group: 'Smileys & Emotion' },
    { emoji: '😂', name: 'face with tears of joy', group: 'Smileys & Emotion' },
    { emoji: '🤣', name: 'rolling on the floor laughing', group: 'Smileys & Emotion' },
    { emoji: '😎', name: 'smiling face with sunglasses', group: 'Smileys & Emotion' },
    { emoji: '💀', name: 'skull', group: 'Smileys & Emotion' },
    { emoji: '👀', name: 'eyes', group: 'People & Body' },
    { emoji: '🔥', name: 'fire', group: 'Travel & Places' },
    { emoji: '💯', name: 'hundred points', group: 'Smileys & Emotion' },
    { emoji: '👍', name: 'thumbs up', group: 'People & Body' },
    { emoji: '🎉', name: 'party popper', group: 'Activities' },
    { emoji: '💰', name: 'money bag', group: 'Objects' },
    { emoji: '🏥', name: 'hospital', group: 'Travel & Places' },
    { emoji: '✈️', name: 'airplane', group: 'Travel & Places' },
    { emoji: '⚔️', name: 'crossed swords', group: 'Objects' },
    { emoji: '💊', name: 'pill', group: 'Objects' },
    { emoji: '🍺', name: 'beer mug', group: 'Food & Drink' }
  ];

  const GROUP_TABS = [
    { id: 'Recent', icon: '🕒', label: 'Recent' },
    { id: 'Smileys & Emotion', icon: '😀', label: 'Smileys' },
    { id: 'People & Body', icon: '👋', label: 'People' },
    { id: 'Animals & Nature', icon: '🐻', label: 'Animals' },
    { id: 'Food & Drink', icon: '🍔', label: 'Food' },
    { id: 'Travel & Places', icon: '✈️', label: 'Travel' },
    { id: 'Activities', icon: '⚽', label: 'Activities' },
    { id: 'Objects', icon: '⚔️', label: 'Objects' },
    { id: 'Symbols', icon: '💯', label: 'Symbols' },
    { id: 'Flags', icon: '🏁', label: 'Flags' }
  ];

  const GENERIC_URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
  const DIRECT_MEDIA_REGEX =
    /^https?:\/\/(?:[^\s<>"']+\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"']*)?|(?:media\.tenor\.com|media\d*\.giphy\.com|i\.imgur\.com|files\.catbox\.moe|iili\.io)\/[^\s<>"']+)$/i;

  let cachedEmojiList = null;

  function extractDirectMediaUrls(text) {
    const rawUrls = text.match(GENERIC_URL_REGEX) || [];
    const results = [];

    rawUrls.forEach((raw) => {
      if (raw.endsWith('...') || raw.endsWith('…')) return;

      let candidate = raw;
      try {
        const parsed = new URL(raw);
        if (parsed.hostname.includes('google.') && parsed.pathname === '/imgres') {
          const unwrapped = parsed.searchParams.get('imgurl');
          if (unwrapped) candidate = unwrapped;
        }
      } catch {
        // Keep original candidate
      }

      if (DIRECT_MEDIA_REGEX.test(candidate)) {
        results.push(candidate);
      }
    });

    return [...new Set(results)];
  }

  function crossOriginRequest({ method = 'GET', url, data, headers = {} }) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'function') {
        GM_xmlhttpRequest({
          method,
          url,
          data,
          headers,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300) {
              resolve(res.responseText);
            } else {
              reject(new Error(`HTTP ${res.status}`));
            }
          },
          onerror: () => reject(new Error('Network error'))
        });
      } else {
        fetch(url, { method, body: data, headers })
          .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then(resolve)
          .catch(reject);
      }
    });
  }

  async function getEmojiCatalog() {
    if (cachedEmojiList) return cachedEmojiList;

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.emojiCatalog);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 100) {
          cachedEmojiList = parsed;
          return cachedEmojiList;
        }
      }
    } catch {
      // Ignore
    }

    try {
      const raw = await crossOriginRequest({ url: EMOJI_API_URL });
      const grouped = JSON.parse(raw);
      const flat = [];

      const groups = Array.isArray(grouped)
        ? grouped
        : Object.entries(grouped).map(([name, emojis]) => ({ name, emojis }));

      groups.forEach((grp) => {
        (grp.emojis || []).forEach((item) => {
          if (item.emoji && item.name) {
            flat.push({
              emoji: item.emoji,
              name: item.name.toLowerCase(),
              group: grp.name
            });
          }
        });
      });

      if (flat.length > 100) {
        cachedEmojiList = flat;
        try {
          localStorage.setItem(STORAGE_KEYS.emojiCatalog, JSON.stringify(flat));
        } catch {
          // Ignore
        }
        return cachedEmojiList;
      }
    } catch {
      // Fall through
    }

    cachedEmojiList = FALLBACK_EMOJIS;
    return cachedEmojiList;
  }

  function getRecentEmojis() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.recentEmojis) || '[]');
      if (Array.isArray(stored) && stored.length) return stored;
    } catch {
      // Ignore
    }
    return FALLBACK_EMOJIS.map((e) => e.emoji);
  }

  function recordRecentEmoji(emoji) {
    try {
      const current = getRecentEmojis().filter((e) => e !== emoji);
      current.unshift(emoji);
      localStorage.setItem(
        STORAGE_KEYS.recentEmojis,
        JSON.stringify(current.slice(0, 32))
      );
    } catch {
      // Ignore
    }
  }

  function compressImageToBase64(fileBlob, maxDim = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (fileBlob.type === 'image/gif' && fileBlob.size < 2.5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',')[1]);
        reader.onerror = () => reject(new Error('GIF read error'));
        reader.readAsDataURL(fileBlob);
        return;
      }

      const objectUrl = URL.createObjectURL(fileBlob);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        if (base64) resolve(base64);
        else reject(new Error('Canvas compression failed'));
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image file'));
      };

      img.src = objectUrl;
    });
  }

  async function uploadImageToHost(fileBlob) {
    const base64Data = await compressImageToBase64(fileBlob);

    try {
      const body = new URLSearchParams({
        key: '6d207e02198a847aa98d0a2a901485a5',
        action: 'upload',
        source: base64Data,
        format: 'json'
      }).toString();

      const raw = await crossOriginRequest({
        method: 'POST',
        url: 'https://freeimage.host/api/1/upload',
        data: body,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const parsed = JSON.parse(raw);
      const directUrl = parsed?.image?.url || parsed?.image?.display_url;
      if (directUrl) return directUrl;
    } catch {
      // Fall through to mobile-compatible native fetch uploader
    }

    const imgurForm = new FormData();
    imgurForm.append('image', base64Data);
    imgurForm.append('type', 'base64');

    const res = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: 'Client-ID 546c25a59c58ad7'
      },
      body: imgurForm
    });

    if (!res.ok) {
      throw new Error(`Imgur HTTP ${res.status}`);
    }

    const imgurJson = await res.json();
    if (imgurJson?.success && imgurJson?.data?.link) {
      return imgurJson.data.link;
    }

    throw new Error('All upload hosts failed');
  }

  async function searchGiphyGifs(query, apiKey) {
    const endpoint = query.trim()
      ? `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
          apiKey
        )}&q=${encodeURIComponent(query)}&limit=12&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${encodeURIComponent(
          apiKey
        )}&limit=12&rating=pg-13`;

    const raw = await crossOriginRequest({ url: endpoint });
    const parsed = JSON.parse(raw);
    return (parsed.data || []).map((item) => ({
      preview:
        item.images?.fixed_width_small?.url ||
        item.images?.fixed_height_small?.url ||
        item.images?.downsized?.url,
      full:
        item.images?.downsized?.url ||
        item.images?.fixed_height?.url ||
        item.images?.original?.url
    }));
  }

  function insertTextIntoReactTextarea(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const nextValue =
      textarea.value.substring(0, start) + text + textarea.value.substring(end);

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ).set;

    nativeSetter.call(textarea, nextValue);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    const cursorPos = start + text.length;
    textarea.focus();
    textarea.setSelectionRange(cursorPos, cursorPos);
  }

  function openLightbox(src) {
    let overlay = document.getElementById('tmc-lightbox');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'tmc-lightbox';
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '999999',
        cursor: 'zoom-out',
        padding: '24px'
      });
      overlay.addEventListener('click', () => (overlay.style.display = 'none'));
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '';
    const img = document.createElement('img');
    img.src = src;
    Object.assign(img.style, {
      maxWidth: '90vw',
      maxHeight: '90vh',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)'
    });
    overlay.appendChild(img);
    overlay.style.display = 'flex';
  }

  function renderInlineMedia(root) {
    const chatWindows = [...root.querySelectorAll(SELECTORS.textarea)]
      .map((ta) => ta.closest('[class*="root___"]')?.parentElement?.parentElement)
      .filter(Boolean);

    chatWindows.forEach((win) => {
      const candidates = win.querySelectorAll(
        '[class*="message___"], [class*="text___"], [class*="content___"]'
      );

      candidates.forEach((node) => {
        if (
          node.dataset.tmcMediaChecked === '1' ||
          node.closest('.tmc-anchor') ||
          node.querySelector('textarea')
        ) {
          return;
        }

        const text = node.textContent || '';
        const uniqueUrls = extractDirectMediaUrls(text);
        node.dataset.tmcMediaChecked = '1';
        if (!uniqueUrls.length) return;

        const mediaWrap = document.createElement('div');
        Object.assign(mediaWrap.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          marginTop: '4px'
        });

        uniqueUrls.forEach((url) => {
          const img = document.createElement('img');
          img.src = url;
          img.loading = 'lazy';
          img.title = 'Click to expand';
          Object.assign(img.style, {
            maxWidth: '100%',
            maxHeight: '160px',
            objectFit: 'contain',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.25)',
            cursor: 'zoom-in',
            alignSelf: 'flex-start'
          });

          img.addEventListener('error', () => img.remove());
          img.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openLightbox(url);
          });

          mediaWrap.appendChild(img);
        });

        if (mediaWrap.childElementCount > 0) {
          node.appendChild(mediaWrap);
        }
      });
    });
  }

  function buildDrawerContent(type, textarea, closeDrawer) {
    const wrap = document.createElement('div');

    // 1. DYNAMIC SEARCHABLE EMOJI PICKER
    if (type === 'emoji') {
      Object.assign(wrap.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      });

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search 1,800+ emojis (e.g. sword, laugh, fire)...';
      Object.assign(searchInput.style, {
        width: '100%',
        boxSizing: 'border-box',
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: '4px',
        color: '#e5e5e5',
        fontSize: '12px',
        padding: '5px 8px',
        outline: 'none'
      });

      const tabBar = document.createElement('div');
      Object.assign(tabBar.style, {
        display: 'flex',
        justifyContent: 'space-between',
        borderBottom: '1px solid #383838',
        paddingBottom: '4px',
        gap: '2px'
      });

      const grid = document.createElement('div');
      Object.assign(grid.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '2px',
        maxHeight: '145px',
        overflowY: 'auto',
        paddingRight: '2px'
      });

      let currentGroup = 'Smileys & Emotion';
      let fullCatalog = [];
      const tabButtons = {};

      const renderEmojiItems = (items) => {
        grid.innerHTML = '';
        if (!items.length) {
          grid.style.display = 'block';
          grid.innerHTML =
            '<div style="font-size:11px;color:#888;padding:8px 2px;text-align:center;">No matching emojis</div>';
          return;
        }
        grid.style.display = 'grid';

        items.slice(0, 160).forEach((entry) => {
          const emojiChar = typeof entry === 'string' ? entry : entry.emoji;
          const emojiTitle = typeof entry === 'string' ? '' : entry.name;

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = emojiChar;
          if (emojiTitle) btn.title = emojiTitle;
          Object.assign(btn.style, {
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '15px',
            padding: '4px 0',
            borderRadius: '4px',
            lineHeight: '1'
          });
          btn.addEventListener(
            'mouseenter',
            () => (btn.style.background = 'rgba(255,255,255,0.12)')
          );
          btn.addEventListener('mouseleave', () => (btn.style.background = 'transparent'));
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            recordRecentEmoji(emojiChar);
            insertTextIntoReactTextarea(textarea, emojiChar);
          });
          grid.appendChild(btn);
        });
      };

      const updateView = () => {
        const q = searchInput.value.trim().toLowerCase();
        Object.entries(tabButtons).forEach(([id, btn]) => {
          btn.style.background = !q && id === currentGroup ? 'rgba(255,255,255,0.14)' : 'transparent';
        });

        if (q) {
          const filtered = fullCatalog.filter((item) => item.name.includes(q));
          renderEmojiItems(filtered);
          return;
        }

        if (currentGroup === 'Recent') {
          renderEmojiItems(getRecentEmojis());
          return;
        }

        const inGroup = fullCatalog.filter((item) => item.group === currentGroup);
        renderEmojiItems(inGroup);
      };

      GROUP_TABS.forEach(({ id, icon, label }) => {
        const tBtn = document.createElement('button');
        tBtn.type = 'button';
        tBtn.textContent = icon;
        tBtn.title = label;
        Object.assign(tBtn.style, {
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          padding: '3px 4px',
          borderRadius: '4px',
          lineHeight: '1'
        });
        tBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          searchInput.value = '';
          currentGroup = id;
          updateView();
        });
        tabButtons[id] = tBtn;
        tabBar.appendChild(tBtn);
      });

      searchInput.addEventListener('input', updateView);
      searchInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') closeDrawer();
      });

      grid.innerHTML =
        '<div style="font-size:11px;color:#a3a3a3;padding:8px 2px;">Loading emoji catalog...</div>';
      wrap.append(searchInput, tabBar, grid);

      getEmojiCatalog().then((catalog) => {
        fullCatalog = catalog;
        updateView();
      });

      setTimeout(() => searchInput.focus(), 0);
      return wrap;
    }

    // 2. IMAGE UPLOAD (File / Ctrl+V Paste / URL)
    if (type === 'image') {
      Object.assign(wrap.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      });

      const status = document.createElement('div');
      status.textContent = 'Paste a screenshot (Ctrl+V), upload a file, or enter URL:';
      Object.assign(status.style, {
        fontSize: '11px',
        color: '#a3a3a3'
      });

      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '6px' });

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'https://... or Ctrl+V image';
      Object.assign(input.style, {
        flex: '1',
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: '4px',
        color: '#e5e5e5',
        fontSize: '12px',
        padding: '5px 8px',
        outline: 'none'
      });

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      const uploadBtn = document.createElement('button');
      uploadBtn.type = 'button';
      uploadBtn.textContent = 'Upload';
      Object.assign(uploadBtn.style, {
        background: '#2f5d3a',
        border: '1px solid #3f7d4e',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '11px',
        padding: '5px 8px',
        cursor: 'pointer'
      });

      const insertBtn = document.createElement('button');
      insertBtn.type = 'button';
      insertBtn.textContent = 'Insert';
      Object.assign(insertBtn.style, {
        background: '#3a3a3a',
        border: '1px solid #555',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '11px',
        padding: '5px 8px',
        cursor: 'pointer'
      });

      const handleFileUpload = async (file) => {
        if (!file) return;
        status.textContent = 'Compressing & uploading image...';
        status.style.color = '#eab308';
        uploadBtn.disabled = true;
        try {
          const hostedUrl = await uploadImageToHost(file);
          const prefix = textarea.value && !textarea.value.endsWith(' ') ? ' ' : '';
          insertTextIntoReactTextarea(textarea, `${prefix}${hostedUrl} `);
          closeDrawer();
        } catch (err) {
          status.textContent = `Upload failed (${err.message}). Paste direct URL instead.`;
          status.style.color = '#f87171';
          uploadBtn.disabled = false;
        }
      };

      uploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files?.[0]) handleFileUpload(fileInput.files[0]);
      });

      input.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items || [];
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            handleFileUpload(item.getAsFile());
            return;
          }
        }
      });

      const commitUrl = () => {
        const val = input.value.trim();
        if (!val) return;
        const unwrapped = extractDirectMediaUrls(val)[0] || val;
        const prefix = textarea.value && !textarea.value.endsWith(' ') ? ' ' : '';
        insertTextIntoReactTextarea(textarea, `${prefix}${unwrapped} `);
        closeDrawer();
      };

      insertBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        commitUrl();
      });

      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commitUrl();
        } else if (e.key === 'Escape') {
          closeDrawer();
        }
      });

      row.append(input, uploadBtn, insertBtn, fileInput);
      wrap.append(status, row);
      setTimeout(() => input.focus(), 0);
      return wrap;
    }

    // 3. LIVE GIF SEARCH (Giphy with Self-Service Free API Key Setup)
    if (type === 'gif') {
      Object.assign(wrap.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      });

      const topRow = document.createElement('div');
      Object.assign(topRow.style, { display: 'flex', gap: '4px' });

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = 'Search Giphy GIFs or paste .gif URL...';
      Object.assign(searchInput.style, {
        flex: '1',
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: '4px',
        color: '#e5e5e5',
        fontSize: '12px',
        padding: '5px 8px',
        outline: 'none'
      });

      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.textContent = '🔑';
      keyBtn.title = 'Set Giphy API Key';
      Object.assign(keyBtn.style, {
        background: '#2c2c2c',
        border: '1px solid #444',
        borderRadius: '4px',
        color: '#ccc',
        fontSize: '11px',
        padding: '0 6px',
        cursor: 'pointer'
      });

      const grid = document.createElement('div');
      Object.assign(grid.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px',
        maxHeight: '140px',
        overflowY: 'auto'
      });

      const showKeySetup = (errorNote = '') => {
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gap = '6px';
        grid.innerHTML = '';

        const info = document.createElement('div');
        info.innerHTML = `${
          errorNote ? `<span style="color:#f87171;">${errorNote}</span><br>` : ''
        }Enter a free <a href="https://developers.giphy.com/dashboard/" target="_blank" style="color:#60a5fa;text-decoration:underline;">Giphy API Key</a> to enable live search (or paste any .gif URL above):`;
        Object.assign(info.style, {
          fontSize: '11px',
          color: '#b5b5b5',
          lineHeight: '1.35'
        });

        const keyRow = document.createElement('div');
        Object.assign(keyRow.style, { display: 'flex', gap: '4px' });

        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.placeholder = 'Paste Giphy API key...';
        keyInput.value = localStorage.getItem(STORAGE_KEYS.giphyApiKey) || '';
        Object.assign(keyInput.style, {
          flex: '1',
          background: '#1e1e1e',
          border: '1px solid #444',
          borderRadius: '4px',
          color: '#e5e5e5',
          fontSize: '11px',
          padding: '4px 6px',
          outline: 'none'
        });

        const saveKeyBtn = document.createElement('button');
        saveKeyBtn.type = 'button';
        saveKeyBtn.textContent = 'Save';
        Object.assign(saveKeyBtn.style, {
          background: '#2f5d3a',
          border: '1px solid #3f7d4e',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '11px',
          padding: '4px 8px',
          cursor: 'pointer'
        });

        const saveKey = () => {
          const k = keyInput.value.trim();
          if (!k) return;
          localStorage.setItem(STORAGE_KEYS.giphyApiKey, k);
          loadGifs(searchInput.value.trim());
        };

        saveKeyBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          saveKey();
        });
        keyInput.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            saveKey();
          }
        });

        keyRow.append(keyInput, saveKeyBtn);
        grid.append(info, keyRow);
      };

      const loadGifs = async (q = '') => {
        const apiKey = localStorage.getItem(STORAGE_KEYS.giphyApiKey) || '';
        if (!apiKey) {
          showKeySetup();
          return;
        }

        grid.style.display = 'block';
        grid.innerHTML =
          '<div style="font-size:11px;color:#a3a3a3;padding:6px 2px;">Loading GIFs...</div>';

        try {
          const results = await searchGiphyGifs(q, apiKey);
          if (!results.length) {
            grid.innerHTML =
              '<div style="font-size:11px;color:#a3a3a3;padding:6px 2px;">No GIFs found.</div>';
            return;
          }
          grid.style.display = 'grid';
          grid.style.flexDirection = '';
          grid.innerHTML = '';
          results.forEach(({ preview, full }) => {
            if (!preview || !full) return;
            const img = document.createElement('img');
            img.src = preview;
            img.loading = 'lazy';
            Object.assign(img.style, {
              width: '100%',
              height: '56px',
              objectFit: 'cover',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid transparent'
            });
            img.addEventListener('mouseenter', () => (img.style.borderColor = '#fff'));
            img.addEventListener('mouseleave', () => (img.style.borderColor = 'transparent'));
            img.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const prefix = textarea.value && !textarea.value.endsWith(' ') ? ' ' : '';
              insertTextIntoReactTextarea(textarea, `${prefix}${full} `);
              closeDrawer();
            });
            grid.appendChild(img);
          });
        } catch (err) {
          showKeySetup(`API error (${err.message}).`);
        }
      };

      keyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showKeySetup();
      });

      let debounceTimer;
      searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim();
        if (/^https?:\/\//i.test(val)) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadGifs(val), 300);
      });

      searchInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = searchInput.value.trim();
          if (/^https?:\/\//i.test(val)) {
            const prefix = textarea.value && !textarea.value.endsWith(' ') ? ' ' : '';
            insertTextIntoReactTextarea(textarea, `${prefix}${val} `);
            closeDrawer();
          } else {
            loadGifs(val);
          }
        } else if (e.key === 'Escape') {
          closeDrawer();
        }
      });

      topRow.append(searchInput, keyBtn);
      wrap.append(topRow, grid);
      loadGifs('');
      setTimeout(() => searchInput.focus(), 0);
      return wrap;
    }

    return wrap;
  }

  function injectToolbar(textarea) {
    const inputRow = textarea.closest(SELECTORS.wrapper) || textarea.parentElement;
    const footerContainer = inputRow?.parentElement;
    if (!footerContainer || footerContainer.querySelector('.tmc-anchor')) return;

    let activeTab = null;

    const anchor = document.createElement('div');
    anchor.className = 'tmc-anchor';
    Object.assign(anchor.style, {
      position: 'relative',
      width: '100%'
    });

    const drawer = document.createElement('div');
    drawer.className = 'tmc-media-drawer';
    Object.assign(drawer.style, {
      display: 'none',
      position: 'absolute',
      bottom: '100%',
      left: '6px',
      right: '6px',
      marginBottom: '4px',
      background: '#262626',
      border: '1px solid #3d3d3d',
      borderRadius: '6px',
      padding: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
      zIndex: '9999'
    });

    const bar = document.createElement('div');
    bar.className = 'tmc-media-toolbar';
    Object.assign(bar.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 10px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      width: '100%',
      boxSizing: 'border-box',
      userSelect: 'none'
    });

    const leftGroup = document.createElement('div');
    Object.assign(leftGroup.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    });

    const rightLabel = document.createElement('span');
    rightLabel.textContent = 'Media toolbar';
    Object.assign(rightLabel.style, {
      fontSize: '11px',
      color: 'rgba(255, 255, 255, 0.45)',
      letterSpacing: '0.2px'
    });

    const buttons = {};

    const closeDrawer = () => {
      activeTab = null;
      drawer.style.display = 'none';
      drawer.innerHTML = '';
      Object.values(buttons).forEach((b) => {
        b.style.color = '#b5b5b5';
      });
    };

    const toggleTab = (key) => {
      if (activeTab === key) {
        closeDrawer();
        return;
      }
      activeTab = key;
      Object.entries(buttons).forEach(([k, b]) => {
        b.style.color = k === key ? '#ffffff' : '#b5b5b5';
      });
      drawer.innerHTML = '';
      drawer.appendChild(buildDrawerContent(key, textarea, closeDrawer));
      drawer.style.display = 'block';
    };

    [
      { key: 'emoji', title: 'Emojis (1,800+)' },
      { key: 'image', title: 'Upload or Paste Image' },
      { key: 'gif', title: 'Search GIFs' }
    ].forEach(({ key, title }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = title;
      btn.innerHTML = ICONS[key];
      Object.assign(btn.style, {
        background: 'transparent',
        border: 'none',
        color: '#b5b5b5',
        cursor: 'pointer',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.15s ease'
      });

      btn.addEventListener('mouseenter', () => {
        if (activeTab !== key) btn.style.color = '#ffffff';
      });
      btn.addEventListener('mouseleave', () => {
        if (activeTab !== key) btn.style.color = '#b5b5b5';
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTab(key);
      });

      buttons[key] = btn;
      leftGroup.appendChild(btn);
    });

    document.addEventListener('click', (e) => {
      if (activeTab && !anchor.contains(e.target)) {
        closeDrawer();
      }
    });

    bar.append(leftGroup, rightLabel);
    anchor.append(drawer, bar);
    footerContainer.insertBefore(anchor, inputRow);
  }

  function scanAllChats() {
    const root = document.querySelector(SELECTORS.chatRoot) || document.body;
    root.querySelectorAll(SELECTORS.textarea).forEach((textarea) => {
      injectToolbar(textarea);
    });
    renderInlineMedia(root);
  }

  const observer = new MutationObserver(() => {
    scanAllChats();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  scanAllChats();
  console.log('Torn Media Chat v1.6 initialized.');
})();
