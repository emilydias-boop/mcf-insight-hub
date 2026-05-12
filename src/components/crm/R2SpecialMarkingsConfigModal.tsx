import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  useR2SpecialMarkings,
  useUpsertR2SpecialMarking,
  useDeleteR2SpecialMarking,
} from '@/hooks/useR2SpecialMarkings';
import { R2SpecialMarking } from '@/types/r2SpecialMarking';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const CHANNEL_OPTIONS = [
  { value: '__any', label: 'Qualquer canal' },
  { value: 'ANAMNESE', label: 'Anamnese' },
  { value: 'A010', label: 'A010' },
  { value: 'OUTRO', label: 'Outro' },
];

function useEmployeesForSelect() {
  return useQuery({
    queryKey: ['employees-for-r2-marking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nome_completo, status')
        .eq('status', 'ativo')
        .order('nome_completo');
      if (error) throw error;
      return (data || []) as Array<{ id: string; nome_completo: string }>;
    },
  });
}

const emptyForm = {
  id: undefined as string | undefined,
  name: '',
  closer_r1_employee_id: '',
  required_channel: '__any' as string,
  require_contract_paid: true,
  bg_color: '#7c3aed',
  text_color: '#ffffff',
  icon: '📋',
  badge_label: '',
  active: true,
};

export function R2SpecialMarkingsConfigModal({ open, onOpenChange }: Props) {
  const { data: rules = [], isLoading } = useR2SpecialMarkings();
  const { data: employees = [] } = useEmployeesForSelect();
  const upsert = useUpsertR2SpecialMarking();
  const del = useDeleteR2SpecialMarking();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);

  const startNew = () => {
    setForm(emptyForm);
    setEditing(true);
  };

  const startEdit = (r: R2SpecialMarking) => {
    setForm({
      id: r.id,
      name: r.name,
      closer_r1_employee_id: r.closer_r1_employee_id,
      required_channel: r.required_channel || '__any',
      require_contract_paid: r.require_contract_paid,
      bg_color: r.bg_color,
      text_color: r.text_color,
      icon: r.icon,
      badge_label: r.badge_label,
      active: r.active,
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.closer_r1_employee_id || !form.badge_label.trim()) {
      toast.error('Preencha nome, closer R1 e etiqueta.');
      return;
    }
    try {
      await upsert.mutateAsync({
        id: form.id,
        name: form.name.trim(),
        closer_r1_employee_id: form.closer_r1_employee_id,
        required_channel: form.required_channel === '__any' ? null : (form.required_channel as any),
        require_contract_paid: form.require_contract_paid,
        bg_color: form.bg_color,
        text_color: form.text_color,
        icon: form.icon || '📋',
        badge_label: form.badge_label.trim(),
        active: form.active,
      });
      toast.success(form.id ? 'Marcação atualizada' : 'Marcação criada');
      setEditing(false);
      setForm(emptyForm);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta marcação?')) return;
    try {
      await del.mutateAsync(id);
      toast.success('Marcação excluída');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Marcações Especiais R2</DialogTitle>
        </DialogHeader>

        {!editing && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Destaca leads na Agenda R2 conforme Closer R1, canal e contrato pago.
              </p>
              <Button size="sm" onClick={startNew}>
                <Plus className="h-4 w-4 mr-1" /> Nova marcação
              </Button>
            </div>

            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && rules.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Nenhuma marcação cadastrada.</p>
            )}

            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        style={{ backgroundColor: r.bg_color, color: r.text_color }}
                        className="border-none"
                      >
                        {r.icon} {r.badge_label}
                      </Badge>
                      {!r.active && <Badge variant="outline">Inativa</Badge>}
                    </div>
                    <div className="text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Closer R1: <strong>{r.closer_r1_name || '—'}</strong>
                      {' • '}Canal: <strong>{r.required_channel || 'Qualquer'}</strong>
                      {' • '}Contrato pago: <strong>{r.require_contract_paid ? 'Sim' : 'Não'}</strong>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {editing && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome interno</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Anamnese — Letícia Faustino"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Closer R1</Label>
                <Select
                  value={form.closer_r1_employee_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, closer_r1_employee_id: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal exigido</Label>
                <Select
                  value={form.required_channel}
                  onValueChange={(v) => setForm((f) => ({ ...f, required_channel: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Exigir Contrato Pago</Label>
                <p className="text-xs text-muted-foreground">
                  Só marca depois que o lead estiver em "Contrato Pago".
                </p>
              </div>
              <Switch
                checked={form.require_contract_paid}
                onCheckedChange={(v) => setForm((f) => ({ ...f, require_contract_paid: v }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Cor de fundo</Label>
                <Input type="color" value={form.bg_color} onChange={(e) => setForm((f) => ({ ...f, bg_color: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Cor do texto</Label>
                <Input type="color" value={form.text_color} onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Ícone (emoji)</Label>
                <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} maxLength={4} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Etiqueta exibida</Label>
              <Input
                value={form.badge_label}
                onChange={(e) => setForm((f) => ({ ...f, badge_label: e.target.value }))}
                placeholder="Ex: Anamnese Letícia"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Ativa</Label>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Pré-visualização:</p>
              <Badge
                style={{ backgroundColor: form.bg_color, color: form.text_color }}
                className="border-none"
              >
                {form.icon || '📋'} {form.badge_label || 'Etiqueta'}
              </Badge>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => { setEditing(false); setForm(emptyForm); }}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={upsert.isPending}>
                {upsert.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}