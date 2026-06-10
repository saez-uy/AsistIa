import React from 'react';
import { Handle, Position } from 'reactflow';
import { cn } from '@/lib/utils';

export interface BaseNodeData {
  label?: string;
  text?: string;
  question?: string;
  variable?: string;
  triggerKeyword?: string;
  seconds?: number;
  finalMessage?: string;
  instructions?: string;
  maxTokens?: number;
  buttons?: Array<{ id: string; title: string }>;
  validationType?: string;
  operator?: string;
  conditionVariable?: string;
  value?: string;
  bodyText?: string;
}

interface BaseNodeProps {
  data: BaseNodeData;
  selected?: boolean;
  headerColor: string;
  icon: React.ReactNode;
  typeLabel: string;
  hasSource?: boolean;
  hasTarget?: boolean;
  preview?: string;
  sourceCount?: number;
}

export default function BaseNode({
  data,
  selected,
  headerColor,
  icon,
  typeLabel,
  hasSource = true,
  hasTarget = true,
  preview,
  sourceCount = 1,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm min-w-[180px] max-w-[220px] text-xs',
        selected ? 'ring-2 ring-primary ring-offset-1' : 'border-border'
      )}
    >
      {hasTarget && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}

      {/* Header */}
      <div className={cn('px-3 py-2 rounded-t-lg flex items-center gap-2', headerColor)}>
        <span className="text-white">{icon}</span>
        <span className="text-white font-semibold text-xs truncate">{typeLabel}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 min-h-[36px]">
        {preview ? (
          <p className="text-muted-foreground leading-snug line-clamp-2">{preview}</p>
        ) : (
          <p className="text-muted-foreground italic">Sin configurar</p>
        )}
      </div>

      {/* Source handles */}
      {hasSource && sourceCount === 1 && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-primary !border-2 !border-white"
        />
      )}
      {hasSource && sourceCount > 1 &&
        Array.from({ length: sourceCount }).map((_, i) => (
          <Handle
            key={i}
            type="source"
            position={Position.Bottom}
            id={`source-${i}`}
            style={{ left: `${((i + 1) / (sourceCount + 1)) * 100}%` }}
            className="!w-3 !h-3 !bg-primary !border-2 !border-white"
          />
        ))}
    </div>
  );
}
