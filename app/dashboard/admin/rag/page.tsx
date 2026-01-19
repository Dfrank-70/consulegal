'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { Database, Plus, FileText, Trash2, Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RagNode {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    documents: number;
  };
}

export default function GestioneRagPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<RagNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');

  const fetchNodes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rag/nodes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch nodes');
      setNodes(data.nodes || []);
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleCreateNode = async () => {
    if (!newNodeName.trim()) {
      toast.error('Inserisci un nome per il nodo');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/rag/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNodeName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create node');

      toast.success('Nodo creato!');
      setNewNodeName('');
      setShowCreateForm(false);
      await fetchNodes();
      router.push(`/dashboard/admin/rag/${data.node.id}`);
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNode = async (nodeId: string, nodeName: string) => {
    const ok = window.confirm(`Eliminare definitivamente il nodo "${nodeName}"? Verranno eliminati tutti i documenti, chunks ed embeddings associati.`);
    if (!ok) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/rag/nodes/${nodeId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete node');

      toast.success('Nodo eliminato');
      await fetchNodes();
    } catch (error: any) {
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Gestione RAG</h1>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo Nodo
          </Button>
        </div>
        <p className="text-muted-foreground">
          Gestisci i nodi RAG (Retrieval-Augmented Generation) per caricare e interrogare documenti.
        </p>
      </div>

      {showCreateForm && (
        <div className="mb-6 p-4 border border-gray-700 rounded-lg bg-gray-900/50">
          <h2 className="text-lg font-semibold mb-3">Crea Nuovo Nodo</h2>
          <div className="flex gap-3">
            <Input
              value={newNodeName}
              onChange={(e) => setNewNodeName(e.target.value)}
              placeholder="Nome nodo (es. Knowledge Base Legale)"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateNode()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleCreateNode} disabled={isLoading || !newNodeName.trim()}>
              Crea
            </Button>
            <Button variant="outline" onClick={() => { setShowCreateForm(false); setNewNodeName(''); }} disabled={isLoading}>
              Annulla
            </Button>
          </div>
        </div>
      )}

      {isLoading && nodes.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="text-center py-12 border border-gray-700 rounded-lg bg-gray-950">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nessun nodo RAG</h3>
          <p className="text-muted-foreground mb-4">
            Crea il tuo primo nodo per iniziare a caricare documenti.
          </p>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crea Primo Nodo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="flex items-center justify-between p-4 border border-gray-700 rounded-lg bg-gray-900/50 hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <Database className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1">{node.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {node._count.documents} {node._count.documents === 1 ? 'documento' : 'documenti'}
                    </span>
                    <span>•</span>
                    <span>Creato il {new Date(node.createdAt).toLocaleDateString('it-IT')}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground font-mono">
                    ID: {node.id}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link 
                  href={`/dashboard/admin/rag/${node.id}`}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-600 bg-gray-800 hover:bg-gray-700 h-9 px-3"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Gestisci
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteNode(node.id, node.name)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
