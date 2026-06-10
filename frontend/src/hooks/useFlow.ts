import { useEffect } from 'react';
import { useFlowStore } from '@/stores/flow.store';

export function useFlows() {
  const { flows, isLoading, fetchFlows, createFlow, deleteFlow, activateFlow, deactivateFlow } = useFlowStore();
  useEffect(() => { fetchFlows(); }, [fetchFlows]);
  return { flows, isLoading, createFlow, deleteFlow, activateFlow, deactivateFlow };
}

export function useFlow(id: string) {
  const { currentFlow, isLoading, isSaving, isDirty, fetchFlow, updateFlow, setNodes, setEdges } = useFlowStore();
  useEffect(() => { if (id) fetchFlow(id); }, [id, fetchFlow]);
  return { flow: currentFlow, isLoading, isSaving, isDirty, updateFlow, setNodes, setEdges };
}
