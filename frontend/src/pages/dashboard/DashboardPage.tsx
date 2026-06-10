import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MessageSquare, TrendingUp, CheckCircle, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import TopBar from '@/components/layout/TopBar';

interface DashboardStats {
  conversationsToday: number;
  conversationsThisWeek: number;
  completionRate: number;
  newContactsThisWeek: number;
  conversationsPerDay: Array<{ date: string; count: number }>;
}

const metricCards = [
  {
    key: 'conversationsToday' as const,
    label: 'Conversaciones hoy',
    icon: MessageSquare,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  {
    key: 'conversationsThisWeek' as const,
    label: 'Conversaciones esta semana',
    icon: TrendingUp,
    color: 'text-green-500',
    bg: 'bg-green-50',
  },
  {
    key: 'completionRate' as const,
    label: 'Tasa de completado',
    icon: CheckCircle,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    format: (v: number) => `${v}%`,
  },
  {
    key: 'newContactsThisWeek' as const,
    label: 'Contactos nuevos esta semana',
    icon: UserPlus,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats');
        setStats(response.data as DashboardStats);
      } catch {
        toast.error('Error al cargar las estadísticas');
        // Mock data for development
        setStats({
          conversationsToday: 12,
          conversationsThisWeek: 87,
          completionRate: 74,
          newContactsThisWeek: 23,
          conversationsPerDay: [
            { date: 'Lun', count: 10 },
            { date: 'Mar', count: 15 },
            { date: 'Mié', count: 8 },
            { date: 'Jue', count: 20 },
            { date: 'Vie', count: 18 },
            { date: 'Sáb', count: 12 },
            { date: 'Dom', count: 4 },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Dashboard" />
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {metricCards.map(({ key, label, icon: Icon, color, bg, format }) => (
            <Card key={key}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{label}</p>
                    <p className="text-3xl font-bold">
                      {isLoading ? (
                        <span className="animate-pulse">—</span>
                      ) : (
                        format
                          ? format(stats?.[key] as number ?? 0)
                          : (stats?.[key] ?? 0)
                      )}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Conversaciones por día</CardTitle>
            <CardDescription>Últimos 7 días</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Cargando...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats?.conversationsPerDay ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    name="Conversaciones"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
