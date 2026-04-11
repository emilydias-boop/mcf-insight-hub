import { Button } from '@/components/ui/button';

interface Props {
  selectedWeek: number | null;
  onWeekChange: (week: number | null) => void;
}

export const CobrancaWeekFilter = ({ selectedWeek, onWeekChange }: Props) => {
  const weeks = [
    { value: null, label: 'Todas' },
    { value: 1, label: 'Sem 1' },
    { value: 2, label: 'Sem 2' },
    { value: 3, label: 'Sem 3' },
    { value: 4, label: 'Sem 4' },
  ];

  return (
    <div className="flex items-center gap-1">
      {weeks.map(w => (
        <Button
          key={w.label}
          variant={selectedWeek === w.value ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => onWeekChange(w.value)}
        >
          {w.label}
        </Button>
      ))}
    </div>
  );
};
