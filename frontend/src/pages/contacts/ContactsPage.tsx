import { useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

interface Contact {
  id: string; phone: string; name: string | null;
  lastSeen: string | null; createdAt: string;
  _count: { conversations: number };
}

interface PageResult { data: Contact[]; total: number; page: number; pages: number; }

export default function ContactsPage() {
  const [result, setResult] = useState<PageResult | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);

  const load = (p = page, s = search) => {
    setLoading(true);
    api.get<PageResult>('/contacts', { params: { page: p, limit: 20, search: s } })
      .then(r => setResult(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1, search); setPage(1); }, [search]);
  useEffect(() => { load(page, search); }, [page]);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('es-AR') : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contactos</h1>
        <p className="text-muted-foreground">Personas que interactuaron con tus bots</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nombre o teléfono..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !result?.data.length ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay contactos todavía.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Teléfono', 'Nombre', 'Última actividad', 'Registrado', 'Conversaciones'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.data.map(c => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                    <td className="px-4 py-3">{c.name ?? <span className="text-muted-foreground italic">Sin nombre</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(c.lastSeen)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
                        {c._count.conversations}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{result.total} contactos en total</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm flex items-center px-2">{page} / {result.pages}</span>
                <Button size="sm" variant="outline" disabled={page === result.pages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
