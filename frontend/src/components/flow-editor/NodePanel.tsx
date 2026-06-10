import React from 'react';
import {
  PlayCircle,
  MessageSquare,
  HelpCircle,
  LayoutList,
  GitBranch,
  Cpu,
  Clock,
  StopCircle,
} from 'lucide-react';

interface NodeTypeItem {
  type: string;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

const nodeTypes: NodeTypeItem[] = [
  {
    type: 'start',
    label: 'Inicio',
    description: 'Punto de entrada',
    color: 'bg-gray-800',
    icon: <PlayCircle className="w-4 h-4 text-white" />,
  },
  {
    type: 'message',
    label: 'Mensaje',
    description: 'Envía un mensaje',
    color: 'bg-blue-500',
    icon: <MessageSquare className="w-4 h-4 text-white" />,
  },
  {
    type: 'question',
    label: 'Pregunta',
    description: 'Solicita una respuesta',
    color: 'bg-orange-500',
    icon: <HelpCircle className="w-4 h-4 text-white" />,
  },
  {
    type: 'buttons',
    label: 'Botones',
    description: 'Muestra opciones',
    color: 'bg-green-600',
    icon: <LayoutList className="w-4 h-4 text-white" />,
  },
  {
    type: 'condition',
    label: 'Condición',
    description: 'Ramifica el flujo',
    color: 'bg-yellow-500',
    icon: <GitBranch className="w-4 h-4 text-white" />,
  },
  {
    type: 'ai_response',
    label: 'Respuesta IA',
    description: 'Genera respuesta con IA',
    color: 'bg-purple-600',
    icon: <Cpu className="w-4 h-4 text-white" />,
  },
  {
    type: 'delay',
    label: 'Espera',
    description: 'Pausa el flujo',
    color: 'bg-gray-500',
    icon: <Clock className="w-4 h-4 text-white" />,
  },
  {
    type: 'end',
    label: 'Fin',
    description: 'Termina el flujo',
    color: 'bg-red-500',
    icon: <StopCircle className="w-4 h-4 text-white" />,
  },
];

export default function NodePanel() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-60 bg-background border-r border-border flex flex-col overflow-auto">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Nodos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Arrastra al canvas</p>
      </div>
      <div className="flex-1 p-3 space-y-2">
        {nodeTypes.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background hover:bg-accent cursor-grab active:cursor-grabbing select-none transition-colors"
          >
            <div
              className={`w-7 h-7 rounded-md ${item.color} flex items-center justify-center flex-shrink-0`}
            >
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
