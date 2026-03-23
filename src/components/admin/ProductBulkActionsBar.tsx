import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, X, Loader2, Building2, Tag, ToggleLeft, BarChart3 } from "lucide-react";
import { TARGET_BU_OPTIONS, PRODUCT_CATEGORY_OPTIONS, useBulkUpdateProducts } from "@/hooks/useProductConfigurations";

interface ProductBulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
}

export function ProductBulkActionsBar({
  selectedCount,
  selectedIds,
  onClearSelection,
}: ProductBulkActionsBarProps) {
  const bulkUpdate = useBulkUpdateProducts();
  const [action, setAction] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  const handleBulkBU = (bu: string) => {
    bulkUpdate.mutate(
      { ids: selectedIds, updates: { target_bu: bu } },
      { onSuccess: () => { onClearSelection(); setAction(null); } }
    );
  };

  const handleBulkCategory = (cat: string) => {
    bulkUpdate.mutate(
      { ids: selectedIds, updates: { product_category: cat } },
      { onSuccess: () => { onClearSelection(); setAction(null); } }
    );
  };

  const handleBulkActive = (active: boolean) => {
    bulkUpdate.mutate(
      { ids: selectedIds, updates: { is_active: active } },
      { onSuccess: () => { onClearSelection(); setAction(null); } }
    );
  };

  const handleBulkDashboard = (count: boolean) => {
    bulkUpdate.mutate(
      { ids: selectedIds, updates: { count_in_dashboard: count } },
      { onSuccess: () => { onClearSelection(); setAction(null); } }
    );
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">
            {selectedCount} produto{selectedCount > 1 ? "s" : ""} selecionado{selectedCount > 1 ? "s" : ""}
          </span>
        </div>

        <div className="h-4 w-px bg-primary-foreground/30" />

        {bulkUpdate.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : action === null ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setAction("bu")} className="gap-1.5">
              <Building2 className="h-4 w-4" /> BU
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAction("category")} className="gap-1.5">
              <Tag className="h-4 w-4" /> Categoria
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAction("status")} className="gap-1.5">
              <ToggleLeft className="h-4 w-4" /> Status
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAction("dashboard")} className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> Dashboard
            </Button>
          </>
        ) : action === "bu" ? (
          <div className="flex items-center gap-2">
            <Select onValueChange={handleBulkBU}>
              <SelectTrigger className="w-[160px] h-8 bg-secondary text-secondary-foreground">
                <SelectValue placeholder="Selecionar BU" />
              </SelectTrigger>
              <SelectContent>
                {TARGET_BU_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)} className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10">
              Voltar
            </Button>
          </div>
        ) : action === "category" ? (
          <div className="flex items-center gap-2">
            <Select onValueChange={handleBulkCategory}>
              <SelectTrigger className="w-[180px] h-8 bg-secondary text-secondary-foreground">
                <SelectValue placeholder="Selecionar Categoria" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)} className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10">
              Voltar
            </Button>
          </div>
        ) : action === "status" ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleBulkActive(true)}>Ativar</Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkActive(false)}>Desativar</Button>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)} className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10">
              Voltar
            </Button>
          </div>
        ) : action === "dashboard" ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleBulkDashboard(true)}>Contar</Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkDashboard(false)}>Não Contar</Button>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)} className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10">
              Voltar
            </Button>
          </div>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => { onClearSelection(); setAction(null); }}
          disabled={bulkUpdate.isPending}
          className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
