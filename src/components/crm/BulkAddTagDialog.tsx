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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Tag as TagIcon, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUniqueDealTags } from '@/hooks/useUniqueDealTags';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDealIds: string[];
  originId?: string | null;
  onSuccess: () => void;
}

const tagToString = (t: any): string => {
  if (!t) return '';
  if (typeof t === 'string') {
    if (t.startsWith('{')) {
      try { const p = JSON.parse(t); return p?.name || t; } catch { return t; }
    }
    return t;
  }
  return t?.name || '';
};

export const BulkAddTagDialog = ({
  open,
  onOpenChange,
  selectedDealIds,
  originId,
  onSuccess,
}: Props) => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [setAsPrimary, setSetAsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: allTags = [], isLoading } = useUniqueDealTags({
    originId: originId || undefined,
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPicked([]);
      setSetAsPrimary(false);
    }
  }, [open]);

  const suggestions = useMemo(() => {
    const used = new Set(picked.map((t) => t.toLowerCase()));
    const q = search.trim().toLowerCase();
    return allTags.filter(
      (t) => !used.has(t.toLowerCase()) && (!q || t.toLowerCase().includes(q)),
    );
  }, [allTags, picked, search]);

  const canCreate =
    search.trim().length > 0 &&
    !suggestions.some((s) => s.toLowerCase() === search.trim().toLowerCase()) &&
    !picked.some((t) => t.toLowerCase() === search.trim().toLowerCase());

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    if (picked.some((p) => p.toLowerCase() === t.toLowerCase())) return;
    setPicked((p) => [...p, t]);
    setSearch('');
  };

  const removeTag = (t: string) => {
    setPicked((p) => p.filter((x) => x.toLowerCase() !== t.toLowerCase()));
  };

  const handleApply = async () => {
    if (picked.length === 0 || selectedDealIds.length === 0) return;
    setSaving(true);
    let success = 0;
    let failed = 0;

    try {
      // Fetch current tags + custom_fields for each deal
      const { data: deals, error: fetchErr } = await supabase
        .from('crm_deals')
        .select('id, tags, custom_fields')
        .in('id', selectedDealIds);

      if (fetchErr) throw fetchErr;

      for (const d of deals || []) {
        const current = ((d.tags as any[]) || [])
          .map(tagToString)
          .map((s) => s.trim())
          .filter(Boolean);
        const used = new Set(current.map((c) => c.toLowerCase()));
        const merged = [...current];
        for (const p of picked) {
          if (!used.has(p.toLowerCase())) merged.push(p);
        }

        const cf = (d.custom_fields as Record<string, any>) || {};
        const nextCf = { ...cf };
        if (setAsPrimary) {
          nextCf.primary_tag = picked[0];
        } else if (!cf.primary_tag) {
          // se não houver principal ainda, usa a primeira nova adicionada
          nextCf.primary_tag = picked[0];
        }

        const { error } = await supabase
          .from('crm_deals')
          .update({ tags: merged as any, custom_fields: nextCf as any })
          .eq('id', d.id);
        if (error) failed++;
        else success++;
      }

      if (success > 0) toast.success(`Tags adicionadas em ${success} lead(s)`);
      if (failed > 0) toast.warning(`${failed} lead(s) falharam`);
      qc.invalidateQueries({ queryKey: ['crm-deals'] });
      qc.invalidateQueries({ queryKey: ['unique-deal-tags'] });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error('Erro ao adicionar tags: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" /> Adicionar tags em massa
          </DialogTitle>
          <DialogDescription>
            Adicionar tag(s) a {selectedDealIds.length} lead(s). Tags já existentes não são duplicadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            autoFocus
            placeholder="Buscar ou criar tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim()) {
                e.preventDefault();
                addTag(search);
              }
            }}
          />

          <ScrollArea className="max-h-48 border rounded-md">
            <div className="p-1">
              {canCreate && (
                <button
                  onClick={() => addTag(search)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  Criar tag <span className="font-mono text-xs">"{search.trim()}"</span>
                </button>
              )}
              {isLoading ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Carregando...
                </div>
              ) : suggestions.length === 0 && !canCreate ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  {search ? 'Nenhuma tag encontrada' : 'Sem tags disponíveis'}
                </div>
              ) : (
                suggestions.slice(0, 50).map((t) => (
                  <button
                    key={t}
                    onClick={() => addTag(t)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                  >
                    <TagIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{t}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((t) => (
                <Badge key={t} variant="secondary" className="text-[11px] gap-1">
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:bg-black/10 rounded-sm">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {picked.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={setAsPrimary}
                onCheckedChange={(v) => setSetAsPrimary(v === true)}
              />
              Definir <strong className="font-medium">"{picked[0]}"</strong> como tag principal (destaque no kanban)
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleApply} disabled={picked.length === 0 || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Aplicando...
              </>
            ) : (
              `Aplicar em ${selectedDealIds.length} lead(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
