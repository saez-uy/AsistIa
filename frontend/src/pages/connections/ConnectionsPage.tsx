import { useEffect, useState } from 'react';
import { Plus, Trash2, Wifi, WifiOff, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';

interface Connection {
  id: string; phoneNumberId: string; displayPhone: string;
  businessName: string; isActive: boolean; createdAt: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [testConn, setTestConn]       = useState<Connection | null>(null);
  const [form, setForm]               = useState({ phoneNumberId: '', displayPhone: '', accessToken: '', businessName: '' });
  const [testPhone, setTestPhone]     = useState('');
  const [saving, setSaving]           = useState(false);

  const load = () => {
    setLoading(true);
    api.get<Connection[]>('/connections').then(r => setConnections(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/connections', form);
      toast.success('Conexión creada');
      setShowCreate(false);
      setForm({ phoneNumberId: '', displayPhone: '', accessToken: '', businessName: '' });
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al crear la conexión');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta conexión? Los flujos asociados quedarán sin número.')) return;
    await api.delete(`/connections/${id}`).catch(() => toast.error('Error al eliminar'));
    load();
  };

  const handleTest = async () => {
    if (!testConn) return;
    setSaving(true);
    try {
      await api.post(`/connections/${testConn.id}/test`, { testPhone });
      toast.success('Mensaje de prueba enviado');
      setTestConn(null);
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'Error al enviar prueba');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conexiones</h1>
          <p className="text-muted-foreground">Números de WhatsApp Business conectados</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-2" />Conectar número</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : connections.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay conexiones todavía.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>Conectar mi primer número</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connections.map(c => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{c.businessName}</CardTitle>
                  <Badge variant={c.isActive ? 'default' : 'secondary'}>
                    {c.isActive ? <><Wifi className="h-3 w-3 mr-1" />Activo</> : <><WifiOff className="h-3 w-3 mr-1" />Inactivo</>}
                  </Badge>
                </div>
                <CardDescription>{c.displayPhone}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setTestConn(c); setTestPhone(''); }}>
                  <TestTube className="h-3 w-3 mr-1" />Probar
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal crear conexión */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conectar número de WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { label: 'Phone Number ID', key: 'phoneNumberId', placeholder: '123456789012345' },
              { label: 'Número (para mostrar)', key: 'displayPhone', placeholder: '+54 11 1234-5678' },
              { label: 'Access Token de Meta', key: 'accessToken', placeholder: 'EAABwzLixnjY...' },
              { label: 'Nombre del negocio', key: 'businessName', placeholder: 'Mi Peluquería' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                <Input placeholder={f.placeholder} value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? 'Conectando...' : 'Conectar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal test */}
      <Dialog open={!!testConn} onOpenChange={() => setTestConn(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar mensaje de prueba</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Número de destino (con código de país)</Label>
            <Input placeholder="5491112345678" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestConn(null)}>Cancelar</Button>
            <Button onClick={handleTest} disabled={saving}>{saving ? 'Enviando...' : 'Enviar prueba'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
