'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import 'reactflow/dist/base.css';

// Tipi di dati
interface Workflow {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  allowExpertEscalation?: boolean;
  userId?: string | null;
  nodes: any[];
  edges: any[];
}

interface LLMProvider {
  id: string;
  name: string;
  isActive: boolean;
}

// Variabile globale per i provider per evitare di passarli come prop
let providers: LLMProvider[] = [];

// Componenti Nodo Personalizzati
const InputNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-green-900/50 border-2 border-green-900 text-white">
    <Handle type="source" position={Position.Right} style={{ background: '#34D399', borderColor: 'transparent' }} />
    <div className="font-bold">Input</div>
    <div className="text-sm text-green-200">Punto di ingresso</div>
  </div>
);

const LLMNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-blue-900/50 border-2 border-blue-500 text-white">
    <Handle type="target" position={Position.Left} style={{ background: '#60A5FA', borderColor: 'transparent' }} />
    <div className="font-bold">{data.providerId ? (providers.find(p => p.id === data.providerId)?.name || 'LLM') : 'LLM'}</div>
    <div className="text-sm text-blue-300">{data.model || 'Modello AI'}</div>
    {data.prompt && (
      <div className="text-xs text-slate-400 mt-1 max-w-32 truncate">
        {data.prompt}
      </div>
    )}
    <Handle type="source" position={Position.Right} style={{ background: '#60A5FA', borderColor: 'transparent' }} />
  </div>
);

const OutputNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-red-900/50 border-2 border-red-900 text-white">
    <Handle type="target" position={Position.Left} style={{ background: '#F87171', borderColor: 'transparent' }} />
    <div className="font-bold">Output</div>
    <div className="text-sm text-red-200">Risultato finale</div>
  </div>
);

const RAGNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-purple-900/50 border-2 border-purple-500 text-white">
    <Handle type="target" position={Position.Left} style={{ background: '#A78BFA', borderColor: 'transparent' }} />
    <div className="font-bold">RAG Query</div>
    <div className="text-sm text-purple-300">{data.ragNodeName || 'Non configurato'}</div>
    {data.topK && (
      <div className="text-xs text-slate-400 mt-1">Top-{data.topK}</div>
    )}
    <Handle type="source" position={Position.Right} style={{ background: '#A78BFA', borderColor: 'transparent' }} />
  </div>
);

const TestNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-yellow-900/50 border-2 border-yellow-500 text-white">
    <Handle type="target" position={Position.Left} style={{ background: '#FBBF24', borderColor: 'transparent' }} />
    <div className="font-bold">🧪 TEST</div>
    <div className="text-sm text-yellow-300">Validazione Upload</div>
    <div className="text-xs text-slate-400 mt-1">No LLM cost</div>
    <Handle type="source" position={Position.Right} style={{ background: '#FBBF24', borderColor: 'transparent' }} />
  </div>
);


