'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { CheckCircle, File as FileIcon, FileText, FileType2, ArrowLeft, Database, Pencil, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface RagNode {
  id: string;
  name: string;
  createdAt: string;
}

export default function RagNodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: nodeId } = use(params);
  const MAX_CLIENT_FILE_SIZE = 1 * 1024 * 1024;

  const [node, setNode] = useState<RagNode | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadItems, setUploadItems] = useState<
    Array<{
      name: string;
      sizeBytes: number;
      mimeType: string;
      status: 'queued' | 'uploading' | 'done' | 'error' | 'too_large';
      progress: number;
      error?: string;
    }>
  >([]);
  const [currentUploadName, setCurrentUploadName] = useState<string | null>(null);
  const [question, setQuestion] = useState('Quali sono i punti principali del documento?');
  const [isLoading, setIsLoading] = useState(false);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [answer, setAnswer] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const documentsByFilename = new Map<string, any>(documents.map((d) => [d.filename, d]));
  const uploadFilenames = new Set(uploadItems.map((it) => it.name));

  const getFileIcon = (doc: any) => {
    const name: string = (doc?.filename || '').toLowerCase();
    const mime: string = (doc?.mimeType || '').toLowerCase();

    if (mime.includes('pdf') || name.endsWith('.pdf')) return <FileIcon className="h-4 w-4 text-red-400" />;
    if (mime.includes('text') || name.endsWith('.txt')) return <FileText className="h-4 w-4 text-gray-300" />;
    if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) return <FileType2 className="h-4 w-4 text-blue-400" />;
    return <FileIcon className="h-4 w-4 text-gray-300" />;
  };

  const getUploadItemIcon = (it: { name: string; mimeType: string }) => {
    const name = (it?.name || '').toLowerCase();
    const mime = (it?.mimeType || '').toLowerCase();
    if (mime.includes('pdf') || name.endsWith('.pdf')) return <FileIcon className="h-4 w-4 text-red-400" />;
    if (mime.includes('text') || name.endsWith('.txt')) return <FileText className="h-4 w-4 text-gray-300" />;
    if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) return <FileType2 className="h-4 w-4 text-blue-400" />;
    return <FileIcon className="h-4 w-4 text-gray-300" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const validSelectedFiles = files.filter((f) => f.size <= MAX_CLIENT_FILE_SIZE);
  const hasValidSelectedFiles = validSelectedFiles.length > 0;

  const uploadDisabledReason = (() => {
    if (isLoading) return 'Caricamento in corso…';
    if (files.length === 0) return 'Seleziona almeno un file.';
    if (!hasValidSelectedFiles) return 'Nessun file valido (max 1MB).';
    return '';
  })();

  const validUploadCount = uploadItems.filter((it) => it.status !== 'too_large').length;
  const doneUploadCount = uploadItems.filter((it) => it.status === 'done').length;
  const hasValidUploads = validUploadCount > 0;

  const overallProgress = (() => {
    if (!hasValidUploads) return 0;
    return Math.round((doneUploadCount / validUploadCount) * 100);
  })();

  const buildUploadItems = (selected: File[]) => {
    const seen = new Set<string>();
    return selected
      .filter((f) => {
        if (seen.has(f.name)) return false;
        seen.add(f.name);
        return true;
      })
      .map((f) => {
        const tooLarge = f.size > MAX_CLIENT_FILE_SIZE;
        return {
          name: f.name,
          sizeBytes: f.size,
          mimeType: f.type || '',
          status: tooLarge ? ('too_large' as const) : ('queued' as const),
          progress: 0,
          error: tooLarge ? 'Supera il limite di 1MB' : undefined,
        };
      });
  };

  const selectedPreviewItems = buildUploadItems(files);

  const mergeUploadItems = (prev: typeof uploadItems, next: ReturnType<typeof buildUploadItems>) => {
    const byName = new Map(prev.map((it) => [it.name, it] as const));
    for (const it of next) {
      const existing = byName.get(it.name);
      byName.set(it.name, { ...(existing ?? {}), ...it });
    }
    return Array.from(byName.values());
  };

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  const refreshDocuments = useCallback(async () => {
    setIsDocsLoading(true);
    try {
      const res = await fetch(`/api/rag/nodes/${nodeId}/documents`, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');
      setDocuments(data.documents || []);
    } catch (error: any) {
      setDocuments([]);
      addLog(`❌ Error fetching documents: ${error.message}`);
    } finally {
      setIsDocsLoading(false);
    }
  }, [nodeId, addLog]);

  const fetchNode = useCallback(async () => {
    try {
      const res = await fetch(`/api/rag/nodes/${nodeId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch node');
      setNode(data);
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
      router.push('/dashboard/admin/rag');
    }
  }, [nodeId, router]);

  useEffect(() => {
    fetchNode();
    refreshDocuments();
  }, [fetchNode, refreshDocuments]);

  useEffect(() => {
    if (files.length === 0) {
      addLog('Picker: state files = 0');
      return;
    }
    addLog(
      `Picker: state files = ${files.length}: ${files
        .map((f) => `${f.name} (${f.size} bytes)`) 
        .join(', ')}`
    );
  }, [files, addLog]);

  const handlePickFiles = async () => {
    if (isLoading) return;
    try {
      const anyWindow = window as any;
      if (typeof anyWindow.showOpenFilePicker !== 'function') {
        toast.error('Selezione file non supportata in questo browser. Usa il drag&drop.');
        return;
      }

      const handles = await anyWindow.showOpenFilePicker({
        multiple: true,
        types: [
          {
            description: 'Documenti',
            accept: {
              'text/plain': ['.txt'],
              'application/pdf': ['.pdf'],
              'application/msword': ['.doc'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            },
          },
        ],
      });

      const picked: File[] = [];
      for (const h of handles) {
        const f = await h.getFile();
        picked.push(f);
      }
      if (picked.length > 0) {
        setFiles(picked);
      }
      addLog(`Picker: selezionati ${picked.length} file (showOpenFilePicker)${picked.length ? `: ${picked.map((f) => f.name).join(', ')}` : ''}`);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      toast.error(`Selezione file fallita: ${err?.message || String(err)}`);
    }
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      toast.error('Seleziona almeno un file!');
      return;
    }

    setUploadItems((prev) => mergeUploadItems(prev, buildUploadItems(files)));

    const validFiles = files.filter((f) => f.size <= MAX_CLIENT_FILE_SIZE);
    if (validFiles.length === 0) {
      toast.error('Nessun file valido: superano tutti il limite di 1MB.');
      return;
    }

    setIsLoading(true);
    try {
      let okCount = 0;
      let failCount = 0;

      for (const file of validFiles) {
        setCurrentUploadName(file.name);
        setUploadItems((prev) =>
          prev.map((it) =>
            it.name === file.name && it.status !== 'done'
              ? { ...it, status: 'uploading', progress: 0, error: undefined }
              : it
          )
        );

        addLog(`Uploading file: ${file.name} to node ${nodeId}...`);

        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch(`/api/rag/nodes/${nodeId}/upload`, {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload failed');

          okCount += 1;
          setUploadItems((prev) =>
            prev.map((it) =>
              it.name === file.name ? { ...it, status: 'done', progress: 100, error: undefined } : it
            )
          );
          addLog(`✅ File uploaded successfully: ${JSON.stringify(data)}`);
        } catch (err: any) {
          failCount += 1;
          setUploadItems((prev) =>
            prev.map((it) =>
              it.name === file.name
                ? { ...it, status: 'error', progress: 100, error: err.message }
                : it
            )
          );
          addLog(`❌ Error uploading file: ${err.message}`);
        }
      }

      if (okCount > 0 && failCount === 0) toast.success('Upload completato!');
      if (okCount > 0 && failCount > 0) toast.success(`Upload parziale: ${okCount} ok, ${failCount} errori`);
      if (okCount === 0 && failCount > 0) toast.error('Upload fallito');

      await refreshDocuments();
    } finally {
      setCurrentUploadName(null);
      setIsLoading(false);
      setFiles([]);
    }
  };

  const handleDeleteDocument = async (docId: string, filename: string) => {
    const ok = window.confirm(`Eliminare definitivamente "${filename}"?`);
    if (!ok) return;

    setIsLoading(true);
    addLog(`Deleting document: ${filename}...`);
    try {
      const res = await fetch(`/api/rag/nodes/${nodeId}/documents/${docId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      addLog(`✅ Document deleted: ${filename}`);
      toast.success('Documento eliminato');
      setUploadItems((prev) => prev.filter((it) => it.name !== filename));
      await refreshDocuments();
    } catch (error: any) {
      addLog(`❌ Error deleting document: ${error.message}`);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAsk = async () => {
    setIsLoading(true);
    setAnswer(null);
    addLog(`Asking question: "${question}"...`);

    const body = {
      messages: [{ role: 'user', content: question }],
      node_ids: [nodeId],
      llm: { 
        provider: 'openai', 
        model: 'gpt-4o-mini', 
        max_tokens: 1000, 
        temperature: 0.2 
      },
      retrieval: { 
        hybrid: true, 
        top_k: 20, 
        return_k: 6 
      },
    };

    try {
      const res = await fetch('/api/rag/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get answer');

      setAnswer(data);
      addLog('✅ Answer received.');
      toast.success('Risposta ricevuta!');
    } catch (error: any) {
      addLog(`❌ Error asking question: ${error.message}`);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEditName = () => {
    setEditedName(node?.name || '');
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleSaveEditName = async () => {
    if (!editedName.trim()) {
      toast.error('Il nome non può essere vuoto');
      return;
    }

    try {
      const res = await fetch(`/api/rag/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update name');

      setNode(data);
      setIsEditingName(false);
      toast.success('Nome aggiornato');
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
    }
  };

  if (!node) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/admin/rag')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-2xl font-bold h-10 max-w-md"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEditName();
                    if (e.key === 'Escape') handleCancelEditName();
                  }}
                />
                <Button size="sm" variant="ghost" onClick={handleSaveEditName}>
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEditName}>
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{node.name}</h1>
                <Button size="sm" variant="ghost" onClick={handleStartEditName}>
                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
              </div>
            )}
            <p className="text-sm text-muted-foreground">ID: {node.id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold">Upload Documenti</h2>
          <div
            className="rounded border border-dashed border-gray-700 bg-gray-950 p-3 text-sm text-gray-300"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isLoading) return;
              const dropped = Array.from(e.dataTransfer?.files || []);
              if (dropped.length > 0) {
                setFiles(dropped);
                addLog(`Picker: selezionati ${dropped.length} file (drag&drop): ${dropped.map((f) => f.name).join(', ')}`);
              }
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">Trascina qui i file</div>
                <div className="text-xs text-gray-400">oppure usa il pulsante</div>
              </div>
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  addLog('Picker: click Seleziona file');
                  handlePickFiles();
                }}
              >
                Seleziona file
              </Button>
            </div>
          </div>

          {selectedPreviewItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-400">File selezionati:</div>
              {selectedPreviewItems.map((it) => (
                <div key={`selected-${it.name}`} className="flex items-start justify-between gap-3 rounded bg-gray-950 px-3 py-2 text-xs text-gray-300">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <div className="mt-0.5">{getUploadItemIcon(it)}</div>
                    <div className="min-w-0">
                      <div className="break-words font-medium">{it.name}</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        {it.mimeType || '—'} · {formatBytes(it.sizeBytes)}
                        {it.status === 'too_large' ? ' · troppo grande (max 1MB)' : ''}
                      </div>
                    </div>
                  </div>
                  {it.status === 'too_large' ? (
                    <div className="shrink-0 text-[11px] text-red-400">Non valido</div>
                  ) : (
                    <div className="shrink-0 text-[11px] text-green-500">Pronto</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Button onClick={handleUpload} disabled={isLoading || files.length === 0 || !hasValidSelectedFiles}>
            {isLoading ? 'Uploading...' : 'Upload to Node'}
          </Button>
          {uploadDisabledReason && (
            <div className="text-xs text-gray-500">
              {uploadDisabledReason}
            </div>
          )}
          <p className="text-xs text-gray-500">Max 1MB per file. Supportati: TXT, PDF, DOC, DOCX</p>
        </div>

        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold">Interroga Documenti</h2>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="La tua domanda..."
            disabled={isLoading}
            className="bg-gray-900 text-gray-200 border-gray-700 focus:ring-blue-500"
          />
          <Button onClick={handleAsk} disabled={isLoading || !question}>
            {isLoading ? 'Thinking...' : 'Chiedi'}
          </Button>
        </div>
      </div>

      <div className="p-4 border rounded-lg space-y-4">
        <h2 className="text-lg font-semibold">Documenti caricati</h2>
        <div className="space-y-2">
          {uploadItems.length > 0 && (
            <div className="flex items-center justify-between rounded bg-gray-950 px-3 py-2 text-xs text-gray-300">
              <div>
                {doneUploadCount}/{validUploadCount} completati
                {currentUploadName ? ` · in corso: ${currentUploadName}` : ''}
              </div>
              <div>{overallProgress}%</div>
            </div>
          )}

          {uploadItems.map((it) => {
            const doc = documentsByFilename.get(it.name);
            const mimeType = doc?.mimeType || it.mimeType || '—';
            const sizeBytes = doc?.sizeBytes ?? it.sizeBytes;
            const chunksCount = doc?._count?.chunks;

            const statusLabel =
              it.status === 'too_large'
                ? ' · troppo grande (max 1MB)'
                : it.status === 'queued'
                  ? ' · in coda'
                  : it.status === 'uploading'
                    ? ' · elaborazione in corso'
                    : it.status === 'done'
                      ? ''
                      : it.status === 'error'
                        ? ' · errore'
                        : '';

            return (
              <div key={`upload-${it.name}`} className="flex items-start justify-between gap-3 rounded bg-gray-900 p-3 text-sm text-gray-200">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5">{doc ? getFileIcon(doc) : getUploadItemIcon(it)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 break-words font-medium leading-snug">
                      <span className="break-words">{it.name}</span>
                      {it.status === 'done' && (
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {mimeType} · {typeof sizeBytes === 'number' ? `${sizeBytes} bytes` : sizeBytes}
                      {typeof chunksCount === 'number' ? ` · chunks: ${chunksCount}` : ''}
                      {statusLabel}
                    </div>
                    {it.error && <div className="mt-1 text-xs text-red-400">{it.error}</div>}

                    {it.status !== 'done' && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-gray-800">
                        <div
                          className={`h-full transition-all ${
                            it.status === 'uploading'
                              ? 'bg-blue-600/70 animate-pulse'
                              : it.status === 'error' || it.status === 'too_large'
                                ? 'bg-red-600'
                                : 'bg-blue-600'
                          }`}
                          style={{ width: it.status === 'uploading' ? '100%' : `${it.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {doc && it.status === 'done' ? (
                  <Button
                    onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                    disabled={isLoading}
                    variant="destructive"
                  >
                    Elimina
                  </Button>
                ) : (
                  <div className="shrink-0 text-xs text-gray-400">
                    {it.status === 'uploading' ? '…' : it.status === 'done' ? '' : `${it.progress}%`}
                  </div>
                )}
              </div>
            );
          })}

          {isDocsLoading ? (
            <p className="text-xs text-gray-500">Caricamento...</p>
          ) : documents.length === 0 && uploadItems.length === 0 ? (
            <p className="text-xs text-gray-500">Nessun documento caricato.</p>
          ) : (
            documents
              .filter((doc) => !uploadFilenames.has(doc.filename))
              .map((doc) => (
              <div key={doc.id} className="flex items-start justify-between gap-3 rounded bg-gray-900 p-3 text-sm text-gray-200">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 text-gray-300">{getFileIcon(doc)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-medium leading-snug">{doc.filename}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {doc.mimeType} · {doc.sizeBytes} bytes · chunks: {doc._count?.chunks ?? 0}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                  disabled={isLoading}
                  variant="destructive"
                >
                  Elimina
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Logs</h2>
          <div className="h-64 overflow-y-auto bg-gray-900 text-green-400 p-2 rounded text-xs font-mono">
            {logs.map((log, i) => <p key={i}>{log}</p>)}
          </div>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Risposta & Dettagli</h2>
          {answer ? (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-bold">Answer:</h3>
                <p className="p-2 bg-gray-900 text-gray-200 rounded whitespace-pre-wrap">{answer.answer}</p>
              </div>
              <div>
                <h3 className="font-bold">Citations:</h3>
                <pre className="h-32 overflow-y-auto p-2 bg-gray-800 text-white rounded text-xs">
                  {JSON.stringify(answer.citations, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="font-bold">Telemetry:</h3>
                <pre className="p-2 bg-gray-800 text-white rounded text-xs">
                  {JSON.stringify(answer.telemetry, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">{isLoading ? 'Waiting for answer...' : 'La risposta apparirà qui.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
