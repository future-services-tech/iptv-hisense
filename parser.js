/* ============================================================
   parser.js — M3U Playlist Parser
   Carica e parsa la playlist IPTV iptv-org per canali italiani
   ============================================================ */

'use strict';

var Parser = (function () {

  // URL playlist canali italiani (iptv-org country-specific)
  var PLAYLIST_URL = 'https://iptv-org.github.io/iptv/countries/it.m3u';

  /**
   * Fetch e parsa la playlist M3U.
   * @param {string} [url] - URL della playlist (default: it.m3u)
   * @returns {Promise<Channel[]>}
   */
  async function fetchPlaylist(url) {
    var src = url || PLAYLIST_URL;

    var response = await fetch(src, {
      cache: 'no-store',
      headers: { 'Accept': 'application/x-mpegURL, application/vnd.apple.mpegurl, */*' }
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' — impossibile caricare la playlist');
    }

    var text = await response.text();
    return parseM3U(text);
  }

  /**
   * Parsa il testo M3U in un array di oggetti Channel.
   * @param {string} text - Testo grezzo della playlist M3U
   * @returns {Channel[]}
   *
   * Struttura Channel:
   * {
   *   name:    string,   // Nome canale
   *   url:     string,   // URL dello stream (.m3u8 / .ts / ecc.)
   *   logo:    string,   // URL logo/icona
   *   group:   string,   // Categoria (group-title)
   *   id:      string,   // tvg-id
   *   country: string,   // Codice paese estratto da tvg-id (es. "it")
   *   num:     number,   // Numero progressivo (1-based)
   * }
   */
  function parseM3U(text) {
    var channels = [];
    var lines = text.replace(/\r/g, '').split('\n');
    var current = null;
    var lineCount = lines.length;

    for (var i = 0; i < lineCount; i++) {
      var line = lines[i].trim();

      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        current = parseExtInf(line);
        continue;
      }

      // Skip altre direttive M3U (#EXTVLCOPT, ecc.)
      if (line.startsWith('#')) continue;

      // Riga URL stream
      if (current) {
        // Skip stream con schemi non supportati nel browser
        if (line.startsWith('rtmp://') || line.startsWith('rtsp://')) {
          current = null;
          continue;
        }
        current.url = line;
        channels.push(current);
        current = null;
      }
    }

    // Assegna numeri progressivi
    channels.forEach(function (ch, idx) {
      ch.num = idx + 1;
    });

    return channels;
  }

  /**
   * Parsa una riga #EXTINF ed estrae gli attributi.
   * @param {string} line - Riga #EXTINF:...
   * @returns {Channel}
   */
  function parseExtInf(line) {
    var ch = {
      name: 'Canale sconosciuto',
      url: '',
      logo: '',
      group: 'Generale',
      id: '',
      country: 'it',
      num: 0,
    };

    // Nome canale: tutto dopo l'ultima virgola
    var commaIdx = line.lastIndexOf(',');
    if (commaIdx >= 0) {
      ch.name = line.substring(commaIdx + 1).trim() || ch.name;
    }

    // Attributi key="value"
    var attrRegex = /([\w-]+)="([^"]*)"/g;
    var match;
    while ((match = attrRegex.exec(line)) !== null) {
      var key = match[1].toLowerCase();
      var val = match[2].trim();
      switch (key) {
        case 'tvg-id':
          ch.id = val;
          // Estrai codice paese dal suffisso (es. "Rai1.it" → "it")
          var dotIdx = val.lastIndexOf('.');
          if (dotIdx >= 0) ch.country = val.substring(dotIdx + 1).toLowerCase();
          break;
        case 'tvg-logo':
          ch.logo = val;
          break;
        case 'tvg-name':
          // Usa tvg-name solo se il nome è vuoto
          if (!ch.name || ch.name === 'Canale sconosciuto') ch.name = val;
          break;
        case 'group-title':
          ch.group = val || 'Generale';
          break;
      }
    }

    return ch;
  }

  /**
   * Estrae tutte le categorie uniche dall'array di canali.
   * @param {Channel[]} channels
   * @returns {string[]} Lista categorie ordinate, con 'Tutti' come primo
   */
  function extractCategories(channels) {
    var seen = {};
    channels.forEach(function (ch) {
      if (ch.group) seen[ch.group] = true;
    });
    var cats = Object.keys(seen).sort();
    return ['Tutti'].concat(cats);
  }

  // Esporta API pubblica
  return {
    PLAYLIST_URL: PLAYLIST_URL,
    fetchPlaylist: fetchPlaylist,
    parseM3U: parseM3U,
    extractCategories: extractCategories,
  };

})();
