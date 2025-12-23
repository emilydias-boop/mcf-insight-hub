import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Palette } from 'lucide-react';
import { CloserWithAvailability, useUpdateAvailability, useUpdateCloserColor } from '@/hooks/useAgendaData';
import { BlockedDatesConfig } from './BlockedDatesConfig';
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

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#22C55E', '#F97316',
  '#EF4444', '#06B6D4', '#84CC16', '#F59E0B', '#6366F1',
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
  const updateColor = useUpdateCloserColor();
  const [selectedColor, setSelectedColor] = useState(closer.color || '#3B82F6');
  
  const [slots, setSlots] = useState<AvailabilitySlot[]>(() => {
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
      return [
        { day_of_week: day.value, start_time: '09:00', end_time: '12:00', slot_duration_minutes: 30, is_active: true },
        { day_of_week: day.value, start_time: '14:00', end_time: '18:00', slot_duration_minutes: 30, is_active: true },
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

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    updateColor.mutate({ closerId: closer.id, color });
  };

  return (
    <div className="space-y-6">
      {/* Color Picker */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Cor do Closer
        </Label>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                className={cn(
                  'w-7 h-7 rounded-full transition-all',
                  selectedColor === color && 'ring-2 ring-offset-2 ring-primary'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Input
            type="color"
            value={selectedColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-10 h-8 p-0 border-0 cursor-pointer"
          />
          <div
            className="w-8 h-8 rounded border"
            style={{ backgroundColor: selectedColor }}
          />
        </div>
      </div>

      {/* Availability by Day */}
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
                      (slots de 30min)
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
  const [activeTab, setActiveTab] = useState('availability');

  const currentCloserId = selectedCloser || closers[0]?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Closers</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Closer Selection Tabs */}
            <Tabs value={currentCloserId} onValueChange={setSelectedCloser}>
              <TabsList className="w-full flex flex-wrap h-auto gap-1">
                {closers.map(closer => (
                  <TabsTrigger 
                    key={closer.id} 
                    value={closer.id} 
                    className="text-xs flex items-center gap-1.5"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: closer.color || '#6B7280' }}
                    />
                    {closer.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Config Type Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="availability">Disponibilidade</TabsTrigger>
                <TabsTrigger value="blocked">Datas Bloqueadas</TabsTrigger>
              </TabsList>

              <TabsContent value="availability" className="mt-4">
                {closers.map(closer => (
                  currentCloserId === closer.id && (
                    <CloserAvailabilityForm key={closer.id} closer={closer} />
                  )
                ))}
              </TabsContent>

              <TabsContent value="blocked" className="mt-4">
                {currentCloserId && (
                  <BlockedDatesConfig closerId={currentCloserId} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
