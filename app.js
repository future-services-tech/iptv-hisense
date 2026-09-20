/* ============================================================
   app.js — IPTV Italia Player
   Logic principale: state, rendering, player HLS, navigazione
   ============================================================ */

'use strict';

(function () {

  // ══════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════
  var state = {
    allChannels:     [],  // Tutti i canali caricati
    filteredChannels:[],  // Canali dopo filtro categoria + ricerca
    categories:      [],  // ['Tutti', 'General', 'News', ...]
    activeCategory:  'Tutti',
    searchQuery:     '',

    selectedIndex:   0,   // Indice focalizzato nella lista filtrata
    playingIndex:    -1,  // Indice del canale in riproduzione
    currentChannel:  null,

    hls:             null,  // Istanza HLS.js
    isFullscreen:    false, // Sidebar nascosta?
    osdTimer:        null,  // Timer auto-hide OSD
    fsHintTimer:     null,  // Timer auto-hide fs-hint
    dialBuffer:      '',    // Buffer dial numerico
    retryCount:      0,
    MAX_RETRY:       2,
    isSearchOpen:    false,
  };

  // ══════════════════════════════════════════════════════════
  // DOM CACHE
  // ══════════════════════════════════════════════════════════
  var el = {};

  function cacheDOM() {
    el.loadingScreen  = $('loading-screen');
    el.loadingProg    = $('loading-progress');
    el.loadingText    = $('loading-text');
    el.errorScreen    = $('error-screen');
    el.errorDetail    = $('error-detail');
    el.retryBtn       = $('retry-btn');
    el.app            = $('app');
    el.sidebar        = $('sidebar');
    el.categories     = $('categories');
    el.searchInput    = $('search-input');
    el.searchClear    = $('search-clear');
    el.channelList    = $('channel-list');
    el.channelCount   = $('channel-count');
    el.videoPlayer    = $('video-player');
    el.placeholder    = $('placeholder');
    el.streamLoading  = $('stream-loading');
    el.streamError    = $('stream-error');
    el.streamErrorMsg = $('stream-error-msg');
    el.osd            = $('osd');
    el.osdNumber      = $('osd-number');
    el.osdName        = $('osd-name');
    el.osdGroup       = $('osd-group');
    el.osdLogo        = $('osd-logo');
    el.fsHint         = $('fs-hint');
  }

  function $(id) { return document.getElementById(id); }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function () {
    cacheDOM();
    setupEvents();
    loadChannels();
  });

  function setupEvents() {
    // Retry button
    el.retryBtn.addEventListener('click', function () {
      hideEl(el.errorScreen);
      loadChannels();
    });

    // Search input events
    el.searchInput.addEventListener('input', function () {
      state.searchQuery = el.searchInput.value.trim();
      toggleClass(el.searchClear, 'hidden', !state.searchQuery);
      applyFilters();
    });

    el.searchClear.addEventListener('click', function () {
      clearSearch();
    });

    // Remote control
    Remote.init(handleAction);
  }

  // ══════════════════════════════════════════════════════════
  // PLAYLIST LOADING
  // ══════════════════════════════════════════════════════════
  async function loadChannels() {
    showLoading('Recupero canali italiani da iptv-org…');
    setProgress(10);

    try {
      var channels = await Parser.fetchPlaylist();
      setProgress(75);
      setLoadingText(channels.length + ' canali trovati, preparazione…');

      if (channels.length === 0) {
        throw new Error('Nessun canale trovato nella playlist');
      }

      state.allChannels      = channels;
      state.filteredChannels = channels.slice();
      state.categories       = Parser.extractCategories(channels);
      state.activeCategory   = 'Tutti';
      state.selectedIndex    = 0;
      state.playingIndex     = -1;
      state.currentChannel   = null;

      setProgress(95);
      renderCategories();
      renderChannels();

      setProgress(100);
      setTimeout(showApp, 600);

    } catch (err) {
      console.error('[IPTV] Errore caricamento playlist:', err);
      showErrorScreen('Impossibile caricare la lista canali.\n' + err.message);
    }
  }

  // ══════════════════════════════════════════════════════════
  // RENDERING
  // ══════════════════════════════════════════════════════════

  /** Renderizza i tab categoria */
  function renderCategories() {
    el.categories.innerHTML = '';
    state.categories.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.className  = 'cat-tab' + (cat === state.activeCategory ? ' active' : '');
      btn.textContent = cat;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', cat === state.activeCategory ? 'true' : 'false');
      btn.addEventListener('click', function () { selectCategory(cat); });
      el.categories.appendChild(btn);
    });
  }

  /** Renderizza la lista canali filtrata */
  function renderChannels() {
    var list = state.filteredChannels;
    el.channelCount.textContent = list.length + ' canal' + (list.length === 1 ? 'e' : 'i');

    if (list.length === 0) {
      el.channelList.innerHTML = '<div class="no-results">Nessun canale trovato</div>';
      return;
    }

    // Usa un DocumentFragment per performance
    var frag = document.createDocumentFragment();

    list.forEach(function (ch, idx) {
      var item = buildChannelItem(ch, idx);
      frag.appendChild(item);
    });

    el.channelList.innerHTML = '';
    el.channelList.appendChild(frag);

    // Ripristina highlight dopo re-render
    updateChannelHighlight();
    scrollToSelected();
  }

  /** Costruisce un singolo elemento channel-item */
  function buildChannelItem(ch, idx) {
    var item = document.createElement('div');
    item.className   = 'channel-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-idx', idx);
    item.setAttribute('aria-label', 'Canale ' + ch.num + ': ' + ch.name);

    // Numero
    var numEl = document.createElement('span');
    numEl.className   = 'ch-num';
    numEl.textContent = ch.num;

    // Logo
    var logoWrap = document.createElement('div');
    logoWrap.className = 'ch-logo-wrap';

    if (ch.logo) {
      var img = document.createElement('img');
      img.className   = 'ch-logo';
      img.src         = ch.logo;
      img.alt         = ch.name;
      img.loading     = 'lazy';
      img.onerror     = function () {
        logoWrap.innerHTML = '<span class="ch-logo-fallback">📺</span>';
      };
      logoWrap.appendChild(img);
    } else {
      var fallback = document.createElement('span');
      fallback.className   = 'ch-logo-fallback';
      fallback.textContent = '📺';
      logoWrap.appendChild(fallback);
    }

    // Info
    var info = document.createElement('div');
    info.className = 'ch-info';

    var nameEl = document.createElement('span');
    nameEl.className   = 'ch-name';
    nameEl.textContent = ch.name;

    var groupEl = document.createElement('span');
    groupEl.className   = 'ch-group';
    groupEl.textContent = ch.group || '';

    info.appendChild(nameEl);
    info.appendChild(groupEl);

    // Live indicator (visibile solo quando in riproduzione)
    var liveEl = document.createElement('span');
    liveEl.className = 'ch-live-indicator';

    item.appendChild(numEl);
    item.appendChild(logoWrap);
    item.appendChild(info);
    item.appendChild(liveEl);

    // Click handler
    item.addEventListener('click', function () {
      state.selectedIndex = idx;
      updateChannelHighlight();
      playSelectedChannel();
    });

    return item;
  }

  /** Aggiorna le classi CSS focused/playing nella lista */
  function updateChannelHighlight() {
    var items = el.channelList.querySelectorAll('.channel-item');
    items.forEach(function (item, i) {
      var isFocused = i === state.selectedIndex;
      var isPlaying = i === state.playingIndex;
      toggleClass(item, 'focused', isFocused);
      toggleClass(item, 'playing', isPlaying);
    });
  }

  /** Scorre la lista per mantenere l'elemento selezionato in vista */
  function scrollToSelected() {
    var items = el.channelList.querySelectorAll('.channel-item');
    if (items.length === 0) return;

    var idx  = Math.min(state.selectedIndex, items.length - 1);
    var item = items[idx];
    if (!item) return;

    var listRect = el.channelList.getBoundingClientRect();
    var itemRect = item.getBoundingClientRect();

    if (itemRect.top < listRect.top) {
      el.channelList.scrollTop -= (listRect.top - itemRect.top + 16);
    } else if (itemRect.bottom > listRect.bottom) {
      el.channelList.scrollTop += (itemRect.bottom - listRect.bottom + 16);
    }
  }

  // ══════════════════════════════════════════════════════════
  // FILTERING
  // ══════════════════════════════════════════════════════════

  function selectCategory(cat) {
    state.activeCategory = cat;
    renderCategories();
    applyFilters();
  }

  function applyFilters() {
    var q   = state.searchQuery.toLowerCase();
    var cat = state.activeCategory;

    state.filteredChannels = state.allChannels.filter(function (ch) {
      var matchCat  = cat === 'Tutti' || ch.group === cat;
      var matchSearch = !q || ch.name.toLowerCase().includes(q) ||
                        (ch.group && ch.group.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });

    state.selectedIndex = 0;
    renderChannels();
  }

  function clearSearch() {
    el.searchInput.value = '';
    state.searchQuery = '';
    addClass(el.searchClear, 'hidden');
    applyFilters();
    el.searchInput.blur();
  }

  // ══════════════════════════════════════════════════════════
  // VIDEO PLAYER — HLS.js
  // ══════════════════════════════════════════════════════════

  /** Riproduce il canale attualmente selezionato */
  function playSelectedChannel() {
    var ch = state.filteredChannels[state.selectedIndex];
    if (!ch) return;

    state.playingIndex  = state.selectedIndex;
    state.currentChannel = ch;
    state.retryCount    = 0;

    updateChannelHighlight();
    playStream(ch);
    showOSD(ch);
    showFsHint();
  }

  /** Avvia la riproduzione di uno stream */
  function playStream(ch) {
    hideEl(el.placeholder);
    hideEl(el.streamError);
    showEl(el.streamLoading);

    // Distruggi istanza HLS precedente
    destroyHls();

    var video = el.videoPlayer;
    var url   = ch.url;

    // Supporto HLS nativo (Safari, alcuni browser TV)
    if (!window.Hls) {
      video.src = url;
      video.load();
      video.play().catch(function (e) {
        console.warn('[IPTV] Autoplay bloccato:', e);
      });
      hideEl(el.streamLoading);
      return;
    }

    if (Hls.isSupported()) {
      // Usa HLS.js
      var hls = new Hls({
        enableWorker:       false,  // Disabilita worker per compatibilità TV
        lowLatencyMode:     false,
        maxBufferLength:    30,
        maxBufferSize:      60 * 1000 * 1000, // 60MB
        startFragPrefetch:  true,
        manifestLoadingTimeOut:  10000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut:     10000,
        fragLoadingTimeOut:      20000,
      });

      hls.loadSource(url);
      hls.attachMedia(video);
      state.hls = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        hideEl(el.streamLoading);
        video.play().catch(function (e) {
          console.warn('[IPTV] Autoplay bloccato:', e);
        });
      });

      hls.on(Hls.Events.ERROR, function (event, data) {
        console.warn('[IPTV] HLS error:', data.type, data.details, data.fatal);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (state.retryCount < state.MAX_RETRY) {
                state.retryCount++;
                console.log('[IPTV] Retry #' + state.retryCount);
                setTimeout(function () { hls.startLoad(); }, 2000);
              } else {
                showStreamError('Canale non raggiungibile. Rete o CORS.');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (state.retryCount < state.MAX_RETRY) {
                state.retryCount++;
                hls.recoverMediaError();
              } else {
                showStreamError('Errore media. Formato non supportato.');
              }
              break;
            default:
              showStreamError('Canale non disponibile');
              break;
          }
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // HLS nativo (Safari / WebKit)
      video.src = url;
      video.load();
      hideEl(el.streamLoading);
      video.play().catch(function () {});

    } else {
      showStreamError('Formato non supportato in questo browser');
    }
  }

  function destroyHls() {
    if (state.hls) {
      state.hls.destroy();
      state.hls = null;
    }
    el.videoPlayer.src = '';
  }

  function showStreamError(msg) {
    hideEl(el.streamLoading);
    el.streamErrorMsg.textContent = msg || 'Canale non disponibile';
    showEl(el.streamError);
  }

  // ══════════════════════════════════════════════════════════
  // OSD (On Screen Display)
  // ══════════════════════════════════════════════════════════

  function showOSD(ch) {
    clearTimeout(state.osdTimer);

    // Popola OSD
    el.osdNumber.textContent = 'Canale ' + ch.num;
    el.osdName.textContent   = ch.name;
    el.osdGroup.textContent  = ch.group || '';
    el.osdLogo.src           = ch.logo || '';
    el.osdLogo.style.display = ch.logo ? 'block' : 'none';

    // Mostra
    removeClass(el.osd, 'hidden');
    removeClass(el.osd, 'osd--hiding');

    // Auto-hide dopo 4s
    state.osdTimer = setTimeout(function () {
      hideOSD();
    }, 4000);
  }

  function hideOSD() {
    clearTimeout(state.osdTimer);
    addClass(el.osd, 'osd--hiding');
    setTimeout(function () {
      addClass(el.osd, 'hidden');
      removeClass(el.osd, 'osd--hiding');
    }, 280);
  }

  // ══════════════════════════════════════════════════════════
  // FULLSCREEN (sidebar toggle)
  // ══════════════════════════════════════════════════════════

  function toggleFullscreen() {
    state.isFullscreen = !state.isFullscreen;
    toggleClass(el.app, 'fullscreen', state.isFullscreen);

    if (!state.isFullscreen) {
      // Tornando alla lista, aggiorna highlight
      updateChannelHighlight();
      scrollToSelected();
    }
  }

  function showFsHint() {
    clearTimeout(state.fsHintTimer);
    removeClass(el.fsHint, 'hidden');
    state.fsHintTimer = setTimeout(function () {
      addClass(el.fsHint, 'hidden');
    }, 3000);
  }

  function exitFullscreen() {
    if (state.isFullscreen) {
      state.isFullscreen = false;
      removeClass(el.app, 'fullscreen');
      updateChannelHighlight();
      scrollToSelected();
    }
  }

  // ══════════════════════════════════════════════════════════
  // REMOTE CONTROL HANDLER
  // ══════════════════════════════════════════════════════════

  function handleAction(action, e) {
    var len = state.filteredChannels.length;
    if (len === 0) return;

    switch (action) {

      case 'NAV_UP':
        if (state.isFullscreen) {
          // In fullscreen UP = canale precedente
          navigateChannel(-1);
        } else {
          state.selectedIndex = Math.max(0, state.selectedIndex - 1);
          updateChannelHighlight();
          scrollToSelected();
        }
        break;

      case 'NAV_DOWN':
        if (state.isFullscreen) {
          // In fullscreen DOWN = canale successivo
          navigateChannel(+1);
        } else {
          state.selectedIndex = Math.min(len - 1, state.selectedIndex + 1);
          updateChannelHighlight();
          scrollToSelected();
        }
        break;

      case 'NAV_LEFT':
        // Uscita da fullscreen → torna a sidebar
        if (state.isFullscreen) exitFullscreen();
        break;

      case 'NAV_RIGHT':
        // Entra in fullscreen se un canale è in riproduzione
        if (!state.isFullscreen && state.currentChannel) {
          state.isFullscreen = true;
          addClass(el.app, 'fullscreen');
        }
        break;

      case 'SELECT':
        if (state.isFullscreen) {
          // OK in fullscreen → mostra/nascondi OSD
          if (hasClass(el.osd, 'hidden')) {
            showOSD(state.currentChannel);
          } else {
            hideOSD();
          }
        } else {
          playSelectedChannel();
          // Vai in fullscreen dopo la selezione
          setTimeout(function () {
            if (state.currentChannel) {
              state.isFullscreen = true;
              addClass(el.app, 'fullscreen');
            }
          }, 300);
        }
        break;

      case 'BACK':
        if (state.isFullscreen) {
          // Back da fullscreen → torna alla lista
          exitFullscreen();
        } else if (state.searchQuery) {
          clearSearch();
        } else if (state.activeCategory !== 'Tutti') {
          selectCategory('Tutti');
        }
        break;

      case 'TOGGLE_SIDEBAR':
        toggleFullscreen();
        break;

      case 'TOGGLE_FULLSCREEN':
        toggleFullscreen();
        break;

      case 'FOCUS_SEARCH':
        exitFullscreen();
        el.searchInput.focus();
        break;

      case 'CH_NEXT':
        navigateChannel(+1);
        break;

      case 'CH_PREV':
        navigateChannel(-1);
        break;

      case 'PAGE_UP':
        state.selectedIndex = Math.max(0, state.selectedIndex - 10);
        updateChannelHighlight();
        scrollToSelected();
        break;

      case 'PAGE_DOWN':
        state.selectedIndex = Math.min(len - 1, state.selectedIndex + 10);
        updateChannelHighlight();
        scrollToSelected();
        break;

      case 'TOGGLE_PLAY':
      case 'PLAY':
        if (el.videoPlayer.paused) el.videoPlayer.play().catch(function(){});
        break;

      case 'PAUSE':
        if (!el.videoPlayer.paused) el.videoPlayer.pause();
        break;

      case 'STOP':
        destroyHls();
        showEl(el.placeholder);
        state.currentChannel = null;
        state.playingIndex   = -1;
        exitFullscreen();
        updateChannelHighlight();
        break;

      case 'SEARCH_CLOSE':
        clearSearch();
        break;

      case 'SEARCH_CONFIRM':
        el.searchInput.blur();
        if (state.filteredChannels.length > 0) {
          state.selectedIndex = 0;
          updateChannelHighlight();
        }
        break;

      case 'DIAL_DIGIT':
        if (e && e.buffer) showDialFeedback(e.buffer);
        break;

      case 'DIAL_CHANNEL':
        if (e && e.number) jumpToChannelNumber(e.number);
        break;
    }
  }

  /** Naviga di +1 o -1 nella lista, con wrap-around */
  function navigateChannel(delta) {
    var len = state.filteredChannels.length;
    if (len === 0) return;

    var next = state.selectedIndex + delta;
    if (next < 0) next = len - 1;
    if (next >= len) next = 0;

    state.selectedIndex = next;
    updateChannelHighlight();
    scrollToSelected();
    playSelectedChannel();
  }

  /** Salta al canale con numero progressivo specifico */
  function jumpToChannelNumber(num) {
    hideDialFeedback();
    // Cerca prima nei filtrati, poi in tutti
    var idx = state.filteredChannels.findIndex(function (ch) { return ch.num === num; });
    if (idx >= 0) {
      state.selectedIndex = idx;
      updateChannelHighlight();
      scrollToSelected();
      playSelectedChannel();
    } else {
      // Cerca in tutti i canali e passa alla categoria giusta
      var ch = state.allChannels.find(function (c) { return c.num === num; });
      if (ch) {
        selectCategory('Tutti');
        var idx2 = state.filteredChannels.findIndex(function (c) { return c.num === num; });
        if (idx2 >= 0) {
          state.selectedIndex = idx2;
          updateChannelHighlight();
          scrollToSelected();
          playSelectedChannel();
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // DIAL FEEDBACK UI (numero digitato col telecomando)
  // ══════════════════════════════════════════════════════════

  var _dialEl = null;

  function showDialFeedback(buf) {
    if (!_dialEl) {
      _dialEl = document.createElement('div');
      _dialEl.id        = 'dial-feedback';
      _dialEl.style.cssText = [
        'position:fixed', 'top:40px', 'right:40px',
        'background:rgba(10,10,18,0.92)',
        'border:2px solid rgba(229,9,20,0.7)',
        'border-radius:16px',
        'padding:20px 36px',
        'font-size:3rem', 'font-weight:800',
        'color:#f0f0f8',
        'font-family:Inter,sans-serif',
        'z-index:999',
        'letter-spacing:0.1em',
        'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
        'pointer-events:none',
      ].join(';');
      document.body.appendChild(_dialEl);
    }
    _dialEl.textContent = buf;
    _dialEl.style.display = 'block';
  }

  function hideDialFeedback() {
    if (_dialEl) _dialEl.style.display = 'none';
  }

  // ══════════════════════════════════════════════════════════
  // LOADING / UI STATE HELPERS
  // ══════════════════════════════════════════════════════════

  function showLoading(msg) {
    showEl(el.loadingScreen);
    hideEl(el.app);
    hideEl(el.errorScreen);
    if (msg) el.loadingText.textContent = msg;
    setProgress(0);
  }

  function setProgress(pct) {
    el.loadingProg.style.width = pct + '%';
  }

  function setLoadingText(msg) {
    el.loadingText.textContent = msg;
  }

  function showApp() {
    el.loadingScreen.style.opacity = '0';
    el.loadingScreen.style.transition = 'opacity 0.5s ease';
    setTimeout(function () {
      hideEl(el.loadingScreen);
      el.loadingScreen.style.opacity = '';
      el.loadingScreen.style.transition = '';
    }, 500);
    showEl(el.app);
    // Focus sul primo canale
    updateChannelHighlight();
  }

  function showErrorScreen(msg) {
    hideEl(el.loadingScreen);
    hideEl(el.app);
    el.errorDetail.textContent = msg;
    showEl(el.errorScreen);
  }

  // ══════════════════════════════════════════════════════════
  // DOM UTILITY
  // ══════════════════════════════════════════════════════════

  function showEl(el) { el.classList.remove('hidden'); }
  function hideEl(el) { el.classList.add('hidden'); }
  function addClass(el, cls) { el.classList.add(cls); }
  function removeClass(el, cls) { el.classList.remove(cls); }
  function hasClass(el, cls) { return el.classList.contains(cls); }
  function toggleClass(el, cls, force) {
    if (force === undefined) { el.classList.toggle(cls); }
    else if (force) el.classList.add(cls);
    else el.classList.remove(cls);
  }

})();
