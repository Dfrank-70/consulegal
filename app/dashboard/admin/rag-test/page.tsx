// app/dashboard/admin/rag-test/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';

export default function RagTestPage() {
  const [nodeName, setNodeName] = useState('Test Node ' + new Date().toISOString());
  const [createdNodeId, setCreatedNodeId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState('Quali sono i punti principali del documento?');
  const [isLoading, setIsLoading] = useState(false);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [answer, setAnswer] = useState<any>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleCreateNode = async () => {
    setIsLoading(true);
    addLog(`Creating node: ${nodeName}...`);
    try {
      const res = await fetch('/api/rag/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nodeName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create node');
      
      setCreatedNodeId(data.node.id);
      addLog(`✅ Node created successfully: ${data.node.id}`);
      toast.success('Node creato!');
    } catch (error: any) {
      addLog(`❌ Error creating node: ${error.message}`);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!createdNodeId) {
      toast.error('Crea prima un nodo!');
      return;
    }
    if (!file) {
      toast.error('Seleziona un file!');
      return;
    }

    setIsLoading(true);
    addLog(`Uploading file: ${file.name} to node ${createdNodeId}...`);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/rag/nodes/${createdNodeId}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      addLog(`✅ File uploaded successfully: ${JSON.stringify(data)}`);
      toast.success('Upload completato!');
    } catch (error: any) {
      addLog(`❌ Error uploading file: ${error.message}`);
      toast.error(`Errore upload: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!createdNodeId) {
      toast.error('Crea e carica un file in un nodo prima!');
      return;
    }

    setIsLoading(true);
    setAnswer(null);
    addLog(`Asking question: "${question}"...`);

    const body = {
      messages: [{ role: 'user', content: question }],
      node_ids: [createdNodeId],
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

  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold">RAG Test Page</h1>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* 1. Create Node */}
        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold">1. Create Node</h2>
          <Input
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            placeholder="Node Name"
            disabled={isLoading}
            className="bg-gray-900 text-gray-200 border-gray-700 focus:ring-blue-500"
          />
          <Button onClick={handleCreateNode} disabled={isLoading || !nodeName}>
            {isLoading ? 'Creating...' : 'Create Node'}
          </Button>
          {createdNodeId && <p className="text-sm text-green-600">Node ID: {createdNodeId}</p>}
        </div>

        {/* 2. Upload File */}
        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold">2. Upload File</h2>
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={isLoading || !createdNodeId}
            className="bg-gray-900 text-gray-400 border-gray-700 file:bg-blue-600 file:text-white file:hover:bg-blue-700"
          />
          <Button onClick={handleUpload} disabled={isLoading || !createdNodeId || !file}>
            {isLoading ? 'Uploading...' : 'Upload to Node'}
          </Button>
          <p className="text-xs text-gray-500">Max 5MB. Requires Node ID from step 1.</p>
        </div>

        {/* 3. Ask Question */}
        <div className="p-4 border rounded-lg space-y-4">
          <h2 className="text-lg font-semibold">3. Ask Question</h2>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Your question..."
            disabled={isLoading || !createdNodeId}
            className="bg-gray-900 text-gray-200 border-gray-700 focus:ring-blue-500"
          />
          <Button onClick={handleAsk} disabled={isLoading || !createdNodeId || !question}>
            {isLoading ? 'Thinking...' : 'Ask'}
          </Button>
        </div>
      </div>

      {/* Output Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Logs */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Logs</h2>
          <div className="h-64 overflow-y-auto bg-gray-900 text-green-400 p-2 rounded text-xs font-mono">
            {logs.map((log, i) => <p key={i}>{log}</p>)}
          </div>
        </div>

        {/* Answer */}
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Answer & Details</h2>
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
            <p className="text-gray-500">{isLoading ? 'Waiting for answer...' : 'Answer will appear here.'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
