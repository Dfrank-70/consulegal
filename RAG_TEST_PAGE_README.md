# RAG Test Page - Guida Rapida

È stata creata una pagina di test per validare il flusso RAG end-to-end senza usare `curl` o Postman.

## Accesso

La pagina è disponibile solo per gli amministratori al seguente URL:

**URL**: `/dashboard/admin/rag-test`

## Funzionalità

La pagina è divisa in 3 sezioni per seguire il flusso logico del RAG:

### 1. Create Node
- **Scopo**: Creare un contenitore logico per i documenti.
- **Come usare**:
  1. (Opzionale) Modifica il nome del nodo nel campo di testo.
  2. Clicca su **"Create Node"**.
  3. L'ID del nodo creato apparirà sotto il pulsante e verrà salvato per i passaggi successivi.

### 2. Upload File
- **Scopo**: Caricare un documento (PDF, DOCX, etc.) nel nodo appena creato.
- **Come usare**:
  1. Clicca su **"Scegli file"** e seleziona un documento dal tuo computer (max 5MB).
  2. Clicca su **"Upload to Node"**.
  3. Il sistema salverà il file in `./ragdata/<nodeId>/<docId>/<filename>` e avvierà in background il processo di parsing, chunking ed embedding.
  4. Controlla i log per vedere il risultato dell'upload.

### 3. Ask Question
- **Scopo**: Porre una domanda al sistema RAG, che userà il documento caricato per rispondere.
- **Come usare**:
  1. Scrivi la tua domanda nella casella di testo.
  2. Clicca su **"Ask"**.
  3. La richiesta verrà inviata all'endpoint `/api/rag/answer`.

## Output

Sotto le sezioni di input, troverai due pannelli:

- **Logs**: Mostra un log in tempo reale di tutte le operazioni effettuate (creazione, upload, domanda) e i loro risultati (successo o errore).
- **Answer & Details**: Una volta ricevuta una risposta, questa sezione mostrerà:
  - **Answer**: La risposta testuale generata dall'LLM.
  - **Citations**: Un JSON con le fonti esatte usate per la risposta.
  - **Telemetry**: Dati sulle performance (tempo totale, tempo di retrieval, tempo LLM).

## Workflow di Test Completo

1. Vai a `/dashboard/admin/rag-test`.
2. Clicca **"Create Node"**.
3. Seleziona un file PDF e clicca **"Upload to Node"**.
4. Attendi che l'upload sia completato (controlla i log).
5. Scrivi una domanda relativa al contenuto del PDF e clicca **"Ask"**.
6. Analizza la risposta, le citazioni e la telemetria nel pannello di output.

Questo processo ti permette di validare l'intero sistema RAG in modo rapido e visuale.
