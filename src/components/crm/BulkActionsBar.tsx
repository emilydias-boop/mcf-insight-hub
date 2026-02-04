import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, UserPlus, X, Loader2, Hash, ListChecks } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onTransfer: () => void;
  onClearSelection: () => void;
  isTransferring: boolean;
  // New props for quantity selection
  onSelectByCount?: (count: number | 'all') => void;
  selectionMode?: boolean;
}

export const BulkActionsBar = ({
  selectedCount,
  onTransfer,
  onClearSelection,
  isTransferring,
  onSelectByCount,
  selectionMode = false,
}: BulkActionsBarProps) => {
  const [quantityInput, setQuantityInput] = useState<string>('');
  
  const handleApplyQuantity = () => {
    const count = parseInt(quantityInput, 10);
    if (!isNaN(count) && count > 0 && onSelectByCount) {
      onSelectByCount(count);
    }
  };
  
  const handleSelectAll = () => {
    if (onSelectByCount) {
      onSelectByCount('all');
    }
  };

  // Show quantity selector when in selection mode with no selections yet
  if (selectionMode && selectedCount === 0 && onSelectByCount) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 bg-muted text-foreground px-4 py-3 rounded-lg shadow-lg border">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Selecionar quantidade:</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              placeholder="Ex: 50"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              className="w-24 h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplyQuantity();
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleApplyQuantity}
              disabled={!quantityInput || parseInt(quantityInput, 10) <= 0}
            >
              Aplicar
            </Button>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="gap-1"
          >
            <ListChecks className="h-4 w-4" />
            Todos
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Standard selection bar when items are selected
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">
            {selectedCount} lead{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}
          </span>
        </div>
        
        <div className="h-4 w-px bg-primary-foreground/30" />
        
        <Button
          variant="secondary"
          size="sm"
          onClick={onTransfer}
          disabled={isTransferring}
          className="gap-2"
        >
          {isTransferring ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Transferir para...
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isTransferring}
          className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
