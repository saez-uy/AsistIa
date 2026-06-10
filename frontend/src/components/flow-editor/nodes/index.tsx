import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '@/lib/utils';

// ── Configuración visual por tipo ─────────────────────────────────────────────

export const NODE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  start:       { label: 'Inicio',       color: 'bg-gray-800   border-gray-900',   icon: '▶' },
  message:     { label: 'Mensaje',      color: 'bg-blue-500   border-blue-600',   icon: '💬' },
  question:    { label: 'Pregunta',     color: 'bg-orange-500 border-orange-600', icon: '❓' },
  buttons:     { label: 'Botones',      color: 'bg-green-500  border-green-600',  icon: '🔘' },
  condition:   { label: 'Condición',    color: 'bg-yellow-500 border-yellow-600', icon: '⚡' },
  ai_response: { label: 'IA',           color: 'bg-purple-500 border-purple-600', icon: '🤖' },
  delay:       { label: 'Pausa',        color: 'bg-slate-400  border-slate-500',  icon: '⏱' },
  end:         { label: 'Fin',          color: 'bg-red-500    border-red-600',    icon: '🏁' },
};

// ── Componente base ────────────────────────────────────────────────────────────

function BaseNode({ type, data, selected, children, extraHandles }: {
  type: string; data: Record<string, unknown>; selected: boolean;
  children?: React.ReactNode; extraHandles?: React.ReactNode;
}) {
  const cfg = NODE_CONFIG[type] ?? NODE_CONFIG.message;

  return (
    <div className={cn(
      'min-w-[160px] max-w-[220px] rounded-xl border-2 shadow-md bg-white',
      selected && 'ring-2 ring-primary ring-offset-1'
    )}>
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg text-white text-xs font-semibold', cfg.color)}>
        <span>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </div>
      {/* Body */}
      <div className="px-3 py-2 text-xs text-gray-600 min-h-[32px]">
        {children ?? <span className="italic text-gray-400">Sin configurar</span>}
      </div>
      {/* Top handle (entrada) */}
      {type !== 'start' && (
        <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white" />
      )}
      {/* Bottom handle (salida principal) */}
      {type !== 'end' && type !== 'buttons' && type !== 'condition' && (
        <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3 !border-2 !border-white" />
      )}
      {extraHandles}
    </div>
  );
}

// ── Nodos específicos ──────────────────────────────────────────────────────────

export function StartNode({ data, selected }: NodeProps) {
  return (
    <BaseNode type="start" data={data} selected={selected}>
      {data.triggerKeyword ? <span>Keyword: <strong>{data.triggerKeyword as string}</strong></span> : null}
    </BaseNode>
  );
}

export function MessageNode({ data, selected }: NodeProps) {
  const text = (data.text as string) ?? '';
  return (
    <BaseNode type="message" data={data} selected={selected}>
      {text ? <span className="line-clamp-2">{text.slice(0, 80)}</span> : null}
    </BaseNode>
  );
}

export function QuestionNode({ data, selected }: NodeProps) {
  return (
    <BaseNode type="question" data={data} selected={selected}>
      <div className="space-y-0.5">
        {data.text && <p className="line-clamp-2">{(data.text as string).slice(0, 60)}</p>}
        {data.variableName && <p className="text-primary font-mono">→ {'{{'}{data.variableName as string}{'}}'}</p>}
      </div>
    </BaseNode>
  );
}

export function ButtonsNode({ data, selected }: NodeProps) {
  const buttons = (data.buttons as Array<{ id: string; title: string }>) ?? [];
  return (
    <BaseNode type="buttons" data={data} selected={selected}
      extraHandles={
        <>
          {buttons.map((b, i) => (
            <Handle key={b.id} type="source" position={Position.Bottom}
              id={b.id}
              style={{ left: `${((i + 1) / (buttons.length + 1)) * 100}%` }}
              className="!bg-green-500 !w-3 !h-3 !border-2 !border-white"
            />
          ))}
        </>
      }>
      <div className="space-y-1">
        {data.text && <p className="line-clamp-1 mb-1">{data.text as string}</p>}
        {buttons.map(b => (
          <div key={b.id} className="bg-green-50 border border-green-200 rounded px-2 py-0.5 text-xs truncate">{b.title}</div>
        ))}
      </div>
    </BaseNode>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  return (
    <BaseNode type="condition" data={data} selected={selected}
      extraHandles={
        <>
          <Handle type="source" position={Position.Bottom} id="true"
            style={{ left: '30%' }}
            className="!bg-green-500 !w-3 !h-3 !border-2 !border-white"
          />
          <Handle type="source" position={Position.Bottom} id="false"
            style={{ left: '70%' }}
            className="!bg-red-500 !w-3 !h-3 !border-2 !border-white"
          />
        </>
      }>
      <div>
        {data.variable && (
          <p className="font-mono text-xs">
            {'{{'}{data.variable as string}{'}}'} {data.operator as string} "{data.value as string}"
          </p>
        )}
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span className="text-green-600">✓ Verdadero</span>
          <span className="text-red-500">✗ Falso</span>
        </div>
      </div>
    </BaseNode>
  );
}

export function AiResponseNode({ data, selected }: NodeProps) {
  return (
    <BaseNode type="ai_response" data={data} selected={selected}>
      {data.instructions
        ? <span className="line-clamp-2">{(data.instructions as string).slice(0, 60)}</span>
        : <span className="text-purple-400">Responde con IA</span>
      }
    </BaseNode>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  return (
    <BaseNode type="delay" data={data} selected={selected}>
      <span>Esperar <strong>{(data.seconds as number) ?? 3}</strong> segundos</span>
    </BaseNode>
  );
}

export function EndNode({ data, selected }: NodeProps) {
  return (
    <BaseNode type="end" data={data} selected={selected}>
      {data.text ? <span className="line-clamp-2">{data.text as string}</span> : <span className="text-red-400">Fin del flujo</span>}
    </BaseNode>
  );
}

export const nodeTypes = {
  start:       StartNode,
  message:     MessageNode,
  question:    QuestionNode,
  buttons:     ButtonsNode,
  condition:   ConditionNode,
  ai_response: AiResponseNode,
  delay:       DelayNode,
  end:         EndNode,
};
