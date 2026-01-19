# Problemi Noti e Soluzioni

**Data:** 19 Gennaio 2026  
**Contesto:** Issues ricorrenti MVP subscription sync

---

## ⚠️ PROBLEMA RICORRENTE: Abbonamenti Stripe non sincronizzati automaticamente

### 🔴 Sintomo
Dopo l'acquisto di un piano su Stripe Checkout, l'utente viene reindirizzato alla dashboard ma il piano risulta **"Nessun piano attivo"** invece di mostrare il piano appena acquistato.

### 🔍 Causa Root
Il sistema originale si affidava ai **webhook Stripe** per sincronizzare gli abbonamenti nel database. Tuttavia, i webhook Stripe richiedono:
- Stripe CLI in ascolto: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Autenticazione periodica (chiave scade)
- Processo continuamente attivo
- Non affidabile in sviluppo locale

**Risultato:** Il webhook NON viene chiamato → l'abbonamento NON viene sincronizzato → l'utente NON vede il piano attivo.

### ✅ Soluzione Definitiva (19 Gennaio 2026)

#### File Creati
```
app/api/subscription/sync/route.ts
```
Endpoint POST che sincronizza l'abbonamento chiamando **direttamente** l'API Stripe senza dipendere dai webhook.

#### File Modificati
1. **app/dashboard/client-layout.tsx**
   - Aggiunto `useEffect` che rileva il parametro `?new-subscription=true`
   - Chiama automaticamente `/api/subscription/sync`
   - Ricarica la pagina dopo la sincronizzazione

2. **app/dashboard/page.tsx**
   - Rimosso codice server-side non funzionante che tentava di chiamare `/api/admin/sync-subscription` (404)

#### Come Funziona
```
1. Utente completa checkout su Stripe
2. Stripe redirect → /dashboard?new-subscription=true
3. client-layout.tsx rileva il parametro
4. Chiama POST /api/subscription/sync che:
   - Cerca il customer Stripe per email utente
   - Recupera l'abbonamento attivo più recente
   - Lo sincronizza nel database Prisma (transaction atomica)
5. Ricarica la pagina senza il parametro
6. Piano attivo IMMEDIATAMENTE visibile ✅
```

#### Test Verificati
- ✅ Utente: `febbraio2026@test.com`
- ✅ Piano: ConsulLight attivo immediatamente al ritorno
- ✅ Log console: `✅ Subscription synced successfully`
- ✅ Nessun intervento manuale richiesto

### ⚡ IMPORTANTE - NON ELIMINARE MAI

**File critici:**
- `/app/api/subscription/sync/route.ts`
- Il codice `useEffect` in `app/dashboard/client-layout.tsx` (righe 32-62)

**Perché:** Questa soluzione bypassa completamente il sistema webhook Stripe e garantisce la sincronizzazione automatica in **qualsiasi ambiente** (dev, staging, prod) senza dipendere da processi esterni.

### 🔧 Come Verificare che Funzioni

1. Creare nuovo utente
2. Acquistare un piano
3. Controllare console browser: deve apparire `✅ Subscription synced successfully`
4. Verificare che il piano sia visibile nella sidebar dopo il redirect

### 🚨 Se il Problema si Ripresenta

**NON** ricominciare da zero. Verificare:

1. ✅ Il file `/app/api/subscription/sync/route.ts` esiste
2. ✅ Il codice in `client-layout.tsx` non è stato rimosso
3. ✅ La variabile `STRIPE_SECRET_KEY_TEST` in `.env` è valida (non scaduta)
4. ✅ Il redirect da Stripe usa `success_url: /dashboard?new-subscription=true`

Se tutti i punti sono verificati e il problema persiste, controllare i log del server per errori nell'endpoint `/api/subscription/sync`.

---

## 📋 Altri Problemi Noti

### Token Visualizzati come 0
**Status:** In analisi  
**Workaround:** Il database `subscription.tokenLimit` è corretto (10.000), ma l'UI mostra sempre 0. Possibile problema di calcolo token usage vs token limit.

---

**Ultimo aggiornamento:** 19 Gennaio 2026
