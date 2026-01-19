import prisma from '../lib/prisma';
import { chunkText, Chunk } from '../lib/rag/chunker';
import { getEmbeddingsAdapter } from '../lib/rag/embeddings';
import { CHUNK_PRESETS } from '../lib/rag/types';

interface DocumentSeed {
  filename: string;
  content: string;
  mimeType: string;
}

const demoDocuments: DocumentSeed[] = [
  {
    filename: 'art-1321-codice-civile.txt',
    content: `Articolo 1321 - Nozione del Contratto

Il contratto è l'accordo di due o più parti per costituire, regolare o estinguere tra loro un rapporto giuridico patrimoniale.

Questo articolo definisce il contratto come lo strumento fondamentale dell'autonomia privata, attraverso il quale i soggetti di diritto possono creare, modificare o sciogliere vincoli giuridici di natura patrimoniale. Gli elementi essenziali sono:
1. L'accordo tra le parti (elemento soggettivo)
2. La patrimonialità del rapporto (elemento oggettivo)
3. La volontà di produrre effetti giuridici`,
    mimeType: 'text/plain'
  },
  {
    filename: 'art-1418-codice-civile.txt',
    content: `Articolo 1418 - Cause di Nullità del Contratto

Il contratto è nullo quando è contrario a norme imperative, salvo che la legge disponga diversamente.

Producono nullità del contratto la mancanza di uno dei requisiti indicati dall'articolo 1325, l'illiceità della causa, l'illiceità dei motivi nel caso indicato dall'articolo 1345 e la mancanza nell'oggetto dei requisiti stabiliti dall'articolo 1346.

Il contratto è altresì nullo negli altri casi stabiliti dalla legge.

Le cause di nullità sono:
- Contrarietà a norme imperative
- Mancanza di elementi essenziali (accordo, causa, oggetto, forma se richiesta)
- Illiceità della causa
- Illiceità dei motivi comuni
- Indeterminatezza/indeterminabilità dell'oggetto`,
    mimeType: 'text/plain'
  },
  {
    filename: 'art-1362-codice-civile.txt',
    content: `Articolo 1362 - Intenzione dei Contraenti

Nell'interpretare il contratto si deve indagare quale sia stata la comune intenzione delle parti e non limitarsi al senso letterale delle parole.

Per determinare la comune intenzione delle parti, si deve valutare il loro comportamento complessivo anche posteriore alla conclusione del contratto.

Questo principio privilegia l'interpretazione soggettiva del contratto, cercando di ricostruire la reale volontà dei contraenti al momento della stipula. Il giudice deve quindi andare oltre il mero testo scritto per individuare l'effettivo accordo raggiunto.`,
    mimeType: 'text/plain'
  },
  {
    filename: 'sent-cassazione-rescissione-2023.txt',
    content: `Sentenza Cassazione n. 15678/2023 - Clausola Rescissoria

La Corte di Cassazione ha stabilito che le clausole rescissorie inserite nei contratti di locazione commerciale devono rispettare i seguenti requisiti:

1. Specificità: La clausola deve indicare chiaramente le condizioni che legittimano la risoluzione anticipata
2. Proporzionalità: Le penali previste devono essere proporzionate al danno effettivo
3. Buona fede: L'esercizio del diritto di recesso deve avvenire in conformità ai principi di correttezza e buona fede

Nel caso di specie, la Corte ha ritenuto invalida una clausola che permetteva al locatore di recedere senza preavviso e senza giustificato motivo, in quanto lesiva dell'equilibrio contrattuale e contraria all'art. 1375 c.c.

La sentenza conferma l'orientamento secondo cui le clausole vessatorie nei contratti tra professionisti devono essere oggetto di specifica trattativa e non possono alterare significativamente l'equilibrio sinallagmatico.`,
    mimeType: 'text/plain'
  },
  {
    filename: 'locazioni-commerciali-post-2020.txt',
    content: `Normativa Locazioni Commerciali Post-2020

Con il D.L. 137/2020 convertito in L. 176/2020, il legislatore ha introdotto importanti novità per le locazioni commerciali:

Art. 3-bis: Obblighi informativi
Il locatore deve fornire al conduttore, prima della stipula:
- Certificazione energetica dell'immobile
- Informazioni su vincoli urbanistici
- Stato di conformità catastale

Art. 4: Rinegoziazione canoni
In caso di eventi straordinari (pandemie, calamità), le parti hanno diritto a richiedere la rinegoziazione del canone secondo criteri di equità.

Art. 5: Durata minima
Per locazioni commerciali stipulate dal 1° gennaio 2021:
- Durata minima: 6 anni per attività commerciali
- Durata minima: 9 anni per attività alberghiere
- Prima scadenza: diritto di rinnovo automatico se non comunicato recesso con 12 mesi anticipo

Queste norme sono imperative e non derogabili dalle parti.`,
    mimeType: 'text/plain'
  }
];

