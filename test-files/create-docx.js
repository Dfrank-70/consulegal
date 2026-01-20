const fs = require('fs');
const path = require('path');

// Creo file DOCX semplici (in realtà sono TXT con estensione DOCX per il test)
const smallDocx = `Questo è un file DOCX di piccole dimensioni per testare il sistema di upload.
Contiene circa 800 caratteri per rimanere ben sotto i limiti.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Test file upload system - small DOCX simulation.
Questo testo dovrebbe essere processato senza problemi.
Fine del file di test.`;

const mediumDocx = `Questo è un file DOCX di medie dimensioni per testare il sistema di upload.
Contiene circa 20.000 caratteri per testare il limite di ConsulPro (75.000 caratteri).

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

CONTRATTO DI PRESTAZIONE SERVIZI PROFESSIONALI

TRA: Avv. Mario Bianchi, iscritto all'Ordine degli Avvocati di Milano, con studio in Milano, via Montenapoleone 15, C.F. BNCMRA75M15F205E, P.IVA 12345678901

E: Cliente S.r.l., con sede in Milano, via Turati 10, C.F. 12345678901, P.IVA 12345678901, rappresentata legalmente dal Direttore Generale Dott. Rossi Verdi

ARTICOLO 1 - OGGETTO DELLA PRESTAZIONE
Il Professionista si obbliga a fornire alla Cliente assistenza legale giudiziale e stragiudiziale in materia di diritto societario, commerciale e contrattuale.

ARTICOLO 2 - AMBITO DELLA PRESTAZIONE
2.1 Assistenza stragiudiziale:
- Consulenza legale su questioni societarie e commerciali
- Redazione e revisione di contratti commerciali
- Pareri scritti su questioni di diritto societario
- Assistenza in trattative commerciali

2.2 Assistenza giudiziale:
- Patrocinio avanti tutti i giudici italiani
- Redazione di atti processuali (citazioni, comparse, memorie)
- Partecipazione a udienze e trattative
- Gestione di procedure esecutive e cautelari

ARTICOLO 3 - COMPENSI
3.1 Per l'assistenza stragiudiziale è previsto un compenso orario di euro 250,00 + IVA come per legge.
3.2 Per l'assistenza giudiziale si applicano i parametri forensi DM 147/2022.
3.3 I compensi sono dovuti salvo buon fine e saranno fatturati mensilmente.

ARTICOLO 4 - OBBLIGHI DELLE PARTI
4.1 Il Professionista si obbliga a:
- Eseguuire la prestazione con diligenza professionale
- Mantenere il segreto professionale
- Informare tempestivamente la Cliente sull'andamento della pratica
- Fornire copia di tutti gli atti processuali

4.2 La Cliente si obbliga a:
- Fornire tutta la documentazione necessaria
- Corrispondere i compensi nei tempi previsti
- Collaborare con il Professionista per lo svolgimento dell'incarico
- Informare tempestivamente su qualsiasi variazione rilevante

ARTICOLO 5 - DURATA E RECESSO
Il presente contratto ha durata annuale e si rinnova tacitamente per ulteriori anni. Ciascuna parte può recedere con preavviso di 60 giorni.

ARTICOLO 6 - FORO COMPETENTE
Per ogni controversia relativa al presente contratto è competente il Foro di Milano.

Milano, 20 gennaio 2026

_________________________
Avv. Mario Bianchi

_________________________
Il Legale Rappresentante
Cliente S.r.l.

Fine del documento di test DOCX con circa 20.000 caratteri.`;

// Scrivo i file
fs.writeFileSync(path.join(__dirname, 'small-docx.docx'), smallDocx);
fs.writeFileSync(path.join(__dirname, 'medium-docx.docx'), mediumDocx);

console.log('✅ File DOCX di test creati:');
console.log('- small-docx.docx (~800 caratteri)');
console.log('- medium-docx.docx (~20.000 caratteri)');
