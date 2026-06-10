import { useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import TopBar from '@/components/layout/TopBar';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  lastSeen: string | null;
  createdAt: string;
  _count: { conversations: number };
}

interface PageResult {
  data: Contact[];
  total: number;
  page: number;
  pages: number;
}

export default function ContactsPage() {
  const [result, setResult] = useState<PageResult | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const load = async (p: number, s: string) => {
    setIsLoading(true);
    try {
      const r = await api.get('/contacts', { params: { page: p, limit: 20, search: s } });
      setResult(r.data as PageResult);
    } catch {
      toast.error('Error al cargar los contactos');
    } finally {
      setIsLoading(false);
    }
  };

  // When search changes, reset to page 1
  useEffect(() => {
    setPage(1);
    load(1, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // When page changes
  useEffect(() => {
    load(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-MX') : '—';

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Contactos" />

      <div className="flex-1 p-6 overflow-auto">
        {/* Search */}
        <div className="relative max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Cargando contactos...
          </div>
        ) : !result?.data.length ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay contactos todavía.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Teléfono', 'Nombre', 'Última actividad', 'Registrado', 'Conversaciones'].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.data.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                      <td className="px-4 py-3">
                        {c.name ?? (
                          <span className="text-muted-foreground italic">Sin nombre</span>
                        )}
                      </td>
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
                <p className="text-sm text-muted-foreground">
                  {result.total} contactos en total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-2">
                    {page} / {result.pages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === result.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
