import React from 'react';
import { type NodeProps } from 'reactflow';
import { PlayCircle } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function StartNode({ data, selected }: NodeProps<BaseNodeData>) {
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-gray-800"
      icon={<PlayCircle className="w-3.5 h-3.5" />}
      typeLabel="Inicio"
      hasTarget={false}
      hasSource={true}
      preview={data.triggerKeyword ? `Keyword: ${data.triggerKeyword}` : undefined}
    />
  );
}
