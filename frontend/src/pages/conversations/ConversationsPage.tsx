import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import TopBar from '@/components/layout/TopBar';

interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  sentAt: string;
}

interface Conversation {
  id: string;
  status: string;
  startedAt: string;
  currentNodeId: string | null;
  contact: { phone: string; name: string | null };
  flow: { name: string } | null;
  _count: { messages: number };
}

interface ConvDetail extends Conversation {
  messages: Message[];
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  ACTIVE: { label: 'Activa', variant: 'default' },
  COMPLETED: { label: 'Completada', variant: 'secondary' },
  ABANDONED: { label: 'Abandonada', variant: 'destructive' },
};

const STATUS_FILTERS = ['', 'ACTIVE', 'COMPLETED', 'ABANDONED'] as const;

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<ConvDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = async (status = statusFilter) => {
    setIsLoading(true);
    try {
      const r = await api.get('/conversations', {
        params: { limit: 50, ...(status && { status }) },
      });
      const data = r.data as { data?: Conversation[] } | Conversation[];
      setConversations(Array.isArray(data) ? data : (data.data ?? []));
    } catch {
      toast.error('Error al cargar las conversaciones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const selectConversation = async (id: string) => {
    try {
      const r = await api.get(`/conversations/${id}`);
      setSelected(r.data as ConvDetail);
    } catch {
      toast.error('Error al cargar la conversación');
    }
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Conversaciones" />

      <div className="flex flex-col flex-1 overflow-hidden p-4 gap-3">
        {/* Filters */}
        <div className="flex gap-2 flex-shrink-0">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
            >
              {s === '' ? 'Todas' : (STATUS_LABELS[s]?.label ?? s)}
            </Button>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Conversation list */}
          <div className="w-72 flex-shrink-0 border border-border rounded-lg overflow-y-auto bg-background">
            {isLoading ? (
              <p className="p-4 text-muted-foreground text-sm">Cargando...</p>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No hay conversaciones</p>
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={cn(
                    'w-full text-left p-3 border-b border-border hover:bg-muted/40 transition-colors',
                    selected?.id === c.id && 'bg-muted'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate flex-1 mr-2">
                      {c.contact.name ?? c.contact.phone}
                    </span>
                    <Badge
                      variant={STATUS_LABELS[c.status]?.variant ?? 'outline'}
                      className="text-xs flex-shrink-0"
                    >
                      {STATUS_LABELS[c.status]?.label ?? c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.flow?.name ?? 'Sin flujo'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt(c.startedAt)}</p>
                </button>
              ))
            )}
          </div>

          {/* Message detail */}
          <div className="flex-1 border border-border rounded-lg flex flex-col overflow-hidden bg-background">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    Selecciona una conversación para ver los mensajes
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <div className="p-4 border-b border-border bg-muted/30 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {selected.contact.name ?? selected.contact.phone}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selected.contact.phone} · {selected.flow?.name ?? 'Sin flujo'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selected.currentNodeId && (
                        <Badge variant="outline" className="text-xs">
                          Nodo: {selected.currentNodeId}
                        </Badge>
                      )}
                      <Badge
                        variant={STATUS_LABELS[selected.status]?.variant ?? 'outline'}
                        className="text-xs"
                      >
                        {STATUS_LABELS[selected.status]?.label ?? selected.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                  {selected.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No hay mensajes en esta conversación
                    </div>
                  ) : (
                    selected.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          'flex',
                          m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm',
                            m.direction === 'OUTBOUND'
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-white text-foreground rounded-bl-sm border border-border'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          <p
                            className={cn(
                              'text-xs mt-1',
                              m.direction === 'OUTBOUND'
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            )}
                          >
                            {fmt(m.sentAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
