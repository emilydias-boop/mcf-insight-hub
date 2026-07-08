import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, MessageSquare, Plus, FileText, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  Command, CommandInput, CommandList, CommandItem, CommandEmpty,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  useWaTemplates, useUpsertWaTemplate, useDeleteWaTemplate,
  WaTemplate, WaTemplateVariable,
} from '@/hooks/checkin/useWaTemplates';

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
          <li>Dentro da janela de 24h após o cliente enviar mensagem, o operador envia texto livre.</li>
          <li>Fora da janela de 24h, o WhatsApp exige um <b>template HSM aprovado</b>. Cadastre-os abaixo.</li>
        </ol>
      </Card>

      <TemplatesSection />
    </div>
  );
}

// ============ Templates HSM ============

function TemplatesSection() {
  const { data: templates = [], isLoading } = useWaTemplates(false);
  const remove = useDeleteWaTemplate();
  const [editing, setEditing] = useState<WaTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-600" />
          <div className="font-medium">Templates aprovados (HSM) — {templates.length}</div>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" /> Novo template
            </Button>
          </DialogTrigger>
          {creating && (
            <TemplateFormDialog
              onClose={() => setCreating(false)}
              onSaved={() => setCreating(false)}
            />
          )}
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Cadastre aqui os templates <b>já aprovados</b> pela Meta no Twilio Content Editor.
        O operador vai selecioná-los quando a janela de 24h estiver fechada.
      </p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Nenhum template cadastrado.
        </div>
      ) : (
        <div className="divide-y">
          {templates.map((t) => (
            <div key={t.id} className="py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{t.name}</span>
                  {!t.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  <code>{t.content_sid}</code>
                  {t.variables?.length > 0 && ` · ${t.variables.length} variáveis`}
                </div>
                {t.body_preview && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.body_preview}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setEditing(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remover template "${t.name}"?`)) remove.mutate(t.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <TemplateFormDialog
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={() => setEditing(null)}
          />
        )}
      </Dialog>
    </Card>
  );
}

const SOURCE_OPTIONS: { value: NonNullable<WaTemplateVariable['source']>; label: string }[] = [
  { value: 'customer_name', label: 'Nome do cliente' },
  { value: 'product_name', label: 'Nome do produto' },
  { value: 'purchase_date', label: 'Data da compra' },
  { value: 'custom', label: 'Preencher manualmente' },
];

function TemplateFormDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial?: WaTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const upsert = useUpsertWaTemplate();
  const [name, setName] = useState(initial?.name ?? '');
  const [contentSid, setContentSid] = useState(initial?.content_sid ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [bodyPreview, setBodyPreview] = useState(initial?.body_preview ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [variables, setVariables] = useState<WaTemplateVariable[]>(
    initial?.variables ?? [],
  );

  const addVar = () => {
    const nextIndex = (variables.at(-1)?.index ?? 0) + 1;
    setVariables([...variables, { index: nextIndex, label: '', source: 'custom' }]);
  };
  const updateVar = (idx: number, patch: Partial<WaTemplateVariable>) => {
    setVariables(variables.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };
  const removeVar = (idx: number) => setVariables(variables.filter((_, i) => i !== idx));

  const save = async () => {
    if (!name.trim() || !contentSid.trim()) {
      toast.error('Nome e Content SID são obrigatórios');
      return;
    }
    await upsert.mutateAsync({
      id: initial?.id,
      name: name.trim(),
      content_sid: contentSid.trim(),
      description: description.trim() || null,
      body_preview: bodyPreview.trim() || null,
      is_active: isActive,
      variables: variables
        .filter((v) => v.label.trim())
        .map((v) => ({ ...v, label: v.label.trim() })),
    });
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{initial ? 'Editar template' : 'Novo template'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nome interno *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex.: Boas-vindas pós-compra" />
          </div>
          <div>
            <Label className="text-xs">Content SID (HX…) *</Label>
            <Input value={contentSid} onChange={(e) => setContentSid(e.target.value)} placeholder="HXxxxxxxxxxxxxxxxx" />
          </div>
        </div>

        <div>
          <Label className="text-xs">Descrição</Label>
          <Input value={description ?? ''} onChange={(e) => setDescription(e.target.value)} placeholder="Quando usar este template" />
        </div>

        <div>
          <Label className="text-xs">Preview do corpo (com {`{{1}}, {{2}}…`})</Label>
          <Textarea
            value={bodyPreview ?? ''}
            onChange={(e) => setBodyPreview(e.target.value)}
            rows={3}
            placeholder="Olá {{1}}, tudo bem? Aqui é da MCF sobre sua compra do {{2}}."
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Cópia fiel do template aprovado — usado só para pré-visualização e histórico.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">Variáveis</Label>
            <Button type="button" size="sm" variant="outline" onClick={addVar}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {variables.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">Sem variáveis.</div>
          ) : (
            <div className="space-y-2">
              {variables.map((v, idx) => (
                <div key={idx} className="grid grid-cols-[60px_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label className="text-[10px]">#</Label>
                    <Input
                      type="number"
                      value={v.index}
                      onChange={(e) => updateVar(idx, { index: Number(e.target.value) })}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Rótulo</Label>
                    <Input
                      value={v.label}
                      onChange={(e) => updateVar(idx, { label: e.target.value })}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Origem</Label>
                    <select
                      value={v.source ?? 'custom'}
                      onChange={(e) => updateVar(idx, { source: e.target.value as any })}
                      className="h-8 w-full rounded-md border bg-background text-xs px-2"
                    >
                      {SOURCE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeVar(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <Label className="text-xs">Ativo</Label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}