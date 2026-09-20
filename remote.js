/* ============================================================
   remote.js — Gestione Input Telecomando Hisense VIDAA
   Mappa i keyCode del D-pad / telecomando in azioni app
   ============================================================ */

'use strict';

var Remote = (function () {

  // ── Key Code Map ───────────────────────────────────────────
  // Standard keyboard + HbbTV / VIDAA specific keyCodes
  var KEYS = {
    // D-pad / Frecce
    UP:        38,
    DOWN:      40,
    LEFT:      37,
    RIGHT:     39,

    // Conferma / Selezione
    ENTER:     13,
    OK:        13,   // alias

    // Indietro / Uscita
    BACK:      8,    // Backspace (usato da alcuni TV come Back)
    ESC:       27,
    BACK_ALT:  461,  // HbbTV Back standard

    // Canale
    CH_UP:     427,  // HbbTV VK_CHANNEL_UP
    CH_DOWN:   428,  // HbbTV VK_CHANNEL_DOWN
    PAGE_UP:   33,   // Page Up (usato da alcuni remote)
    PAGE_DOWN: 34,   // Page Down

    // Tasti colorati HbbTV
    RED:       403,  // VK_RED   — toggle sidebar
    GREEN:     404,  // VK_GREEN — search
    YELLOW:    405,  // VK_YELLOW
    BLUE:      406,  // VK_BLUE  — fullscreen

    // Play / Pause / Media
    PLAY:      415,
    PAUSE:     19,
    PLAY_PAUSE: 179,
    STOP:      413,
    FF:        417,  // Fast Forward
    REW:       412,  // Rewind

    // Numeri
    N0: 48, N1: 49, N2: 50, N3: 51, N4: 52,
    N5: 53, N6: 54, N7: 55, N8: 56, N9: 57,
  };

  // ── Azioni semantiche ──────────────────────────────────────
  // Mappa da keyCode → action string
  var KEY_ACTION_MAP = {};
  KEY_ACTION_MAP[KEYS.UP]         = 'NAV_UP';
  KEY_ACTION_MAP[KEYS.DOWN]       = 'NAV_DOWN';
  KEY_ACTION_MAP[KEYS.LEFT]       = 'NAV_LEFT';
  KEY_ACTION_MAP[KEYS.RIGHT]      = 'NAV_RIGHT';
  KEY_ACTION_MAP[KEYS.ENTER]      = 'SELECT';
  KEY_ACTION_MAP[KEYS.BACK]       = 'BACK';
  KEY_ACTION_MAP[KEYS.ESC]        = 'BACK';
  KEY_ACTION_MAP[KEYS.BACK_ALT]   = 'BACK';
  KEY_ACTION_MAP[KEYS.CH_UP]      = 'CH_NEXT';
  KEY_ACTION_MAP[KEYS.CH_DOWN]    = 'CH_PREV';
  KEY_ACTION_MAP[KEYS.PAGE_UP]    = 'PAGE_UP';
  KEY_ACTION_MAP[KEYS.PAGE_DOWN]  = 'PAGE_DOWN';
  KEY_ACTION_MAP[KEYS.RED]        = 'TOGGLE_SIDEBAR';
  KEY_ACTION_MAP[KEYS.GREEN]      = 'FOCUS_SEARCH';
  KEY_ACTION_MAP[KEYS.BLUE]       = 'TOGGLE_FULLSCREEN';
  KEY_ACTION_MAP[KEYS.PLAY]       = 'PLAY';
  KEY_ACTION_MAP[KEYS.PAUSE]      = 'PAUSE';
  KEY_ACTION_MAP[KEYS.PLAY_PAUSE] = 'TOGGLE_PLAY';
  KEY_ACTION_MAP[KEYS.STOP]       = 'STOP';
  // Numeri → canale diretto
  for (var n = 0; n <= 9; n++) {
    KEY_ACTION_MAP[KEYS['N' + n]] = 'DIGIT_' + n;
  }

  // ── Stato interno ──────────────────────────────────────────
  var _callback = null;
  var _enabled  = true;

  // Numero digitato col telecomando (dial diretto canale)
  var _dialBuffer  = '';
  var _dialTimeout = null;
  var DIAL_DELAY   = 1500; // ms dopo l'ultimo digit prima di zappare

  // ── Init ───────────────────────────────────────────────────
  /**
   * Inizializza il listener globale keydown.
   * @param {function(string, Event): void} callback
   *   Riceve l'action string e l'evento originale.
   */
  function init(callback) {
    _callback = callback;
    document.addEventListener('keydown', _onKeyDown, { passive: false });
  }

  /**
   * Abilita / disabilita temporaneamente la gestione remoto.
   * @param {boolean} enabled
   */
  function setEnabled(enabled) {
    _enabled = enabled;
  }

  // ── Handler interno ────────────────────────────────────────
  function _onKeyDown(e) {
    if (!_enabled || !_callback) return;

    // Se il focus è sull'input di ricerca, lascia passare tutto
    // tranne Enter (conferma) e ESC/Back (chiude)
    var isSearchFocused = document.activeElement &&
      document.activeElement.id === 'search-input';

    if (isSearchFocused) {
      if (e.keyCode === KEYS.ESC || e.keyCode === KEYS.BACK_ALT) {
        e.preventDefault();
        _callback('SEARCH_CLOSE', e);
      } else if (e.keyCode === KEYS.ENTER) {
        e.preventDefault();
        _callback('SEARCH_CONFIRM', e);
      }
      // Tutti gli altri tasti vanno all'input normalmente
      return;
    }

    var action = KEY_ACTION_MAP[e.keyCode];
    if (!action) return;

    // Previeni comportamento default del browser (scroll pagina, ecc.)
    // Solo per i tasti di navigazione
    if ([KEYS.UP, KEYS.DOWN, KEYS.LEFT, KEYS.RIGHT,
         KEYS.ENTER, KEYS.BACK, KEYS.ESC, KEYS.BACK_ALT,
         KEYS.CH_UP, KEYS.CH_DOWN,
         KEYS.PAGE_UP, KEYS.PAGE_DOWN].indexOf(e.keyCode) >= 0) {
      e.preventDefault();
    }

    // Gestione dial numerico
    if (action.startsWith('DIGIT_')) {
      _handleDial(action.replace('DIGIT_', ''));
      return;
    }

    _callback(action, e);
  }

  /**
   * Gestisce la digitazione di numeri per canale diretto.
   * Accumula le cifre per 1500ms, poi emette DIAL_CHANNEL.
   */
  function _handleDial(digit) {
    _dialBuffer += digit;

    // Mostra feedback immediato
    if (_callback) _callback('DIAL_DIGIT', { digit: digit, buffer: _dialBuffer });

    // Reset timer
    clearTimeout(_dialTimeout);
    _dialTimeout = setTimeout(function () {
      var num = parseInt(_dialBuffer, 10);
      _dialBuffer = '';
      if (_callback && !isNaN(num)) {
        _callback('DIAL_CHANNEL', { number: num });
      }
    }, DIAL_DELAY);
  }

  // ── API Pubblica ───────────────────────────────────────────
  return {
    KEYS: KEYS,
    init: init,
    setEnabled: setEnabled,
  };

})();
