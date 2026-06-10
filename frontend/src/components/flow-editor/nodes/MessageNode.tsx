import React from 'react';
import { type NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function MessageNode({ data, selected }: NodeProps<BaseNodeData>) {
  const preview = data.text ? data.text.slice(0, 60) + (data.text.length > 60 ? '...' : '') : undefined;
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-blue-500"
      icon={<MessageSquare className="w-3.5 h-3.5" />}
      typeLabel="Mensaje"
      preview={preview}
    />
  );
}
