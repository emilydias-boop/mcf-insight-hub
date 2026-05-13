import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Shuffle, Users } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  originId?: string | null;
  onSuccess: () => void;
}

interface SdrUser {
  id: string;
  email: string;
  full_name: string | null;
}

export const BulkDistributeSdrsDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  originId,
  onSuccess,
}: Props) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shuffle, setShuffle] = useState(true);
  const [running, setRunning] = useState(false);

  const { data: sdrs = [], isLoading } = useQuery({
    queryKey: ['bulk-distribute-sdrs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, user_roles!inner(role)')
        .in('user_roles.role', ['sdr', 'closer', 'coordenador', 'manager', 'admin'])
        .order('full_name');
      if (error) throw error;
      return (data || []) as unknown as (SdrUser & { user_roles: any })[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPicked(new Set());
      setShuffle(true);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sdrs;
    return sdrs.filter(
      (s) =>
        (s.full_name || '').toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [sdrs, search]);

  const pickedList = useMemo(
    () => sdrs.filter((s) => picked.has(s.id)),
    [sdrs, picked],
  );

  const total = selectedDealIds.length;
  const per = pickedList.length > 0 ? Math.floor(total / pickedList.length) : 0;
  const remainder = pickedList.length > 0 ? total % pickedList.length : 0;

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setPicked((prev) => {
      const next = new Set(prev);
      filtered.forEach((s) => next.add(s.id));
      return next;
    });
  };

  const clearAll = () => setPicked(new Set());

  const handleDistribute = async () => {
    if (pickedList.length === 0 || total === 0) return;
    setRunning(true);

    const order = shuffle
      ? [...selectedDealIds].sort(() => Math.random() - 0.5)
      : selectedDealIds;

    let success = 0;
    let failed = 0;
    const userName =
      user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Sistema';

    try {
      for (let i = 0; i < order.length; i++) {
        const dealId = order[i];
        const sdr = pickedList[i % pickedList.length];

        const { error } = await supabase
          .from('crm_deals')
          .update({
            owner_id: sdr.email,
            owner_profile_id: sdr.id,
          })
          .eq('id', dealId);

        if (error) {
          failed++;
          continue;
        }

        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          activity_type: 'owner_change',
          description: `Distribuído para ${sdr.full_name || sdr.email} (distribuição em massa)`,
          user_id: user?.id,
          metadata: {
            new_owner: sdr.email,
            new_owner_name: sdr.full_name || sdr.email,
            transferred_by: userName,
            bulk_distribute: true,
          },
        });
        success++;
      }

      if (success > 0)
        toast.success(
          `${success} lead(s) distribuídos entre ${pickedList.length} responsável(eis)`,
        );
      if (failed > 0) toast.warning(`${failed} lead(s) falharam`);
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error('Erro na distribuição: ' + (e?.message || ''));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" /> Distribuir entre SDRs
          </DialogTitle>
          <DialogDescription>
            Distribuir {total} lead(s) em round-robin entre os responsáveis selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar SDR / Closer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {pickedList.length} selecionado(s) · {filtered.length} disponíveis
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAllVisible}
                className="text-primary hover:underline"
                type="button"
              >
                Selecionar visíveis
              </button>
              <button
                onClick={clearAll}
                className="text-muted-foreground hover:underline"
                type="button"
              >
                Limpar
              </button>
            </div>
          </div>

          <ScrollArea className="h-56 border rounded-md">
            <div className="p-1">
              {isLoading ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Carregando...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  Nenhum responsável encontrado
                </div>
              ) : (
                filtered.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={picked.has(s.id)}
                      onCheckedChange={() => togglePick(s.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {s.full_name || s.email}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {s.email}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>

          {pickedList.length > 0 && (
            <div className="bg-muted/50 rounded-md p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {total} leads → {pickedList.length} responsáveis (~{per}
                {remainder > 0 ? `-${per + 1}` : ''} cada)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {pickedList.map((s, i) => {
                  const count = per + (i < remainder ? 1 : 0);
                  return (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 text-xs bg-background border rounded-full px-2 py-0.5"
                    >
                      {s.full_name || s.email.split('@')[0]}
                      <span className="text-muted-foreground">({count})</span>
                    </span>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={shuffle}
                  onCheckedChange={(v) => setShuffle(v === true)}
                />
                Embaralhar ordem dos leads (mais justo)
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={running}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDistribute}
            disabled={pickedList.length === 0 || running}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Distribuindo...
              </>
            ) : (
              `Distribuir ${total} lead(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
