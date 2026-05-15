import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { History, Phone, CalendarDays, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { HistoricoLigacoesTab } from '@/components/crm/historico/HistoricoLigacoesTab';
import { HistoricoR1Tab } from '@/components/crm/historico/HistoricoR1Tab';

const PRIVILEGED = ['admin', 'manager', 'coordenador'];

function useTeamSDRs(enabled: boolean) {
  return useQuery({
    queryKey: ['team-sdrs-for-historico'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, profiles:profiles!user_roles_user_id_fkey(full_name)')
        .in('role', ['sdr', 'closer', 'closer_sombra'] as any);
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach((r: any) => {
        const name = r.profiles?.full_name || 'Sem nome';
        map.set(r.user_id, name);
      });
      return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export default function MeuHistorico() {
  const { user, role } = useAuth();
  const isPrivileged = PRIVILEGED.includes(role || '');
  const [selectedSDR, setSelectedSDR] = useState<string>('me');
  const { data: sdrs } = useTeamSDRs(isPrivileged);

  const targetUserId = useMemo(() => {
    if (selectedSDR === 'me' || !isPrivileged) return user?.id ?? null;
    return selectedSDR;
  }, [selectedSDR, isPrivileged, user?.id]);

  if (!user?.id) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Faça login para ver seu histórico.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Meu Histórico
          </h1>
          <p className="text-sm text-muted-foreground">
            Suas ligações, agendamentos R1, no-shows e reuniões perdidas em um só lugar.
          </p>
        </div>
        {isPrivileged && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Visualizar:</span>
            <Select value={selectedSDR} onValueChange={setSelectedSDR}>
              <SelectTrigger className="w-[260px] h-9">
                <SelectValue placeholder="Selecionar SDR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Meu próprio histórico</SelectItem>
                {(sdrs || []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs defaultValue="ligacoes" className="space-y-3">
        <TabsList>
          <TabsTrigger value="ligacoes" className="gap-2">
            <Phone className="h-4 w-4" /> Ligações
          </TabsTrigger>
          <TabsTrigger value="r1" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Agendamentos R1
          </TabsTrigger>
          <TabsTrigger value="no_show" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> No-Shows
          </TabsTrigger>
          <TabsTrigger value="perdidas" className="gap-2">
            <X className="h-4 w-4" /> Perdidas
          </TabsTrigger>
        </TabsList>

        {targetUserId && (
          <>
            <TabsContent value="ligacoes">
              <HistoricoLigacoesTab targetUserId={targetUserId} />
            </TabsContent>
            <TabsContent value="r1">
              <HistoricoR1Tab targetUserId={targetUserId} bucket="agendadas" />
            </TabsContent>
            <TabsContent value="no_show">
              <HistoricoR1Tab targetUserId={targetUserId} bucket="no_show" />
            </TabsContent>
            <TabsContent value="perdidas">
              <HistoricoR1Tab targetUserId={targetUserId} bucket="perdidas" />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}