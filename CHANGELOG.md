# Changelog ConsuLegal/Traspolegal

## [2025-10-23] - Implementazione TTS e Ottimizzazioni Mobile

### ✨ Nuove Funzionalità

#### TTS (Text-to-Speech)
- **Lettura vocale risposte AI**: Bottone speaker su ogni messaggio AI
- **Web Speech API**: Integrazione nativa del browser (zero API key necessarie)
- **Velocità ottimizzate per device**:
  - iPhone: 1.05x
  - Mac/Android: 1.20x
- **UI responsive**: Bottone 40x40px su mobile, 32x32px su desktop
- **Controlli**: Play/Stop con cambio icona (Volume2 ↔ VolumeX)
- **Pulizia testo**: Rimozione automatica sezione "Note:" e riferimenti numerici

### 🎨 Ottimizzazioni UI/UX Mobile

#### Layout Responsive
- **Messaggi**: Larghezza 95% su mobile (era 80%)
- **Bottoni touch-friendly**: 40px su mobile per facilità d'uso
- **Padding ottimizzato**: Ridotto su schermi piccoli per massimizzare spazio
- **Header compatto**: Token count nascosto su mobile, bottone "Nuova" invece di "Nuova Conversazione"

#### Fullscreen Mobile
- **Dynamic Viewport Height (dvh)**: Adattamento automatico quando barra browser appare/scompare
- **Fallback CSS**: `-webkit-fill-available` per Safari iOS
- **Hook JavaScript**: Calcolo dinamico altezza viewport con variabile CSS `--vh`
- **Zero overflow**: Eliminato scroll orizzontale indesiderato

#### Input Area
- **Bottoni più grandi**: 40x40px su mobile (graffetta + invio)
- **Icone ingrandite**: 20x20px per migliore visibilità
- **Z-index garantito**: Bottoni sempre visibili sopra altri elementi
- **Padding textarea**: Adeguato per evitare sovrapposizioni

### 🐛 Bug Fix

- **TTS error "interrupted"**: Gestione silenziosa degli errori normali quando l'utente interrompe manualmente
- **Overflow orizzontale**: Risolto con flex-wrap e max-width su header
- **Viewport height mobile**: Fix per Android dove VH non funzionava correttamente
- **Bottoni non cliccabili**: Rimosso overflow-x-hidden che bloccava interazioni

### 📱 Compatibilità

**TTS Support:**
- ✅ Chrome Android (100%)
- ✅ Chrome Desktop (100%)
- ✅ Safari iOS (100% con rate adattato)
- ✅ Safari Mac (100%)
- ✅ Edge Desktop (100%)
- ✅ Firefox Desktop/Android (100%)

**Mobile Optimization:**
- ✅ iPhone 12 (390px) - Testato
- ✅ Android (varie risoluzioni) - Testato
- ✅ Breakpoint: 640px (sm:)

### 🔧 File Modificati

#### Nuovi File
- `/lib/speech/tts.ts` - Modulo TTS con classe TextToSpeech

#### File Modificati
- `/components/chat/message-list.tsx` - Integrazione TTS + UI responsive
- `/components/chat/message-input.tsx` - Bottoni input ottimizzati per mobile
- `/components/chat/chat-interface.tsx` - Layout fullscreen e header responsive
- `/app/dashboard/client-layout.tsx` - Fix viewport height + hook resize
- `/app/dashboard/page.tsx` - Rimozione container con padding indesiderato
- `/app/globals.css` - Fallback CSS per dvh

### 📊 Metriche

- **Velocità lettura**: 1.05x-1.20x (ottimizzato per comprensibilità)
- **Dimensioni bottoni mobile**: +25% (32px → 40px)
- **Larghezza messaggi mobile**: +18.75% (80% → 95%)
- **Padding ridotto mobile**: -50% (16px → 8px)

### 🚀 Prossimi Passi Proposti

- [ ] Implementazione STT (Speech-to-Text) per input vocale
- [ ] PWA completa con manifest.json e service worker
- [ ] Palette colori differenziata mobile/desktop
- [ ] Notifiche push per nuovi messaggi
- [ ] Modalità offline con cache intelligente
