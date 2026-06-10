import { type Node } from 'reactflow';
import { Plus, Trash2 } from 'lucide-react';
import { type BaseNodeData } from './nodes/BaseNode';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NodePropertiesPanelProps {
  node: Node<BaseNodeData>;
  allNodes: Node<BaseNodeData>[];
  onChange: (data: Partial<BaseNodeData>) => void;
}

export default function NodePropertiesPanel({
  node,
  allNodes,
  onChange,
}: NodePropertiesPanelProps) {
  const { data, type } = node;

  const questionNodes = allNodes.filter((n) => n.type === 'question' && n.data.variable);

  const renderFields = () => {
    switch (type) {
      case 'start':
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Palabra clave de activación</Label>
              <Input
                placeholder="Ej: hola, inicio, menu"
                value={data.triggerKeyword ?? ''}
                onChange={(e) => onChange({ triggerKeyword: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                El flujo se activa cuando el usuario envía esta palabra.
              </p>
            </div>
          </div>
        );

      case 'message':
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Texto del mensaje</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Escribe el mensaje aquí..."
                value={data.text ?? ''}
                onChange={(e) => onChange({ text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Puedes usar {'{{variable}}'} para insertar valores de variables.
              </p>
            </div>
          </div>
        );

      case 'question':
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Pregunta</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="¿Cuál es tu nombre?"
                value={data.question ?? ''}
                onChange={(e) => onChange({ question: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nombre de variable</Label>
              <Input
                placeholder="Ej: nombre, email, telefono"
                value={data.variable ?? ''}
                onChange={(e) => onChange({ variable: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                La respuesta se guarda en esta variable.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de validación</Label>
              <Select
                value={data.validationType ?? 'text'}
                onValueChange={(v) => onChange({ validationType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto libre</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Teléfono</SelectItem>
                  <SelectItem value="date">Fecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'buttons': {
        const buttons = data.buttons ?? [];
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Texto del mensaje</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Selecciona una opción:"
                value={data.bodyText ?? ''}
                onChange={(e) => onChange({ bodyText: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Botones (máx. 3)</Label>
                {buttons.length < 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() =>
                      onChange({
                        buttons: [
                          ...buttons,
                          { id: `btn_${Date.now()}`, title: '' },
                        ],
                      })
                    }
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Agregar
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {buttons.map((btn, idx) => (
                  <div key={btn.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4 flex-shrink-0">
                      {idx + 1}.
                    </span>
                    <Input
                      placeholder={`Botón ${idx + 1}`}
                      value={btn.title}
                      onChange={(e) => {
                        const updated = buttons.map((b, i) =>
                          i === idx ? { ...b, title: e.target.value } : b
                        );
                        onChange({ buttons: updated });
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive flex-shrink-0"
                      onClick={() =>
                        onChange({ buttons: buttons.filter((_, i) => i !== idx) })
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                {buttons.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">
                    Agrega al menos un botón
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      }

      case 'condition':
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Variable a evaluar</Label>
              <Select
                value={data.conditionVariable ?? ''}
                onValueChange={(v) => onChange({ conditionVariable: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona variable" />
                </SelectTrigger>
                <SelectContent>
                  {questionNodes.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      No hay variables definidas
                    </SelectItem>
                  ) : (
                    questionNodes.map((n) => (
                      <SelectItem key={n.id} value={n.data.variable!}>
                        {n.data.variable}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Operador</Label>
              <Select
                value={data.operator ?? 'equals'}
                onValueChange={(v) => onChange({ operator: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Igual a</SelectItem>
                  <SelectItem value="not_equals">No igual a</SelectItem>
                  <SelectItem value="contains">Contiene</SelectItem>
                  <SelectItem value="not_contains">No contiene</SelectItem>
                  <SelectItem value="starts_with">Empieza con</SelectItem>
                  <SelectItem value="greater_than">Mayor que</SelectItem>
                  <SelectItem value="less_than">Menor que</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input
                placeholder="Valor a comparar"
                value={data.value ?? ''}
                onChange={(e) => onChange({ value: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Salida superior: condición verdadera. Salida inferior: condición falsa.
            </p>
          </div>
        );

      case 'ai_response':
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Instrucciones para la IA</Label>
              <textarea
                className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Eres un asistente amable. Responde la consulta del usuario sobre..."
                value={data.instructions ?? ''}
                onChange={(e) => onChange({ instructions: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Máximo de tokens</Label>
              <Input
                type="number"
                min={50}
                max={2000}
                value={data.maxTokens ?? 500}
                onChange={(e) => onChange({ maxTokens: parseInt(e.target.value) || 500 })}
              />
            </div>
          </div>
        );

      case 'delay':
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Segundos de espera (1-30)</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={data.seconds ?? 3}
                onChange={(e) =>
                  onChange({ seconds: Math.min(30, Math.max(1, parseInt(e.target.value) || 1)) })
                }
              />
              <p className="text-xs text-muted-foreground">
                El bot esperará este tiempo antes de continuar.
              </p>
            </div>
          </div>
        );

      case 'end':
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Mensaje final (opcional)</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Gracias por contactarnos. ¡Hasta pronto!"
                value={data.finalMessage ?? ''}
                onChange={(e) => onChange({ finalMessage: e.target.value })}
              />
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Selecciona un nodo para editar sus propiedades.
          </p>
        );
    }
  };

  const typeLabels: Record<string, string> = {
    start: 'Inicio',
    message: 'Mensaje',
    question: 'Pregunta',
    buttons: 'Botones',
    condition: 'Condición',
    ai_response: 'Respuesta IA',
    delay: 'Espera',
    end: 'Fin',
  };

  return (
    <div className="w-72 bg-background border-l border-border flex flex-col overflow-auto">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">Propiedades</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nodo: {typeLabels[type ?? ''] ?? type}
        </p>
      </div>
      <div className="flex-1 p-4 overflow-auto">{renderFields()}</div>
    </div>
  );
}
