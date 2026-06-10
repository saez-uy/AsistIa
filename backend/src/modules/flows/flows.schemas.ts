import { z } from 'zod';

// Estructura de un nodo de React Flow serializado
const reactFlowNodeSchema = z.object({
  id:       z.string(),
  type:     z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data:     z.record(z.unknown()),
});

// Estructura de una arista de React Flow serializada
const reactFlowEdgeSchema = z.object({
  id:           z.string(),
  source:       z.string(),
  target:       z.string(),
  sourceHandle: z.string().optional().nullable(),
  targetHandle: z.string().optional().nullable(),
});

export const createFlowSchema = z.object({
  connectionId:   z.string().min(1),
  name:           z.string().min(1, 'El nombre es requerido').max(100),
  description:    z.string().max(500).optional(),
  triggerKeyword: z.string().max(100).optional().nullable(),
  aiEnabled:      z.boolean().default(false),
  aiSystemPrompt: z.string().max(2000).optional().nullable(),
  nodes: z.array(reactFlowNodeSchema).default([]),
  edges: z.array(reactFlowEdgeSchema).default([]),
});

export const updateFlowSchema = createFlowSchema
  .omit({ connectionId: true })
  .partial();

export const testFlowSchema = z.object({
  testPhone: z.string().min(8),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
