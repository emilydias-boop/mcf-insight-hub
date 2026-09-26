import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, MessageSquare, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Command, CommandInput, CommandList, CommandItem, CommandEmpty,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCheckinTemplates } from '@/hooks/checkin/useCheckinTemplates';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWaEnvioStatus, formatDesdePausa } from '@/hooks/wa/useWaEnvioStatus';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function WaEnvioCard() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const wa = useWaEnvioStatus();
  const [pausarOpen, setPausarOpen] = useState(false);
  const [religarOpen, setReligarOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  const definir = useMutation({
    mutationFn: async ({ p_pausar, p_motivo }: { p_pausar: boolean; p_motivo: string | null }) => {
      const { data, error } = await supabase.rpc('wa_definir_pausa', { p_pausar, p_motivo: p_motivo ?? '' } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      toast.success(v.p_pausar ? 'Envio de WhatsApp pausado' : 'Envio de WhatsApp religado');
      qc.invalidateQueries({ queryKey: ['wa-envio-status'] });
      setPausarOpen(false);
      setReligarOpen(false);
      setMotivo('');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err)),
  });

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">Envio de WhatsApp</div>
        {wa.pausado ? (
          <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300">Pausado</Badge>
        ) : (
          <Badge variant="outline" className="border-green-600/60 bg-green-600/10 text-green-700 dark:text-green-300">Ativo</Badge>
        )}
      </div>
      {wa.pausado && (
        <div className="text-sm text-muted-foreground space-y-0.5">
          <div><span className="font-medium text-foreground">Motivo:</span> {wa.motivo ?? '—'}</div>
          <div><span className="font-medium text-foreground">Desde:</span> {formatDesdePausa(wa.desde)}</div>
          <div><span className="font-medium text-foreground">Por:</span> {wa.porNome ?? '—'}</div>
        </div>
      )}
      {isAdmin && (
        <div className="flex justify-end">
          {wa.pausado ? (
            <Button size="sm" onClick={() => setReligarOpen(true)} disabled={definir.isPending}>Religar envio</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setPausarOpen(true)} disabled={definir.isPending}>Pausar envio</Button>
          )}
        </div>
      )}

      <Dialog open={pausarOpen} onOpenChange={(o) => { setPausarOpen(o); if (!o) setMotivo(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pausar envio de WhatsApp</DialogTitle></DialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da pausa (obrigatório)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPausarOpen(false)}>Cancelar</Button>
            <Button
              disabled={!motivo.trim() || definir.isPending}
              onClick={() => definir.mutate({ p_pausar: true, p_motivo: motivo.trim() })}
            >
              Pausar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={religarOpen} onOpenChange={setReligarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Religar envio de WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Religa a caixa de entrada, lembretes e automações por WhatsApp e devolve o SDR IA ao estado anterior. Disparos que estavam pausados NÃO voltam sozinhos — retome cada um na tela de Disparos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={definir.isPending}
              onClick={(e) => { e.preventDefault(); definir.mutate({ p_pausar: false, p_motivo: null }); }}
            >
              Religar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

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
      <WaEnvioCard />
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
          <li>Dentro da janela de 24h após o cliente enviar mensagem, o operador envia texto livre.</li>
          <li>Fora da janela de 24h, o WhatsApp exige um <b>template HSM aprovado pela Meta</b> — a lista abaixo vem de Administração → Automações.</li>
        </ol>
      </Card>

      <TemplatesSection />
    </div>
  );
}

// ============ Templates HSM (somente leitura) ============

function TemplatesSection() {
  const { data: templates = [], isLoading } = useCheckinTemplates();

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-emerald-600" />
        <div className="font-medium">Templates WhatsApp aprovados — {templates.length}</div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Lista sincronizada com os templates aprovados pela Meta via Twilio (Administração → Automações).
        O operador escolhe um deles quando a janela de 24h está fechada.
      </p>

      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900">
          <b>Limitação atual:</b> todos os templates aprovados hoje são de agenda/lembrete. Ainda não existe
          um template genérico de <b>atendimento / primeiro contato</b> — ele precisa ser criado e submetido
          à aprovação da Meta pela Twilio antes de poder ser usado aqui.
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Nenhum template de WhatsApp aprovado.{' '}
          <Link to="/admin/automacoes" className="underline">Gerenciar em Automações</Link>
        </div>
      ) : (
        <div className="divide-y">
          {templates.map((t) => (
            <div key={t.id} className="py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{t.name}</span>
                {t.category && (
                  <Badge variant="outline" className="text-[10px] uppercase">{t.category}</Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                <code>{t.content_sid}</code>
                {t.variables.length > 0 && ` · ${t.variables.length} variáveis`}
              </div>
              {t.body_preview && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body_preview}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
