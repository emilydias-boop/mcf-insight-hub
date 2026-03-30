import { Button } from '@/components/ui/button';
import { CheckCircle2, UserPlus, X, Loader2, Copy, Trash2, ArrowRightLeft } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onTransfer: () => void;
  onClearSelection: () => void;
  isTransferring: boolean;
  onDuplicate?: () => void;
  isDuplicating?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  onMoveStage?: () => void;
  isMovingStage?: boolean;
}

export const BulkActionsBar = ({
  selectedCount,
  onTransfer,
  onClearSelection,
  isTransferring,
  onDuplicate,
  isDuplicating = false,
  onDelete,
  isDeleting = false,
  onMoveStage,
  isMovingStage = false,
}: BulkActionsBarProps) => {
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
          disabled={isTransferring || isDuplicating || isMovingStage}
          className="gap-2"
        >
          {isTransferring ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Transferir para...
        </Button>

        {onMoveStage && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onMoveStage}
            disabled={isTransferring || isDuplicating || isMovingStage}
            className="gap-2"
          >
            {isMovingStage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" />
            )}
            Mover Estágio
          </Button>
        )}

        {onDuplicate && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onDuplicate}
            disabled={isTransferring || isDuplicating}
            className="gap-2"
          >
            {isDuplicating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Duplicar p/ Inside
          </Button>
        )}

        {onDelete && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onDelete}
            disabled={isTransferring || isDuplicating || isDeleting}
            className="gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/30"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Excluir
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isTransferring || isDuplicating}
          className="text-primary-foreground hover:text-primary-foreground/80 hover:bg-primary-foreground/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
