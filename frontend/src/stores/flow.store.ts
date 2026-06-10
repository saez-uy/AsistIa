import { create } from 'zustand';
import { type Node, type Edge } from 'reactflow';
import api from '@/lib/api';

interface Flow {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  triggerKeyword: string;
  nodes: Node[];
  edges: Edge[];
  connectionId?: string;
  connection?: {
    id: string;
    displayPhone: string;
    businessName: string;
  };
  conversationCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CreateFlowData {
  name: string;
  connectionId: string;
  triggerKeyword: string;
}

interface UpdateFlowData {
  name?: string;
  nodes?: Node[];
  edges?: Edge[];
  triggerKeyword?: string;
}

interface FlowState {
  flows: Flow[];
  currentFlow: Flow | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  fetchFlows: () => Promise<void>;
  fetchFlow: (id: string) => Promise<void>;
  createFlow: (data: CreateFlowData) => Promise<Flow>;
  updateFlow: (id: string, data: UpdateFlowData) => Promise<void>;
  deleteFlow: (id: string) => Promise<void>;
  activateFlow: (id: string) => Promise<void>;
  deactivateFlow: (id: string) => Promise<void>;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  flows: [],
  currentFlow: null,
  isLoading: false,
  isSaving: false,
  isDirty: false,

  fetchFlows: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/flows');
      set({ flows: response.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchFlow: async (id: string) => {
    set({ isLoading: true });
    try {
      const response = await api.get(`/flows/${id}`);
      set({ currentFlow: response.data, isLoading: false, isDirty: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createFlow: async (data: CreateFlowData) => {
    const response = await api.post('/flows', data);
    const newFlow = response.data as Flow;
    set((state) => ({ flows: [newFlow, ...state.flows] }));
    return newFlow;
  },

  updateFlow: async (id: string, data: UpdateFlowData) => {
    set({ isSaving: true });
    try {
      const response = await api.put(`/flows/${id}`, data);
      const updatedFlow = response.data as Flow;
      set((state) => ({
        flows: state.flows.map((f) => (f.id === id ? updatedFlow : f)),
        currentFlow: state.currentFlow?.id === id ? updatedFlow : state.currentFlow,
        isSaving: false,
        isDirty: false,
      }));
    } catch (error) {
      set({ isSaving: false });
      throw error;
    }
  },

  deleteFlow: async (id: string) => {
    await api.delete(`/flows/${id}`);
    set((state) => ({
      flows: state.flows.filter((f) => f.id !== id),
      currentFlow: state.currentFlow?.id === id ? null : state.currentFlow,
    }));
  },

  activateFlow: async (id: string) => {
    await api.post(`/flows/${id}/activate`);
    set((state) => ({
      flows: state.flows.map((f) =>
        f.id === id ? { ...f, status: 'ACTIVE' as const } : f
      ),
      currentFlow:
        state.currentFlow?.id === id
          ? { ...state.currentFlow, status: 'ACTIVE' as const }
          : state.currentFlow,
    }));
  },

  deactivateFlow: async (id: string) => {
    await api.post(`/flows/${id}/deactivate`);
    set((state) => ({
      flows: state.flows.map((f) =>
        f.id === id ? { ...f, status: 'INACTIVE' as const } : f
      ),
      currentFlow:
        state.currentFlow?.id === id
          ? { ...state.currentFlow, status: 'INACTIVE' as const }
          : state.currentFlow,
    }));
  },

  setNodes: (nodes: Node[]) => {
    set((state) => ({
      currentFlow: state.currentFlow ? { ...state.currentFlow, nodes } : null,
      isDirty: true,
    }));
  },

  setEdges: (edges: Edge[]) => {
    const { currentFlow } = get();
    if (currentFlow) {
      set({ currentFlow: { ...currentFlow, edges }, isDirty: true });
    }
  },
}));
