import React from 'react';
import { type NodeProps } from 'reactflow';
import { Cpu } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function AiResponseNode({ data, selected }: NodeProps<BaseNodeData>) {
  const preview = data.instructions
    ? data.instructions.slice(0, 60) + (data.instructions.length > 60 ? '...' : '')
    : undefined;
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-purple-600"
      icon={<Cpu className="w-3.5 h-3.5" />}
      typeLabel="Respuesta IA"
      preview={preview}
    />
  );
}
