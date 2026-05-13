import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Star, Tag as TagIcon, X } from "lucide-react";
import { useUniqueDealTags } from "@/hooks/useUniqueDealTags";

interface Props {
  dealId: string;
  originId?: string | null;
  tags: any[] | null | undefined;
  customFields: Record<string, unknown> | null | undefined;
  onChanged?: () => void;
}

const tagToString = (t: any): string => {
  if (!t) return "";
  if (typeof t === "string") {
    if (t.startsWith("{")) {
      try {
        const p = JSON.parse(t);
        return p?.name || t;
      } catch {
        return t;
      }
    }
    return t;
  }
  return t?.name || "";
};

export function LeadTagsManager({
  dealId,
  originId,
  tags,
  customFields,
  onChanged,
}: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentTags = useMemo(() => {
    return (tags || [])
      .map(tagToString)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [tags]);

  const primaryTag = (customFields as any)?.primary_tag as string | undefined;

  const { data: allTags = [], isLoading: tagsLoading } = useUniqueDealTags({
    originId: originId || undefined,
    enabled: open,
  });

  const suggestions = useMemo(() => {
    const used = new Set(currentTags.map((t) => t.toLowerCase()));
    const q = search.trim().toLowerCase();
    return allTags.filter(
      (t) => !used.has(t.toLowerCase()) && (!q || t.toLowerCase().includes(q)),
    );
  }, [allTags, currentTags, search]);

  const canCreate =
    search.trim().length > 0 &&
    !suggestions.some((s) => s.toLowerCase() === search.trim().toLowerCase()) &&
    !currentTags.some((t) => t.toLowerCase() === search.trim().toLowerCase());

  const persist = async (
    nextTags: string[],
    nextPrimary: string | null,
  ) => {
    if (!dealId || dealId.startsWith("manual-")) return;
    setSaving(true);
    const mergedFields = {
      ...((customFields as Record<string, unknown>) || {}),
      primary_tag: nextPrimary,
    };
    const { error } = await supabase
      .from("crm_deals")
      .update({
        tags: nextTags as any,
        custom_fields: mergedFields as any,
      })
      .eq("id", dealId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar tags: " + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["crm-deal", dealId] });
    qc.invalidateQueries({ queryKey: ["crm-deals"] });
    qc.invalidateQueries({ queryKey: ["unique-deal-tags"] });
    onChanged?.();
  };

  const addTag = async (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (currentTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setSearch("");
      return;
    }
    const next = [...currentTags, tag];
    setSearch("");
    await persist(next, primaryTag || tag);
    if (!primaryTag) {
      toast.success(`Tag "${tag}" adicionada e definida como principal`);
    } else {
      toast.success(`Tag "${tag}" adicionada`);
    }
  };

  const removeTag = async (tag: string) => {
    const next = currentTags.filter(
      (t) => t.toLowerCase() !== tag.toLowerCase(),
    );
    const nextPrimary =
      primaryTag && primaryTag.toLowerCase() === tag.toLowerCase()
        ? next[0] || null
        : primaryTag || null;
    await persist(next, nextPrimary);
  };

  const setPrimary = async (tag: string) => {
    const isCurrent =
      primaryTag && primaryTag.toLowerCase() === tag.toLowerCase();
    await persist(currentTags, isCurrent ? null : tag);
  };

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <TagIcon className="h-3 w-3" /> Tags
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={saving}
            >
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="end">
            <div className="p-2 border-b">
              <Input
                autoFocus
                placeholder="Buscar ou criar tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    e.preventDefault();
                    addTag(search);
                  }
                }}
                className="h-8"
              />
            </div>
            <ScrollArea className="max-h-60">
              <div className="p-1">
                {canCreate && (
                  <button
                    onClick={() => addTag(search)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    Criar tag{" "}
                    <span className="font-mono text-xs">"{search.trim()}"</span>
                  </button>
                )}
                {tagsLoading ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Carregando...
                  </div>
                ) : suggestions.length === 0 && !canCreate ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    {search ? "Nenhuma tag encontrada" : "Sem tags disponíveis"}
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
          </PopoverContent>
        </Popover>
      </div>

      {currentTags.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma tag. Adicione para destacar o lead no kanban.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {currentTags.map((t) => {
            const isPrimary =
              primaryTag && primaryTag.toLowerCase() === t.toLowerCase();
            return (
              <Badge
                key={t}
                variant={isPrimary ? "default" : "secondary"}
                className={cn(
                  "text-[11px] pl-2 pr-1 py-0.5 gap-1 group",
                  isPrimary && "bg-amber-500 hover:bg-amber-500/90 text-white",
                )}
              >
                <button
                  type="button"
                  onClick={() => setPrimary(t)}
                  title={
                    isPrimary ? "Remover destaque" : "Definir como principal"
                  }
                  className="flex items-center"
                  disabled={saving}
                >
                  <Star
                    className={cn(
                      "h-3 w-3",
                      isPrimary ? "fill-white" : "opacity-50",
                    )}
                  />
                </button>
                <span className="truncate max-w-[160px]">{t}</span>
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  className="hover:bg-black/10 rounded-sm"
                  title="Remover tag"
                  disabled={saving}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {saving && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