export default function WorkflowEditorPage() {
  const nodeTypes: NodeTypes = {
    input: InputNode,
    llm: LLMNode,
    rag: RAGNode,
    test: TestNode,
    output: OutputNode,
  };
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const workflowId = (params?.id ?? 'new') as string;
  const isNew = workflowId === 'new';

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [allowExpertEscalation, setAllowExpertEscalation] = useState(false);
  const [workflowUserId, setWorkflowUserId] = useState<string | null>(null);
  const [isSystemWorkflow, setIsSystemWorkflow] = useState(false);

  const [localProviders, setLocalProviders] = useState<LLMProvider[]>([]);
  const [availableModels, setAvailableModels] = useState<Record<string, { id: string; input: number; output: number; }[]>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});
  const [ragNodes, setRagNodes] = useState<Array<{ id: string; name: string; }>>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const providersRes = await fetch('/api/admin/llm-providers');
        const providersData = await providersRes.json();
        providers = providersData; // Aggiorna la variabile globale
        setLocalProviders(providersData);

        const ragNodesRes = await fetch('/api/rag/nodes');
        if (ragNodesRes.ok) {
          const ragNodesData = await ragNodesRes.json();
          setRagNodes(ragNodesData.nodes || []);
        }

        if (!isNew) {
          const workflowRes = await fetch(`/api/admin/workflows/${workflowId}`);
          const workflowData: Workflow = await workflowRes.json();
          setWorkflowName(workflowData.name);
          setWorkflowDescription(workflowData.description || '');
          setIsDefault(workflowData.isDefault);
          setAllowExpertEscalation(!!workflowData.allowExpertEscalation);
          setWorkflowUserId((workflowData.userId as any) ?? null);
          setIsSystemWorkflow(!!(workflowData as any).isSystemWorkflow || workflowData.name?.startsWith('system_'));
          setNodes(workflowData.nodes || []);
          setEdges((workflowData.edges || []).map(e => ({ ...e, animated: true })));
        }
      } catch (error) {
        console.error('Errore nel caricamento dati:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isNew, workflowId, setNodes, setEdges]);

  const onConnect = useCallback((params: Edge | Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)), [setEdges]);

  const addNode = (type: string) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {},
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
    if (node.type === 'llm' && node.data.providerId) {
        handleProviderChange(node.id, node.data.providerId);
    }
  };

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    if (nodes && nodes.length > 0) {
      setSelectedNode(nodes[0]);
      setShowNodeConfig(true);
    } else {
      setSelectedNode(null);
      setShowNodeConfig(false);
    }
  }, []);

  const updateNodeData = (nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
    if (selectedNode?.id === nodeId) {
        setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
    }
  };

  const deleteSelectedNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
      setShowNodeConfig(false);
      setSelectedNode(null);
    }
  };

  const handleProviderChange = (nodeId: string, providerId: string) => {
    updateNodeData(nodeId, { providerId, model: '' });

    if (providerId && !availableModels[providerId] && !loadingModels[providerId]) {
      setLoadingModels(prev => ({ ...prev, [providerId]: true }));
      fetch(`/api/admin/llm-providers/${providerId}/models`)
        .then(res => res.json())
        .then(models => {
          if(Array.isArray(models)) {
            setAvailableModels(prev => ({ ...prev, [providerId]: models }));
          } else {
            console.error('La risposta API per i modelli non è un array:', models);
            setAvailableModels(prev => ({ ...prev, [providerId]: [] }));
          }
        })
        .catch(err => console.error(`Failed to fetch models for provider ${providerId}:`, err))
        .finally(() => setLoadingModels(prev => ({ ...prev, [providerId]: false })));
    }
  };

  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      alert('Il nome del workflow è obbligatorio');
      return;
    }

    setSaving(true);
    try {
      const workflowData = {
        name: workflowName,
        description: workflowDescription,
        isDefault,
        allowExpertEscalation,
        nodes: nodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
        edges: edges.map(({ id, source, target, data }) => ({ id, source, target, data: data || {} })),
      };


      const url = isNew ? '/api/admin/workflows' : `/api/admin/workflows/${workflowId}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(workflowData) });

      if (!response.ok) throw new Error('Errore nel salvataggio del workflow');

      router.push('/dashboard/admin/workflows');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-white">Caricamento...</div>;
  }

  if (!isNew && isSystemWorkflow) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-100 p-6">
        <div className="max-w-xl text-center space-y-4">
          <h1 className="text-2xl font-bold">System workflow (read-only)</h1>
          <p className="text-slate-300">Questo workflow è di sistema e non è modificabile tramite l'editor grafico.</p>
          <button
            onClick={() => router.push('/dashboard/admin/workflows')}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded"
          >
            Torna alla lista workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-800 text-slate-100">
      <div className="bg-slate-900 shadow-sm border-b border-slate-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-white">{isNew ? 'Nuovo Workflow' : `Modifica: ${workflowName}`}</h1></div>
          <div className="flex space-x-4">
            <button onClick={() => router.push('/dashboard/admin/workflows')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded">Annulla</button>
            <button onClick={saveWorkflow} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50">{saving ? 'Salvataggio...' : 'Salva Workflow'}</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">Nome Workflow</label>
            <input type="text" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white" placeholder="Es. Analisi Fiscale Avanzata" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">Descrizione</label>
            <input type="text" value={workflowDescription} onChange={(e) => setWorkflowDescription(e.target.value)} className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white" placeholder="Descrizione opzionale" />
          </div>
          <div className="flex items-center pt-6">
            <input type="checkbox" id="isDefault" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="mr-2 h-4 w-4 rounded" />
            <label htmlFor="isDefault" className="text-sm font-medium text-slate-300">Workflow di default</label>
          </div>
        </div>

        {!workflowName.startsWith('system_') && (
          <div className="mt-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={allowExpertEscalation}
                onChange={(e) => setAllowExpertEscalation(e.target.checked)}
                className="mr-2 h-4 w-4 rounded"
              />
              <span className="text-sm font-medium text-slate-300">Abilita escalation a esperto (mostra bottone “Chiedi parere all’esperto” in chat)</span>
            </label>
            <div className="text-xs text-slate-400 mt-1">Se attivo, l’ultima risposta della chat può essere inviata a revisione esperta (se utente abilitato).</div>
          </div>
        )}
      </div>
      <div className="flex-1 flex">
        <div className="w-64 bg-slate-900 shadow-sm border-r border-slate-700 p-4">
          <h3 className="font-bold text-white mb-4">Aggiungi Nodi</h3>
          <div className="space-y-2">
            <button onClick={() => addNode('input')} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded text-sm">+ Input</button>
            <button onClick={() => addNode('test')} className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded text-sm">🧪 Test Upload</button>
            <button onClick={() => addNode('llm')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded text-sm">+ LLM</button>
            <button onClick={() => addNode('rag')} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded text-sm">+ RAG Query</button>
            <button onClick={() => addNode('output')} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded text-sm">+ Output</button>
          </div>
          <div className="mt-8">
            <h4 className="font-medium text-white mb-2">Statistiche</h4>
            <div className="text-sm text-slate-400 space-y-1">
              <div>Nodi: {nodes.length}</div>
              <div>Connessioni: {edges.length}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-slate-900">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onSelectionChange={onSelectionChange}
            onPaneClick={() => { setShowNodeConfig(false); setSelectedNode(null); }}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <Background color="#444" gap={16} />
          </ReactFlow>
        </div>
        {showNodeConfig && selectedNode && (
          <div className="w-80 bg-slate-900 shadow-sm border-l border-slate-700 p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-white">Configura Nodo</h3>
              <button onClick={() => setShowNodeConfig(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <button onClick={deleteSelectedNode} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded text-sm mb-4">Elimina Nodo</button>
            {selectedNode.type === 'llm' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Provider</label>
                  <select value={selectedNode.data.providerId || ''} onChange={(e) => handleProviderChange(selectedNode.id, e.target.value)} className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white">
                    <option value="">Seleziona un provider</option>
                    {localProviders.map((provider) => (<option key={provider.id} value={provider.id}>{provider.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Modello</label>
                  <select
                    value={selectedNode.data.model || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                    className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white"
                    disabled={!selectedNode.data.providerId}
                  >
                    <option value="">Seleziona un modello</option>
                    {loadingModels[selectedNode.data.providerId] ? (
                      <option disabled>Caricamento modelli...</option>
                    ) : (
                      (availableModels[selectedNode.data.providerId] || []).map(model => (
                        <option key={model.id} value={model.id}>
                          {model.id} (I: ${model.input.toFixed(2)} / O: ${model.output.toFixed(2)})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Agent Instruction</label>
                  <textarea
                    value={selectedNode.data.prompt || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                    className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white"
                    rows={4}
                    placeholder="Istruzioni per questo agente..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Temperatura</label>
                  <input
                    type="number" min="0" max="2" step="0.1"
                    value={selectedNode.data.temperature || 0.7}
                    onChange={(e) => updateNodeData(selectedNode.id, { temperature: parseFloat(e.target.value) })}
                    className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white"
                  />
                </div>
              </div>
            )}
            {selectedNode.type === 'rag' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300">Nodo RAG</label>
                  <select
                    value={selectedNode.data.ragNodeId || ''}
                    onChange={(e) => {
                      const selectedRagNode = ragNodes.find(n => n.id === e.target.value);
                      updateNodeData(selectedNode.id, { 
                        ragNodeId: e.target.value,
                        ragNodeName: selectedRagNode?.name || ''
                      });
                    }}
                    className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white"
                  >
                    <option value="">Seleziona nodo RAG...</option>
                    {ragNodes.map((node) => (
                      <option key={node.id} value={node.id}>{node.name}</option>
                    ))}
                  </select>
                  {ragNodes.length === 0 && (
                    <p className="text-xs text-yellow-400 mt-1">Nessun nodo RAG disponibile. Creane uno in /admin/rag-test</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Top-K Risultati</label>
                  <input
                    type="number" min="1" max="20" step="1"
                    value={selectedNode.data.topK || 5}
                    onChange={(e) => updateNodeData(selectedNode.id, { topK: parseInt(e.target.value) })}
                    className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">Numero di chunk da recuperare dal RAG</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300">Alpha (Hybrid Balance)</label>
                  <input
                    type="number" min="0" max="1" step="0.1"
                    value={selectedNode.data.alpha || 0.5}
                    onChange={(e) => updateNodeData(selectedNode.id, { alpha: parseFloat(e.target.value) })}
                    className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">0 = solo text search, 1 = solo vector, 0.5 = bilanciato</p>
                </div>
              </div>
            )}
            {selectedNode.type === 'test' && (
              <div className="space-y-2">
                <div className="text-sm text-slate-300 font-semibold">🧪 Nodo di Test</div>
                <div className="text-sm text-slate-400">
                  Questo nodo valida l'upload dei file senza chiamare l'LLM:
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>Conta caratteri e token</li>
                    <li>Rileva allegati caricati</li>
                    <li>Mostra preview del contenuto</li>
                    <li>Nessun costo API</li>
                  </ul>
                </div>
                <div className="bg-green-900/30 border border-green-700 rounded p-2 text-xs text-green-300 mt-2">
                  ✅ Ideale per testare parsing file PDF/DOCX/TXT
                </div>
              </div>
            )}
            {selectedNode.type === 'input' && (
              <div className="text-sm text-slate-400">Il nodo di input rappresenta il punto di ingresso del workflow.</div>
            )}
            {selectedNode.type === 'output' && (
              <div className="text-sm text-slate-400">Il nodo di output rappresenta il risultato finale del workflow.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
