import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import {
  Command, CommandInput, CommandList, CommandItem, CommandEmpty,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Profile = { id: string; full_name: string | null; email: string | null };

export default function McfAtendimentoAccess() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [popOpen, setPopOpen] = useState(false);

  const { data: access = [] } = useQuery({
    queryKey: ['mcf_atendimento_access', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mcf_atendimento_access')
        .select('user_id, granted_at')
        .order('granted_at', { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as (Profile & { granted_at: string })[];
      const { data: profs } = await supabase
        .from('profiles').select('id, full_name, email').in('id', ids);
      return (data ?? []).map((r) => {
        const p = profs?.find((x) => x.id === r.user_id);
        return { id: r.user_id, full_name: p?.full_name ?? null, email: p?.email ?? null, granted_at: r.granted_at };
      });
    },
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['profile_search', search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const term = `%${search.trim()}%`;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.${term},email.ilike.${term}`)
        .limit(15);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const grant = useMutation({
    mutationFn: async (userId: string) => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('mcf_atendimento_access')
        .insert({ user_id: userId, granted_by: user.user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Acesso concedido');
      qc.invalidateQueries({ queryKey: ['mcf_atendimento_access'] });
      setPopOpen(false);
      setSearch('');
    },
    onError: (e: any) => toast.error('Erro', { description: e.message }),
  });

  const revoke = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('mcf_atendimento_access').delete().eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Acesso removido');
      qc.invalidateQueries({ queryKey: ['mcf_atendimento_access'] });
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-emerald-600" />
        <h1 className="text-2xl font-bold">Acesso MCF - Atendimento</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Usuários listados abaixo podem visualizar e responder às conversas de WhatsApp e às salas de atendimento.
        Admins e Managers têm acesso automático.
      </p>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium">Operadores autorizados ({access.length})</div>
          <Popover open={popOpen} onOpenChange={setPopOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="h-4 w-4 mr-1.5" /> Adicionar usuário
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Buscar por nome ou e-mail..." value={search} onValueChange={setSearch} />
                <CommandList>
                  {search.length < 2 && (
                    <div className="p-3 text-xs text-muted-foreground">Digite ao menos 2 caracteres…</div>
                  )}
                  {search.length >= 2 && searchResults.length === 0 && (
                    <CommandEmpty>Nenhum usuário encontrado</CommandEmpty>
                  )}
                  {searchResults
                    .filter((p) => !access.some((a) => a.id === p.id))
                    .map((p) => (
                      <CommandItem
                        key={p.id}
                        onSelect={() => grant.mutate(p.id)}
                        className="cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.full_name ?? '(sem nome)'}</div>
                          <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                        </div>
                      </CommandItem>
                    ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {access.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            Nenhum usuário adicional. Adicione operadores para que possam atender.
          </div>
        ) : (
          <div className="divide-y">
            {access.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.full_name ?? '(sem nome)'}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">Operador</Badge>
                  <Button size="icon" variant="ghost" onClick={() => revoke.mutate(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-muted/40">
        <div className="text-sm font-medium mb-2">Configuração Twilio</div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>No console Twilio, configure o webhook "When a message comes in" apontando para:
            <code className="ml-1 text-[10px] bg-background px-1.5 py-0.5 rounded">
              https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-wa-webhook
            </code>
          </li>
          <li>Para testes, use o Sandbox WhatsApp (whatsapp:+14155238886) — cada testador precisa mandar o código join uma vez.</li>
          <li>Quando o template HSM for aprovado, adicione o secret <code>TWILIO_WA_TEMPLATE_SID</code> para trocar a mensagem inicial pelo template oficial.</li>
        </ol>
      </Card>
    </div>
  );
}