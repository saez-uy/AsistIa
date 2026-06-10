import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface Message { id: string; direction: 'INBOUND' | 'OUTBOUND'; content: string; sentAt: string; }
interface Conversation {
  id: string; status: string; startedAt: string; currentNodeId: string | null;
  contact: { phone: string; name: string | null };
  flow: { name: string } | null;
  _count: { messages: number };
}
interface ConvDetail extends Conversation { messages: Message[]; }

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ACTIVE:    { label: 'Activa',     variant: 'default' },
  COMPLETED: { label: 'Completada', variant: 'secondary' },
  ABANDONED: { label: 'Abandonada', variant: 'destructive' },
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected]           = useState<ConvDetail | null>(null);
  const [statusFilter, setStatusFilter]   = useState<string>('');
  const [loading, setLoading]             = useState(true);

  const load = (status = statusFilter) => {
    setLoading(true);
    api.get<{ data: Conversation[] }>('/conversations', { params: { limit: 50, ...(status && { status }) } })
      .then(r => setConversations(r.data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter]);

  const selectConversation = (id: string) => {
    api.get<ConvDetail>(`/conversations/${id}`).then(r => setSelected(r.data));
  };

  const fmt = (d: string) => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Conversaciones</h1>
        <p className="text-muted-foreground">Historial de interacciones con tus bots</p>
      </div>

      <div className="flex gap-2">
        {(['', 'ACTIVE', 'COMPLETED', 'ABANDONED'] as const).map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}>
            {s === '' ? 'Todas' : STATUS_LABELS[s].label}
          </Button>
        ))}
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Lista */}
        <div className="w-80 flex-shrink-0 border rounded-lg overflow-y-auto">
          {loading ? (
            <p className="p-4 text-muted-foreground text-sm">Cargando...</p>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No hay conversaciones</p>
            </div>
          ) : conversations.map(c => (
            <button key={c.id} onClick={() => selectConversation(c.id)}
              className={cn('w-full text-left p-3 border-b hover:bg-muted/40 transition-colors',
                selected?.id === c.id && 'bg-muted'
              )}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{c.contact.name ?? c.contact.phone}</span>
                <Badge variant={STATUS_LABELS[c.status]?.variant ?? 'outline'} className="text-xs">
                  {STATUS_LABELS[c.status]?.label ?? c.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{c.flow?.name ?? 'Sin flujo'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{fmt(c.startedAt)}</p>
            </button>
          ))}
        </div>

        {/* Detalle */}
        <div className="flex-1 border rounded-lg flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Seleccioná una conversación</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{selected.contact.name ?? selected.contact.phone}</p>
                    <p className="text-xs text-muted-foreground">{selected.contact.phone} · {selected.flow?.name}</p>
                  </div>
                  {selected.currentNodeId && (
                    <Badge variant="outline" className="text-xs">Nodo: {selected.currentNodeId}</Badge>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                {selected.messages.map(m => (
                  <div key={m.id} className={cn('flex', m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-xs px-3 py-2 rounded-2xl text-sm shadow-sm',
                      m.direction === 'OUTBOUND'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-white text-foreground rounded-bl-sm border'
                    )}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className={cn('text-xs mt-1', m.direction === 'OUTBOUND' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        {fmt(m.sentAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
