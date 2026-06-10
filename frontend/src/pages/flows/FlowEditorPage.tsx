import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toast } from 'sonner';
import { ArrowLeft, Save, Play, Pause, ChevronRight } from 'lucide-react';
import { useFlowStore } from '@/stores/flow.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import NodePanel from '@/components/flow-editor/NodePanel';
import NodePropertiesPanel from '@/components/flow-editor/NodePropertiesPanel';
import StartNode from '@/components/flow-editor/nodes/StartNode';
import MessageNode from '@/components/flow-editor/nodes/MessageNode';
import QuestionNode from '@/components/flow-editor/nodes/QuestionNode';
import ButtonsNode from '@/components/flow-editor/nodes/ButtonsNode';
import ConditionNode from '@/components/flow-editor/nodes/ConditionNode';
import AiResponseNode from '@/components/flow-editor/nodes/AiResponseNode';
import DelayNode from '@/components/flow-editor/nodes/DelayNode';
import EndNode from '@/components/flow-editor/nodes/EndNode';
import { type BaseNodeData } from '@/components/flow-editor/nodes/BaseNode';

const nodeTypesMap = {
  start: StartNode,
  message: MessageNode,
  question: QuestionNode,
  buttons: ButtonsNode,
  condition: ConditionNode,
  ai_response: AiResponseNode,
  delay: DelayNode,
  end: EndNode,
};

let nodeIdCounter = 1;
function generateNodeId() {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

const defaultNodeData: Record<string, Partial<BaseNodeData>> = {
  start: { triggerKeyword: '' },
  message: { text: '' },
  question: { question: '', variable: '', validationType: 'text' },
  buttons: { bodyText: '', buttons: [] },
  condition: { conditionVariable: '', operator: 'equals', value: '' },
  ai_response: { instructions: '', maxTokens: 500 },
  delay: { seconds: 3 },
  end: { finalMessage: '' },
};

export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentFlow,
    fetchFlow,
    updateFlow,
    activateFlow,
    deactivateFlow,
    isSaving,
    isDirty,
    setNodes: storeSetNodes,
    setEdges: storeSetEdges,
  } = useFlowStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<BaseNodeData> | null>(null);
  const [flowName, setFlowName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load flow on mount
  useEffect(() => {
    if (id) {
      fetchFlow(id).catch(() => {
        toast.error('Error al cargar el flujo');
        navigate('/flows');
      });
    }
  }, [id, fetchFlow, navigate]);

  // Sync store flow to local state
  useEffect(() => {
    if (currentFlow) {
      setFlowName(currentFlow.name);
      const flowNodes = Array.isArray(currentFlow.nodes) ? currentFlow.nodes : [];
      const flowEdges = Array.isArray(currentFlow.edges) ? currentFlow.edges : [];
      setNodes(flowNodes as Node[]);
      setEdges(flowEdges as Edge[]);
    }
  }, [currentFlow, setNodes, setEdges]);

  // Auto-save every 30 seconds if dirty
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (isDirty && id) {
        handleSave();
      }
    }, 30000);
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, id, nodes, edges, flowName]);

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateFlow(id, {
        name: flowName,
        nodes: nodes as Node[],
        edges: edges as Edge[],
      });
      toast.success('Flujo guardado');
    } catch {
      toast.error('Error al guardar el flujo');
    }
  };

  const handleToggleStatus = async () => {
    if (!id || !currentFlow) return;
    try {
      if (currentFlow.status === 'ACTIVE') {
        await deactivateFlow(id);
        toast.success('Flujo desactivado');
      } else {
        await activateFlow(id);
        toast.success('Flujo activado');
      }
    } catch {
      toast.error('Error al cambiar el estado');
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge({ ...params, animated: true }, edges);
      setEdges(newEdges);
      storeSetEdges(newEdges);
    },
    [edges, setEdges, storeSetEdges]
  );

  const onNodeClick = useCallback((_evt: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<BaseNodeData>);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !rfInstance || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = rfInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node<BaseNodeData> = {
        id: generateNodeId(),
        type,
        position,
        data: { ...(defaultNodeData[type] ?? {}) } as BaseNodeData,
      };

      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      storeSetNodes(newNodes);
      setSelectedNode(newNode);
    },
    [rfInstance, nodes, setNodes, storeSetNodes]
  );

  const handleNodeDataChange = useCallback(
    (nodeId: string, newData: Partial<BaseNodeData>) => {
      const updatedNodes = nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n
      );
      setNodes(updatedNodes);
      storeSetNodes(updatedNodes);
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev
      );
    },
    [nodes, setNodes, storeSetNodes]
  );

  if (!currentFlow) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Cargando editor...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background z-10 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate('/flows')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <ChevronRight className="w-3 h-3 text-muted-foreground" />

        {isEditingName ? (
          <Input
            autoFocus
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            className="h-8 text-sm font-semibold w-48"
          />
        ) : (
          <button
            className="text-sm font-semibold hover:text-primary transition-colors px-1"
            onClick={() => setIsEditingName(true)}
            title="Click para editar el nombre"
          >
            {flowName}
          </button>
        )}

        <div className="flex-1" />

        <Badge
          variant={currentFlow.status === 'ACTIVE' ? 'default' : 'secondary'}
          className="text-xs"
        >
          {currentFlow.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </Badge>

        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleStatus}
          className="h-8 text-xs"
        >
          {currentFlow.status === 'ACTIVE' ? (
            <>
              <Pause className="w-3 h-3 mr-1" />
              Pausar
            </>
          ) : (
            <>
              <Play className="w-3 h-3 mr-1" />
              Activar
            </>
          )}
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          variant={isDirty ? 'default' : 'outline'}
          className="h-8 text-xs min-w-[90px]"
        >
          {isSaving ? (
            'Guardando...'
          ) : isDirty ? (
            <>
              <Save className="w-3 h-3 mr-1" />
              Guardar
            </>
          ) : (
            'Guardado'
          )}
        </Button>
      </div>

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Node types */}
        <NodePanel />

        {/* Canvas */}
        <div className="flex-1 h-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setRfInstance}
            nodeTypes={nodeTypesMap}
            fitView
            deleteKeyCode="Delete"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  start: '#374151',
                  message: '#3b82f6',
                  question: '#f97316',
                  buttons: '#16a34a',
                  condition: '#eab308',
                  ai_response: '#9333ea',
                  delay: '#6b7280',
                  end: '#ef4444',
                };
                return colors[n.type ?? ''] ?? '#9ca3af';
              }}
              maskColor="rgba(0,0,0,0.05)"
            />
          </ReactFlow>
        </div>

        {/* Right panel - Properties */}
        {selectedNode ? (
          <NodePropertiesPanel
            node={selectedNode as Node<BaseNodeData>}
            allNodes={nodes as Node<BaseNodeData>[]}
            onChange={(data) => handleNodeDataChange(selectedNode.id, data)}
          />
        ) : (
          <div className="w-72 bg-background border-l border-border flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold">Propiedades</h2>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-muted-foreground text-center">
                Haz click en un nodo para editar sus propiedades
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
