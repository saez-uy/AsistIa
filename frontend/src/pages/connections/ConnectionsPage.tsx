import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, TestTube2, Smartphone } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Connection {
  id: string;
  phoneNumberId: string;
  displayPhone: string;
  businessName: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  createdAt?: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testConnectionId, setTestConnectionId] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    phoneNumberId: '',
    displayPhone: '',
    accessToken: '',
    businessName: '',
  });

  const fetchConnections = async () => {
    try {
      const r = await api.get('/connections');
      setConnections(r.data as Connection[]);
    } catch {
      toast.error('Error al cargar las conexiones');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleCreate = async () => {
    if (!form.phoneNumberId || !form.displayPhone || !form.accessToken || !form.businessName) {
      toast.error('Completa todos los campos');
      return;
    }
    setIsCreating(true);
    try {
      await api.post('/connections', form);
      toast.success('Conexión creada correctamente');
      setCreateOpen(false);
      setForm({ phoneNumberId: '', displayPhone: '', accessToken: '', businessName: '' });
      fetchConnections();
    } catch {
      toast.error('Error al crear la conexión');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (connectionId: string) => {
    try {
      await api.delete(`/connections/${connectionId}`);
      toast.success('Conexión eliminada');
      setDeleteId(null);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch {
      toast.error('Error al eliminar la conexión');
    }
  };

  const handleTest = async () => {
    if (!testPhone || !testConnectionId) {
      toast.error('Ingresa un número de teléfono');
      return;
    }
    setIsTesting(true);
    try {
      await api.post(`/connections/${testConnectionId}/test`, { phone: testPhone });
      toast.success('Mensaje de prueba enviado');
      setTestConnectionId(null);
      setTestPhone('');
    } catch {
      toast.error('Error al enviar el mensaje de prueba');
    } finally {
      setIsTesting(false);
    }
  };

  const statusColor = (status: Connection['status']): 'default' | 'destructive' | 'secondary' => {
    if (status === 'ACTIVE') return 'default';
    if (status === 'ERROR') return 'destructive';
    return 'secondary';
  };

  const statusLabel = (status: Connection['status']) => {
    if (status === 'ACTIVE') return 'Activa';
    if (status === 'ERROR') return 'Error';
    return 'Inactiva';
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Conexiones"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Conectar número
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conectar número de WhatsApp</DialogTitle>
                <DialogDescription>
                  Ingresa los datos de tu número de WhatsApp Business API.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {(
                  [
                    { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '1234567890' },
                    {
                      key: 'displayPhone',
                      label: 'Número de teléfono',
                      placeholder: '+52 55 1234 5678',
                    },
                    {
                      key: 'businessName',
                      label: 'Nombre del negocio',
                      placeholder: 'Mi Empresa',
                    },
                    {
                      key: 'accessToken',
                      label: 'Access Token',
                      placeholder: 'EAAxxxxxxx...',
                    },
                  ] as Array<{ key: keyof typeof form; label: string; placeholder: string }>
                ).map(({ key, label, placeholder }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Input
                      type={key === 'accessToken' ? 'password' : 'text'}
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={isCreating}>
                  {isCreating ? 'Conectando...' : 'Conectar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Cargando conexiones...
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-medium">No hay conexiones</p>
              <p className="text-sm text-muted-foreground mt-1">
                Conecta tu primer número de WhatsApp para comenzar
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {connections.map((conn) => (
              <Card key={conn.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{conn.businessName}</p>
                        <p className="text-xs text-muted-foreground">{conn.displayPhone}</p>
                      </div>
                    </div>
                    <Badge variant={statusColor(conn.status)} className="text-xs">
                      {statusLabel(conn.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">ID: {conn.phoneNumberId}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setTestConnectionId(conn.id)}
                    >
                      <TestTube2 className="w-3 h-3 mr-1" />
                      Probar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(conn.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Test dialog */}
      <Dialog
        open={!!testConnectionId}
        onOpenChange={(open) => !open && setTestConnectionId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar mensaje de prueba</DialogTitle>
            <DialogDescription>
              Ingresa el número de teléfono al que deseas enviar el mensaje de prueba.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Número de teléfono</Label>
            <Input
              placeholder="+52 55 1234 5678"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestConnectionId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleTest} disabled={isTesting}>
              {isTesting ? 'Enviando...' : 'Enviar prueba'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar conexión</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Esta acción desvinculará el número de WhatsApp y no se puede deshacer.
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
