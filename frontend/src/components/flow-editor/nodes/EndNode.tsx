import React from 'react';
import { type NodeProps } from 'reactflow';
import { StopCircle } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function EndNode({ data, selected }: NodeProps<BaseNodeData>) {
  const preview = data.finalMessage
    ? data.finalMessage.slice(0, 60) + (data.finalMessage.length > 60 ? '...' : '')
    : 'Fin del flujo';
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-red-500"
      icon={<StopCircle className="w-3.5 h-3.5" />}
      typeLabel="Fin"
      hasSource={false}
      preview={preview}
    />
  );
}
