import React from 'react';
import { type NodeProps } from 'reactflow';
import { HelpCircle } from 'lucide-react';
import BaseNode, { type BaseNodeData } from './BaseNode';

export default function QuestionNode({ data, selected }: NodeProps<BaseNodeData>) {
  const preview = data.question
    ? data.question.slice(0, 60) + (data.question.length > 60 ? '...' : '')
    : undefined;
  return (
    <BaseNode
      data={data}
      selected={selected}
      headerColor="bg-orange-500"
      icon={<HelpCircle className="w-3.5 h-3.5" />}
      typeLabel="Pregunta"
      preview={preview}
    />
  );
}
