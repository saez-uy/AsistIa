import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Play, Pause, MessageSquare } from 'lucide-react';
import { useFlowStore } from '@/stores/flow.store';
import api from '@/lib/api';
import TopBar from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

interface Connection {
  id: string;
  displayPhone: string;
  businessName: string;
}

export default function FlowsListPage() {
  const { flows, isLoading, fetchFlows, createFlow, deleteFlow, activateFlow, deactivateFlow } =
    useFlowStore();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formName, setFormName] = useState('');
  const [formConnectionId, setFormConnectionId] = useState('');
  const [formKeyword, setFormKeyword] = useState('');

  useEffect(() => {
    fetchFlows().catch(() => toast.error('Error al cargar los flujos'));
    api
      .get('/connections')
      .then((r) => setConnections(r.data as Connection[]))
      .catch(() => {});
  }, [fetchFlows]);

  const handleCreate = async () => {
    if (!formName || !formConnectionId || !formKeyword) {
      toast.error('Completa todos los campos');
      return;
    }
    setIsCreating(true);
    try {
      const flow = await createFlow({
        name: formName,
        connectionId: formConnectionId,
        triggerKeyword: formKeyword,
      });
      toast.success('Flujo creado correctamente');
      setCreateOpen(false);
      setFormName('');
      setFormConnectionId('');
      setFormKeyword('');
      navigate(`/flows/${flow.id}/edit`);
    } catch {
      toast.error('Error al crear el flujo');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFlow(id);
      toast.success('Flujo eliminado');
      setDeleteId(null);
    } catch {
      toast.error('Error al eliminar el flujo');
    }
  };

  const handleToggleStatus = async (
    id: string,
    currentStatus: 'ACTIVE' | 'INACTIVE'
  ) => {
    try {
      if (currentStatus === 'ACTIVE') {
        await deactivateFlow(id);
        toast.success('Flujo desactivado');
      } else {
        await activateFlow(id);
        toast.success('Flujo activado');
      }
    } catch {
      toast.error('Error al cambiar el estado del flujo');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Flujos"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crear flujo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear nuevo flujo</DialogTitle>
                <DialogDescription>
                  Configura los parámetros básicos del flujo de conversación.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Nombre del flujo</Label>
                  <Input
                    placeholder="Ej: Atención al cliente"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conexión (número de WhatsApp)</Label>
                  <Select value={formConnectionId} onValueChange={setFormConnectionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una conexión" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No hay conexiones disponibles
                        </SelectItem>
                      ) : (
                        connections.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.displayPhone} — {c.businessName}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Palabra clave de activación</Label>
                  <Input
                    placeholder="Ej: hola, menu, start"
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Creando...' : 'Crear flujo'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Cargando flujos...
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">No hay flujos todavía</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crea tu primer flujo de conversación para empezar
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {flows.map((flow) => (
              <Card key={flow.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{flow.name}</h3>
                        <Badge
                          variant={flow.status === 'ACTIVE' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {flow.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {flow.connection && (
                          <span>{flow.connection.displayPhone}</span>
                        )}
                        <span>Keyword: {flow.triggerKeyword}</span>
                        {flow.conversationCount !== undefined && (
                          <span>{flow.conversationCount} conversaciones</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(flow.id, flow.status)}
                        className="text-xs"
                      >
                        {flow.status === 'ACTIVE' ? (
                          <>
                            <Pause className="w-3 h-3 mr-1" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            Activar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/flows/${flow.id}/edit`)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(flow.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar flujo</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar este flujo? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
