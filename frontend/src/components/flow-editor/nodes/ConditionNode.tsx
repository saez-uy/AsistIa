import { type NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function ConditionNode({ data, selected }: NodeProps<BaseNodeData>) {
  const preview =
    data.conditionVariable && data.operator && data.value
      ? `${data.conditionVariable} ${data.operator} ${data.value}`
      : undefined;
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-yellow-500"
      icon={<GitBranch className="w-3.5 h-3.5" />}
      typeLabel="Condición"
      preview={preview}
      sourceCount={2}
    />
  );
}
