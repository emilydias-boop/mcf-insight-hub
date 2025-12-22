import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Save } from 'lucide-react';
import { CloserWithAvailability, useUpdateAvailability } from '@/hooks/useAgendaData';
import { cn } from '@/lib/utils';

interface CloserAvailabilityConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closers: CloserWithAvailability[];
  isLoading: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
];

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

function CloserAvailabilityForm({ closer }: { closer: CloserWithAvailability }) {
  const updateAvailability = useUpdateAvailability();
  
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() => {
    // Initialize with existing availability or defaults
    return DAYS_OF_WEEK.flatMap(day => {
      const existing = closer.availability.filter(a => a.day_of_week === day.value);
      if (existing.length > 0) {
        return existing.map(e => ({
          day_of_week: e.day_of_week,
          start_time: e.start_time,
          end_time: e.end_time,
          slot_duration_minutes: e.slot_duration_minutes,
          is_active: e.is_active,
        }));
      }
      // Default slots for each day (morning and afternoon)
      return [
        { day_of_week: day.value, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 60, is_active: true },
        { day_of_week: day.value, start_time: '14:00', end_time: '18:00', slot_duration_minutes: 60, is_active: true },
      ];
    });
  });

  const updateSlot = (dayOfWeek: number, index: number, field: keyof AvailabilitySlot, value: string | number | boolean) => {
    setSlots(prev => {
      const daySlots = prev.filter(s => s.day_of_week === dayOfWeek);
      const otherSlots = prev.filter(s => s.day_of_week !== dayOfWeek);
      daySlots[index] = { ...daySlots[index], [field]: value };
      return [...otherSlots, ...daySlots].sort((a, b) => a.day_of_week - b.day_of_week);
    });
  };

  const toggleDayActive = (dayOfWeek: number, isActive: boolean) => {
    setSlots(prev => prev.map(s => 
      s.day_of_week === dayOfWeek ? { ...s, is_active: isActive } : s
    ));
  };

  const handleSave = () => {
    const activeSlots = slots.filter(s => s.is_active);
    updateAvailability.mutate({
      closerId: closer.id,
      availability: activeSlots,
    });
  };

  return (
    <div className="space-y-4">
      {DAYS_OF_WEEK.map(day => {
        const daySlots = slots.filter(s => s.day_of_week === day.value);
        const isDayActive = daySlots.some(s => s.is_active);

        return (
          <div key={day.value} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={isDayActive}
                  onCheckedChange={(checked) => toggleDayActive(day.value, checked)}
                />
                <Label className={cn('font-medium', !isDayActive && 'text-muted-foreground')}>
                  {day.label}
                </Label>
              </div>
            </div>

            {isDayActive && (
              <div className="space-y-2 pl-10">
                {daySlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={slot.start_time}
                      onChange={(e) => updateSlot(day.value, idx, 'start_time', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={slot.end_time}
                      onChange={(e) => updateSlot(day.value, idx, 'end_time', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground ml-2">
                      (slots de {slot.slot_duration_minutes}min)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Button 
        onClick={handleSave} 
        disabled={updateAvailability.isPending}
        className="w-full"
      >
        <Save className="h-4 w-4 mr-2" />
        Salvar Disponibilidade
      </Button>
    </div>
  );
}

export function CloserAvailabilityConfig({ open, onOpenChange, closers, isLoading }: CloserAvailabilityConfigProps) {
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Disponibilidade dos Closers</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Tabs value={selectedCloser || closers[0]?.id} onValueChange={setSelectedCloser}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${closers.length}, 1fr)` }}>
              {closers.map(closer => (
                <TabsTrigger key={closer.id} value={closer.id} className="text-xs">
                  {closer.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {closers.map(closer => (
              <TabsContent key={closer.id} value={closer.id} className="mt-4">
                <CloserAvailabilityForm closer={closer} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
