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


export default function WorkflowEditorPage() {
  const nodeTypes: NodeTypes = {
    input: InputNode,
    llm: LLMNode,
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

  const [localProviders, setLocalProviders] = useState<LLMProvider[]>([]);
  const [availableModels, setAvailableModels] = useState<Record<string, { id: string; input: number; output: number; }[]>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});
  
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

        if (!isNew) {
          const workflowRes = await fetch(`/api/admin/workflows/${workflowId}`);
          const workflowData: Workflow = await workflowRes.json();
          setWorkflowName(workflowData.name);
          setWorkflowDescription(workflowData.description || '');
          setIsDefault(workflowData.isDefault);
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
      </div>
      <div className="flex-1 flex">
        <div className="w-64 bg-slate-900 shadow-sm border-r border-slate-700 p-4">
          <h3 className="font-bold text-white mb-4">Aggiungi Nodi</h3>
          <div className="space-y-2">
            <button onClick={() => addNode('input')} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded text-sm">+ Input</button>
            <button onClick={() => addNode('llm')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded text-sm">+ LLM</button>
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
                  <label className="block text-sm font-medium text-slate-300">Prompt</label>
                  <textarea
                    value={selectedNode.data.prompt || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                    className="mt-1 block w-full bg-slate-700 border-slate-500 rounded-md px-3 py-2 text-white"
                    rows={4}
                    placeholder="Prompt per questo nodo..."
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
