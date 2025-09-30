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

// Componenti personalizzati per i nodi
const InputNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-green-100 border-2 border-green-500">
    <Handle type="source" position={Position.Right} />
    <div className="font-bold">Input</div>
    <div className="text-sm text-gray-600">Punto di ingresso</div>
  </div>
);

const LLMNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-blue-100 border-2 border-blue-500">
    <Handle type="target" position={Position.Left} />
    <div className="font-bold">{data.provider || 'LLM'}</div>
    <div className="text-sm text-gray-600">{data.model || 'Modello AI'}</div>
    {data.prompt && (
      <div className="text-xs text-gray-500 mt-1 max-w-32 truncate">
        {data.prompt}
      </div>
    )}
    <Handle type="source" position={Position.Right} />
  </div>
);

const OutputNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-red-100 border-2 border-red-500">
    <Handle type="target" position={Position.Left} />
    <div className="font-bold">Output</div>
    <div className="text-sm text-gray-600">Risultato finale</div>
  </div>
);

const nodeTypes: NodeTypes = {
  input: InputNode,
  llm: LLMNode,
  output: OutputNode,
};

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  nodes: any[];
  edges: any[];
}

interface Provider {
  id: string;
  name: string;
  isActive: boolean;
  config: {
    models?: string[];
    defaultModel?: string;
  };
}

export default function WorkflowEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;
  const isNew = workflowId === 'new';

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user?.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchProviders();
    if (!isNew) {
      fetchWorkflow();
    } else {
      setLoading(false);
    }
  }, [session, status, router, workflowId, isNew]);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/llm-providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch (error) {
      console.error('Errore nel caricamento dei provider:', error);
    }
  };

  const fetchWorkflow = async () => {
    try {
      const response = await fetch(`/api/admin/workflows/${workflowId}`);
      if (!response.ok) {
        throw new Error('Workflow non trovato');
      }
      const data = await response.json();
      setWorkflow(data);
      setWorkflowName(data.name);
      setWorkflowDescription(data.description || '');
      setIsDefault(data.isDefault);

      // Converti i nodi e edge dal database al formato React Flow
      const flowNodes = data.nodes.map((node: any) => ({
        id: node.nodeId,
        type: node.type,
        position: node.position,
        data: node.data,
      }));

      const flowEdges = data.edges.map((edge: any) => ({
        id: edge.edgeId,
        source: edge.sourceId,
        target: edge.targetId,
        data: edge.data,
        animated: true, // Aggiunge l'animazione
        style: { strokeWidth: 2 }, // Aumenta lo spessore
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error('Errore nel caricamento del workflow:', error);
      router.push('/admin/workflows');
    } finally {
      setLoading(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        animated: true,
        style: { strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: {
        ...(type === 'llm' && {
          provider: 'OpenAI',
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 1000,
          prompt: '',
          customInstruction: '',
        }),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  };

  const updateNodeData = (nodeId: string, newData: any) => {
    let updatedNode;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const finalData = { ...node.data, ...newData };

          // Se il provider cambia, resetta il modello al primo disponibile
          if (newData.provider) {
            const newProvider = providers.find(p => p.name === newData.provider);
            const defaultModel = newProvider?.config?.models?.[0] || '';
            finalData.model = defaultModel;
          }

          updatedNode = { ...node, data: finalData };
          return updatedNode;
        }
        return node;
      })
    );

    if (updatedNode) {
      setSelectedNode(updatedNode);
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
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge.data || {},
        })),
      };

      const url = isNew ? '/api/admin/workflows' : `/api/admin/workflows/${workflowId}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowData),
      });

      if (!response.ok) {
        throw new Error('Errore nel salvataggio del workflow');
      }

      router.push('/admin/workflows');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }

  if (!session || session.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'Nuovo Workflow' : `Modifica: ${workflowName}`}
            </h1>
          </div>
          <div className="flex space-x-4">
            <button
              onClick={() => router.push('/admin/workflows')}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Annulla
            </button>
            <button
              onClick={saveWorkflow}
              disabled={saving}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva Workflow'}
            </button>
          </div>
        </div>

        {/* Workflow Settings */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Workflow</label>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Es. Analisi Fiscale Avanzata"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Descrizione</label>
            <input
              type="text"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Descrizione opzionale"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">
              Workflow di default
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar con strumenti */}
        <div className="w-64 bg-white shadow-sm border-r p-4">
          <h3 className="font-bold text-gray-900 mb-4">Aggiungi Nodi</h3>
          <div className="space-y-2">
            <button
              onClick={() => addNode('input')}
              className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm"
            >
              + Input
            </button>
            <button
              onClick={() => addNode('llm')}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm"
            >
              + LLM
            </button>
            <button
              onClick={() => addNode('output')}
              className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm"
            >
              + Output
            </button>
          </div>

          {/* Informazioni */}
          <div className="mt-8">
            <h4 className="font-medium text-gray-900 mb-2">Statistiche</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Nodi: {nodes.length}</div>
              <div>Connessioni: {edges.length}</div>
            </div>
          </div>
        </div>

        {/* Canvas principale */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <Background />
          </ReactFlow>
        </div>

        {/* Panel di configurazione nodo */}
        {showNodeConfig && selectedNode && (
          <div className="w-80 bg-white shadow-sm border-l p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900">Configura Nodo</h3>
              <button
                onClick={() => setShowNodeConfig(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {selectedNode.type === 'llm' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Provider</label>
                  <select
                    value={selectedNode.data.provider || 'OpenAI'}
                    onChange={(e) => updateNodeData(selectedNode.id, { provider: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.name}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Modello</label>
                  <select
                    value={selectedNode.data.model || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Seleziona un modello</option>
                    {(providers.find(p => p.name === selectedNode.data.provider)?.config?.models || []).map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Custom Instruction</label>
                  <textarea
                    value={selectedNode.data.customInstruction || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { customInstruction: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Istruzioni specifiche per questo nodo..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Prompt</label>
                  <textarea
                    value={selectedNode.data.prompt || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={4}
                    placeholder="Prompt per questo nodo..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Temperatura</label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={selectedNode.data.temperature || 0.7}
                    onChange={(e) => updateNodeData(selectedNode.id, { temperature: parseFloat(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Max Tokens</label>
                  <input
                    type="number"
                    min="1"
                    max="4000"
                    value={selectedNode.data.maxTokens || 1000}
                    onChange={(e) => updateNodeData(selectedNode.id, { maxTokens: parseInt(e.target.value) })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            )}

            {selectedNode.type === 'input' && (
              <div className="text-sm text-gray-600">
                Il nodo di input rappresenta il punto di ingresso del workflow. 
                L'input dell'utente verrà elaborato a partire da questo nodo.
              </div>
            )}

            {selectedNode.type === 'output' && (
              <div className="text-sm text-gray-600">
                Il nodo di output rappresenta il risultato finale del workflow. 
                Il contenuto di questo nodo sarà restituito all'utente.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
