import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Square, CheckSquare, MinusSquare, ListChecks } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
}

interface StageSelectionControlsProps {
  stageDeals: Deal[];
  selectedDealIds: Set<string>;
  onSelectByCount: (dealIds: string[], count: number) => void;
  onSelectAll: (dealIds: string[]) => void;
  onClearStage: (dealIds: string[]) => void;
}

export const StageSelectionControls = ({
  stageDeals,
  selectedDealIds,
  onSelectByCount,
  onSelectAll,
  onClearStage,
}: StageSelectionControlsProps) => {
  const [count, setCount] = useState('');
  
  const stageDealIds = stageDeals.map(d => d.id);
  const selectedInStage = stageDealIds.filter(id => selectedDealIds.has(id)).length;
  
  const getSelectionState = () => {
    if (selectedInStage === 0) return 'none';
    if (selectedInStage === stageDeals.length) return 'all';
    return 'some';
  };
  
  const handleCheckboxClick = () => {
    const state = getSelectionState();
    if (state === 'all' || state === 'some') {
      onClearStage(stageDealIds);
    } else {
      onSelectAll(stageDealIds);
    }
  };
  
  const handleApplyCount = () => {
    const num = parseInt(count, 10);
    if (!isNaN(num) && num > 0) {
      onSelectByCount(stageDealIds, num);
      setCount('');
    }
  };
  
  const selectionState = getSelectionState();
  
  return (
    <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-border/30">
      {/* Checkbox de estado */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCheckboxClick}
        className="h-6 w-6 p-0 hover:bg-background/50"
        title={selectionState === 'all' ? 'Desmarcar todos' : 'Selecionar todos'}
      >
        {selectionState === 'all' ? (
          <CheckSquare className="h-4 w-4" />
        ) : selectionState === 'some' ? (
          <MinusSquare className="h-4 w-4" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </Button>
      
      {/* Input de quantidade */}
      <Input
        type="number"
        min={1}
        max={stageDeals.length}
        placeholder="Qtd"
        value={count}
        onChange={(e) => setCount(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleApplyCount();
          }
        }}
        className="w-14 h-6 text-xs px-1.5"
      />
      
      {/* Botão "Todos" */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSelectAll(stageDealIds)}
        className="h-6 px-1.5 text-xs hover:bg-background/50"
        title={`Selecionar todos (${stageDeals.length})`}
      >
        <ListChecks className="h-3.5 w-3.5 mr-0.5" />
        Todos
      </Button>
      
      {/* Contador se há selecionados */}
      {selectedInStage > 0 && (
        <span className="text-xs text-muted-foreground ml-auto">
          {selectedInStage}
        </span>
      )}
    </div>
  );
};
