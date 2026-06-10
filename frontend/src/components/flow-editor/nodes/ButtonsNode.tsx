import React from 'react';
import { type NodeProps } from 'reactflow';
import { LayoutList } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function ButtonsNode({ data, selected }: NodeProps<BaseNodeData>) {
  const count = data.buttons?.length ?? 0;
  const preview = data.bodyText
    ? `${data.bodyText.slice(0, 40)}... (${count} botones)`
    : count > 0
    ? `${count} botones`
    : undefined;
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-green-600"
      icon={<LayoutList className="w-3.5 h-3.5" />}
      typeLabel="Botones"
      preview={preview}
      sourceCount={Math.max(count, 1)}
    />
  );
}
