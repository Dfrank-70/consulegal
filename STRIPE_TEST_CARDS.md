---
**Documento:** Stripe Test Cards Reference
**Data:** 19 Gennaio 2026
**Contesto:** Setup test E2E per payment failure scenarios
**Versione MVP:** Test subscription e guardrail economici
---

# Stripe Test Cards - Quick Reference

**Fonte:** https://docs.stripe.com/testing

---

## ✅ Carte di Test - Pagamenti Riusciti

### Carta Standard (Successo)
```
Numero: 4242 4242 4242 4242
Scadenza: qualsiasi data futura (es. 12/34)
CVC: qualsiasi 3 cifre (es. 123)
```

**Uso:** Test checkout standard con pagamento riuscito.

---

## ❌ Carte di Test - Pagamenti Falliti (per Test 4)

### 1. Generic Decline
```
Numero: 4000 0000 0000 0002
Error: card_declined
Decline Code: generic_decline
```
**Uso:** Simula rifiuto generico della carta.

---

### 2. Insufficient Funds
```
Numero: 4000 0000 0000 9995
Error: card_declined
Decline Code: insufficient_funds
```
**Uso:** Simula carta con fondi insufficienti.

---

### 3. Lost Card
```
Numero: 4000 0000 0000 9987
Error: card_declined
Decline Code: lost_card
```
**Uso:** Simula carta smarrita.

---

### 4. Stolen Card
```
Numero: 4000 0000 0000 9979
Error: card_declined
Decline Code: stolen_card
```
**Uso:** Simula carta rubata.

---

### 5. Expired Card
```
Numero: 4000 0000 0000 0069
Error: expired_card
Decline Code: expired_card
```
**Uso:** Simula carta scaduta.

---

### 6. Incorrect CVC
```
Numero: 4000 0000 0000 0127
Error: incorrect_cvc
Decline Code: incorrect_cvc
```
**Nota:** Devi inserire un CVC (qualsiasi 3 cifre) per triggerare l'errore.

---

### 7. Processing Error
```
Numero: 4000 0000 0000 0119
Error: processing_error
Decline Code: processing_error
```
**Uso:** Simula errore di processing generico.

---

### 8. Incorrect Card Number
```
Numero: 4242 4242 4242 4241
Error: incorrect_number
Decline Code: incorrect_number
```
**Uso:** Numero carta non valido (ultimo digit errato).

---

### 9. Rate Limit Exceeded
```
Numero: 4000 0000 0000 0259
Error: card_declined
Decline Code: card_velocity_exceeded
```
**Uso:** Simula troppi tentativi con stessa carta.

---

## 🔐 Carte 3D Secure (Autenticazione)

### Richiede Autenticazione (SCA)
```
Numero: 4000 0027 6000 3184
Tipo: 3D Secure 2 authentication must be completed
```
**Uso:** Testa flusso 3D Secure completo.

### Autenticazione Fallita
```
Numero: 4000 0000 0000 3055
Tipo: 3D Secure authentication failed
```
**Uso:** Simula fallimento autenticazione 3D Secure.

---

## 💳 Carte per Marchio Specifico

### Visa
```
Numero: 4242 4242 4242 4242 (successo)
Numero: 4000 0000 0000 0002 (decline)
```

### Mastercard
```
Numero: 5555 5555 5555 4444 (successo)
Numero: 2223 0031 2200 3222 (successo, Mastercard 2-series)
```

### American Express
```
Numero: 3782 822463 10005 (successo)
CVC: 4 cifre (es. 1234)
```

### Discover
```
Numero: 6011 1111 1111 1117 (successo)
```

### JCB
```
Numero: 3566 0020 2036 0505 (successo)
```

### Diners Club
```
Numero: 3056 9309 0259 04 (successo, 14 cifre)
```

### UnionPay
```
Numero: 6200 0000 0000 0005 (successo)
```

---

## 🧪 Test PaymentMethod IDs (per API)

**Raccomandato per codice production-safe:**

```bash
# Invece di usare numeri carta direttamente
pm_card_visa              # Visa success
pm_card_mastercard        # Mastercard success
pm_card_amex              # American Express success
pm_card_discover          # Discover success
pm_card_diners            # Diners Club success
pm_card_jcb               # JCB success
pm_card_unionpay          # UnionPay success

# Per testare failures
pm_card_chargeAsFailureWhenCapturing  # Simula failure al capture
```

**Esempio cURL:**
```bash
curl https://api.stripe.com/v1/payment_intents \
  -u "sk_test_YOUR_KEY:" \
  -d amount=500 \
  -d currency=usd \
  -d payment_method=pm_card_visa \
  -d "payment_method_types[]"=card
```

---

## 📝 Note Importanti

### Dati Generici per Test
- **Scadenza:** Qualsiasi data futura (es. 12/34, 01/30)
- **CVC:** Qualsiasi 3 cifre (4 per Amex) - es. 123, 4567
- **Nome:** Qualsiasi stringa
- **ZIP/CAP:** Qualsiasi 5 cifre (US) o stringa (altri Paesi)

### PCI Compliance
⚠️ **Mai usare numeri carta direttamente nel codice production**, nemmeno in test mode. Usare `PaymentMethod` IDs (pm_card_*) nelle API calls.

### Modalità Test vs Live
- Chiavi API test: `sk_test_...` / `pk_test_...`
- Chiavi API live: `sk_live_...` / `pk_live_...`
- Le carte test **NON funzionano** in live mode
- Le carte reali **NON funzionano** in test mode

---

## 🎯 Use Cases Comuni

### Test Checkout Success
```
Carta: 4242 4242 4242 4242
Scadenza: 12/34
CVC: 123
→ Pagamento riuscito
```

### Test Payment Failure (Insufficient Funds)
```
Carta: 4000 0000 0000 9995
Scadenza: 12/34
CVC: 123
→ Error: card_declined, reason: insufficient_funds
→ Subscription status: past_due o incomplete
```

### Test 3D Secure Flow
```
Carta: 4000 0027 6000 3184
Scadenza: 12/34
CVC: 123
→ Modale 3DS appare
→ Completa autenticazione
→ Pagamento riuscito
```

### Test Expired Card
```
Carta: 4000 0000 0000 0069
Scadenza: 12/34 (irrilevante, simula sempre expired)
CVC: 123
→ Error: expired_card
```

---

## 🔗 Risorse

- **Documentazione completa:** https://docs.stripe.com/testing
- **Codici decline:** https://docs.stripe.com/declines/codes
- **Codici errore:** https://docs.stripe.com/error-codes
- **Test webhooks:** https://docs.stripe.com/webhooks/test

---

**Aggiornato:** 19 Gennaio 2026