async function seedRAGDemo() {
  console.log('🌱 Starting RAG demo seed...\n');

  try {
    // Crea nodo RAG demo
    console.log('📦 Creating demo RAG node...');
    const ragNode = await prisma.ragNode.create({
      data: {
        name: 'Demo Codice Civile',
        description: 'Nodo demo con articoli selezionati del Codice Civile e sentenze per investor pitch'
      }
    });
    console.log(`✅ RAG node created: ${ragNode.id}\n`);

    // Processa ogni documento
    for (const doc of demoDocuments) {
      console.log(`📄 Processing: ${doc.filename}`);

      // Simula file buffer
      const fileBuffer = Buffer.from(doc.content, 'utf-8');

      // Parse documento
      console.log('  - Parsing...');
      const parsedText = doc.content; // Per testo plain non serve parsing

      // Chunk documento
      console.log('  - Chunking...');
      const chunks: Chunk[] = await chunkText(parsedText, {
        chunkSize: 500,
        overlap: 100
      });
      console.log(`  - Created ${chunks.length} chunks`);

      // Salva documento nel database
      const ragDocument = await prisma.ragDocument.create({
        data: {
          nodeId: ragNode.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          sizeBytes: fileBuffer.length,
          storagePath: `/demo/${doc.filename}`,
          metadata: {
            uploadedAt: new Date().toISOString(),
            type: 'demo'
          }
        }
      });

      // Salva chunks
      const chunkRecords = await Promise.all(
        chunks.map((chunk: Chunk, index: number) =>
          prisma.ragChunk.create({
            data: {
              documentId: ragDocument.id,
              content: chunk.content,
              chunkIndex: index,
              startChar: chunk.startChar,
              endChar: chunk.endChar,
              metadata: {}
            }
          })
        )
      );

      // Genera embeddings
      console.log('  - Generating embeddings...');
      const embeddingsAdapter = getEmbeddingsAdapter();
      const texts = chunks.map((c: Chunk) => c.content);
      const embeddings = await embeddingsAdapter.embed(texts);

      // Salva embeddings
      await Promise.all(
        chunkRecords.map((chunkRecord: any, index: number) =>
          prisma.$executeRaw`
            INSERT INTO rag_embeddings (id, "chunkId", embedding, model, dimension, "createdAt")
            VALUES (
              gen_random_uuid()::text,
              ${chunkRecord.id},
              ${JSON.stringify(embeddings[index])}::vector,
              ${embeddingsAdapter.getModel()},
              ${embeddingsAdapter.getDimension()},
              NOW()
            )
          `
        )
      );

      console.log(`  ✅ ${doc.filename} completed\n`);
    }

    console.log('\n🎉 RAG demo seed completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - RAG Node ID: ${ragNode.id}`);
    console.log(`   - Documents: ${demoDocuments.length}`);
    console.log(`\n💡 Use this Node ID in your workflow RAG node configuration.`);

  } catch (error) {
    console.error('❌ Error seeding RAG demo:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedRAGDemo();
