# 📺 IPTV Italia — Hisense VIDAA (So Viva)

Player IPTV gratuito per **canali italiani**, ottimizzato per TV Hisense con VIDAA OS.  
Sorgente: [iptv-org.github.io](https://iptv-org.github.io/iptv/countries/it.m3u)

---

## 🚀 Deploy su GitHub Pages (accesso da ovunque)

### 1. Crea un repository GitHub

```bash
git init
git add .
git commit -m "IPTV Italia - primo commit"
git branch -M main
git remote add origin https://github.com/<TUO-USERNAME>/iptv-hisense.git
git push -u origin main
```

### 2. Abilita GitHub Pages

1. Vai su **Settings** del repository → **Pages**
2. In **Source** seleziona: `Deploy from a branch`
3. Branch: `main` → cartella: `/ (root)`
4. Clicca **Save**
5. Dopo ~2 minuti l'app sarà disponibile su:
   ```
   https://<TUO-USERNAME>.github.io/iptv-hisense/
   ```

> ⚠️ **Nota CORS / HTTPS:** GitHub Pages serve su HTTPS. Alcuni stream IPTV
> sono su HTTP (non sicuro) e verranno bloccati dal browser per "mixed content".
> I canali RAI, Mediaset e i principali usano già HTTPS e funzioneranno.
> I canali regionali minori potrebbero richiedere il server locale (vedi sotto).

---

## 🖥️ Test locale (alternativa)

```powershell
# Nella cartella del progetto
npx -y serve . -p 8080
# oppure
python -m http.server 8080
```
Apri `http://localhost:8080` nel browser.

---

## 📺 Installazione su Hisense VIDAA (So Viva)

### Prerequisiti
- TV e sorgente dell'URL sulla **stessa rete WiFi** (per server locale)  
  oppure URL GitHub Pages (da qualsiasi rete)

### Step by step

1. **Apri il browser** della TV Hisense
2. Nella barra indirizzi digita:
   ```
   hisense://debug
   ```
3. Compila il form che appare:
   - **App Name:** `IPTV Italia`
   - **App URL:** `https://<TUO-USERNAME>.github.io/iptv-hisense/`
     *(oppure `http://192.168.1.XXX:8080` per server locale)*
4. Clicca **Install** → attendi "Installation COMPLETED!"
5. L'app appare alla fine di **My Apps** (Home → App)

---

## 🎮 Guida al Telecomando

| Tasto | Azione |
|-------|--------|
| ▲ ▼ | Naviga la lista canali |
| ◄    | Torna alla lista (da fullscreen) |
| ►    | Entra in fullscreen |
| **OK** | Riproduci canale / toggle OSD |
| **Back** | Torna alla lista / annulla |
| **CH+ / CH-** | Canale successivo / precedente (anche in fullscreen) |
| **0–9** | Digita il numero canale (es. `0` `3` → canale 3) |
| 🔴 Rosso | Mostra/nasconde la sidebar |
| 🔵 Blu | Toggle fullscreen |
| 🟢 Verde | Attiva la ricerca |

---

## ⚙️ Struttura Progetto

```
iptv-hisense/
├── index.html    → struttura HTML principale
├── style.css     → UI dark premium ottimizzata TV
├── parser.js     → parser playlist M3U (vanilla JS, no npm)
├── remote.js     → gestione telecomando (keyCode mapping HbbTV + VIDAA)
├── app.js        → logica app, player HLS.js, navigazione
├── .nojekyll     → richiesto da GitHub Pages
└── README.md     → questa documentazione
```

**Dipendenze esterne (CDN, no npm):**
- [HLS.js](https://github.com/video-dev/hls.js) — riproduzione stream HLS/M3U8
- [Inter](https://fonts.google.com/specimen/Inter) — font da Google Fonts

---

## 🔧 Personalizzazione

### Cambiare sorgente playlist

In `parser.js`, modifica:
```javascript
var PLAYLIST_URL = 'https://iptv-org.github.io/iptv/countries/it.m3u';
```

Altre sorgenti disponibili da iptv-org:
- Tutti i paesi: `https://iptv-org.github.io/iptv/index.m3u`
- Solo News IT: `https://iptv-org.github.io/iptv/categories/news.m3u`
- Solo Sport: `https://iptv-org.github.io/iptv/categories/sports.m3u`

### Aggiungere canali preferiti
La funzionalità preferiti può essere aggiunta salvando gli indici in `localStorage`.

---

## ⚠️ Note Legali

Questa app riproduce unicamente stream **liberamente accessibili** e **non a pagamento**
indicizzati da [iptv-org](https://github.com/iptv-org/iptv).  
Non vengono memorizzati né ridistribuiti i contenuti video.  
L'utente è responsabile del rispetto delle normative locali sul diritto d'autore.
