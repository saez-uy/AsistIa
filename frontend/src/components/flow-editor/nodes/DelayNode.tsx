import { type NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function DelayNode({ data, selected }: NodeProps<BaseNodeData>) {
  const preview = data.seconds != null ? `Esperar ${data.seconds} segundo(s)` : undefined;
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-gray-500"
      icon={<Clock className="w-3.5 h-3.5" />}
      typeLabel="Espera"
      preview={preview}
    />
  );
}
