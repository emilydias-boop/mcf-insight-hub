import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette, Plus, Trash2, Copy, Loader2, Users } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { BlockedDatesConfig } from './BlockedDatesConfig';
import { R2DailySlotConfig } from './R2DailySlotConfig';
import { cn } from '@/lib/utils';
import { 
  useCloserMeetingLinksList, 
  useCreateCloserMeetingLink, 
  useDeleteCloserMeetingLink,
  useUpdateCloserMeetingLink 
} from '@/hooks/useCloserMeetingLinks';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { R2Closer, useUpdateR2Closer } from '@/hooks/useR2Closers';

interface R2CloserAvailabilityConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closers: R2Closer[];
  isLoading: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#22C55E', '#F97316',
  '#EF4444', '#06B6D4', '#84CC16', '#F59E0B', '#6366F1',
];

function R2CloserAvailabilityForm({ closer }: { closer: R2Closer }) {
  const queryClient = useQueryClient();
  const updateR2Closer = useUpdateR2Closer();
  const { data: links, isLoading } = useCloserMeetingLinksList(closer.id);
  const createLink = useCreateCloserMeetingLink();
  const deleteLink = useDeleteCloserMeetingLink();
  const updateLink = useUpdateCloserMeetingLink();
  
  const [selectedColor, setSelectedColor] = useState(closer.color || '#3B82F6');
  const [maxLeads, setMaxLeads] = useState(closer.max_leads_per_slot || 4);
  const [addingDay, setAddingDay] = useState<number | null>(null);
  const [newTime, setNewTime] = useState('09:00');
  const [newLink, setNewLink] = useState('');
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState<number | null>(null);
  const [editedLinks, setEditedLinks] = useState<Record<string, string>>({});

  // Count links per day for copy dialog
  const linksPerDay = useMemo(() => {
    const counts: Record<number, number> = {};
    DAYS_OF_WEEK.forEach(d => counts[d.value] = 0);
    links?.forEach(link => {
      counts[link.day_of_week] = (counts[link.day_of_week] || 0) + 1;
    });
    return counts;
  }, [links]);

  // Mutation to copy links from one day to another
  const copyLinks = useMutation({
    mutationFn: async ({ fromDay, toDay }: { fromDay: number; toDay: number }) => {
      const sourceLinks = links?.filter(l => l.day_of_week === fromDay) || [];
      
      if (sourceLinks.length === 0) {
        throw new Error('Dia de origem não tem horários configurados');
      }

      const targetLinks = links?.filter(l => l.day_of_week === toDay) || [];
      const existingTimes = new Set(targetLinks.map(l => l.start_time));
      const linksToCreate = sourceLinks.filter(l => !existingTimes.has(l.start_time));

      if (linksToCreate.length === 0) {
        throw new Error('Todos os horários já existem no dia de destino');
      }

      const { error } = await supabase
        .from('closer_meeting_links')
        .insert(
          linksToCreate.map(link => ({
            closer_id: closer.id,
            day_of_week: toDay,
            start_time: link.start_time,
            google_meet_link: link.google_meet_link,
          }))
        );

      if (error) throw error;
      return linksToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['closer-meeting-links'] });
      queryClient.invalidateQueries({ queryKey: ['closer-day-slots'] });
      queryClient.invalidateQueries({ queryKey: ['unique-slots-for-days'] });
      toast.success(`${count} horário(s) copiado(s) com sucesso!`);
      setShowCopyDialog(null);
      setCopyFromDay(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    updateR2Closer.mutate({ id: closer.id, data: { color } });
  };

  const handleMaxLeadsChange = (value: number[]) => {
    setMaxLeads(value[0]);
    updateR2Closer.mutate({ id: closer.id, data: { max_leads_per_slot: value[0] } });
  };

  const handleAdd = () => {
    if (addingDay === null || addingDay === undefined || !newTime || !newLink) {
      toast.error('Preencha todos os campos');
      return;
    }
    createLink.mutate({
      closer_id: closer.id,
      day_of_week: addingDay,
      start_time: newTime,
      google_meet_link: newLink,
    }, {
      onSuccess: () => {
        setAddingDay(null);
        setNewTime('09:00');
        setNewLink('');
      }
    });
  };

  const handleCopy = (toDay: number) => {
    if (copyFromDay === null) {
      toast.error('Selecione um dia para copiar');
      return;
    }
    copyLinks.mutate({ fromDay: copyFromDay, toDay });
  };

  const getDaysWithLinks = (excludeDay: number) => {
    return DAYS_OF_WEEK.filter(d => d.value !== excludeDay && linksPerDay[d.value] > 0);
  };

  const formatTime = (time: string) => time.substring(0, 5);

  const linksByDay = DAYS_OF_WEEK.map(day => ({
    ...day,
    links: (links || [])
      .filter(l => l.day_of_week === day.value)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }));

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

      {/* Max Leads per Slot Slider */}
      <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Leads por Reunião: <span className="font-bold text-primary">{maxLeads}</span>
        </Label>
        <Slider
          value={[maxLeads]}
          onValueChange={handleMaxLeadsChange}
          min={1}
          max={6}
          step={1}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Quantos leads podem ser agendados no mesmo horário (padrão: 4)
        </p>
      </div>

      {/* Slots by Day */}
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-4">
          {linksByDay.map(day => {
            const daysWithLinks = getDaysWithLinks(day.value);
            return (
            <div key={day.value} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="font-medium flex items-center gap-2">
                  {day.label}
                  {day.links.length > 0 && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                      {day.links.length} horário{day.links.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-1">
                  {daysWithLinks.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowCopyDialog(showCopyDialog === day.value ? null : day.value);
                        setCopyFromDay(null);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddingDay(addingDay === day.value ? null : day.value)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Copy from dialog */}
              {showCopyDialog === day.value && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-2 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm font-medium">Copiar horários de:</p>
                  <div className="flex flex-wrap gap-1">
                    {daysWithLinks.map(d => (
                      <Button
                        key={d.value}
                        size="sm"
                        variant={copyFromDay === d.value ? 'default' : 'outline'}
                        onClick={() => setCopyFromDay(d.value)}
                      >
                        {d.label} ({linksPerDay[d.value]})
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCopyDialog(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCopy(day.value)}
                      disabled={copyFromDay === null || copyLinks.isPending}
                    >
                      {copyLinks.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Copiar para {day.label}
                    </Button>
                  </div>
                </div>
              )}

              {/* Add form */}
              {addingDay === day.value && (
                <div className="mb-3 p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-28"
                    />
                    <Input
                      placeholder="https://meet.google.com/..."
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleAdd}
                      disabled={createLink.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {/* Links list */}
              {day.links.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum horário configurado</p>
              ) : (
                <div className="space-y-2">
                  {day.links.map(link => {
                    const currentValue = editedLinks[link.id] ?? link.google_meet_link ?? '';
                    const isEditing = editedLinks[link.id] !== undefined;
                    const isEmpty = !currentValue;
                    
                    return (
                      <div key={link.id} className="flex items-center gap-2">
                        <span className="font-mono text-sm w-14">{formatTime(link.start_time)}</span>
                        <Input
                          value={currentValue}
                          onChange={(e) => setEditedLinks(prev => ({ ...prev, [link.id]: e.target.value }))}
                          onBlur={() => {
                            if (isEditing && editedLinks[link.id] !== (link.google_meet_link ?? '')) {
                              updateLink.mutate({ id: link.id, google_meet_link: editedLinks[link.id] });
                            }
                            setEditedLinks(prev => {
                              const { [link.id]: _, ...rest } = prev;
                              return rest;
                            });
                          }}
                          placeholder="https://meet.google.com/..."
                          className={cn(
                            "flex-1 text-xs",
                            isEmpty && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                          )}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteLink.mutate(link.id)}
                          disabled={deleteLink.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function R2CloserAvailabilityConfig({ open, onOpenChange, closers, isLoading }: R2CloserAvailabilityConfigProps) {
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('daily');

  const currentCloserId = selectedCloser || closers[0]?.id;
  const currentCloser = closers.find(c => c.id === currentCloserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Closers R2</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : closers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum closer R2 cadastrado. Adicione um closer primeiro.
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="fixed">Horários Fixos</TabsTrigger>
                <TabsTrigger value="daily">Por Data</TabsTrigger>
                <TabsTrigger value="blocked">Bloqueados</TabsTrigger>
              </TabsList>

              <TabsContent value="fixed" className="mt-4">
                {currentCloser && (
                  <R2CloserAvailabilityForm 
                    key={currentCloser.id} 
                    closer={currentCloser} 
                  />
                )}
              </TabsContent>

              <TabsContent value="daily" className="mt-4">
                {currentCloser && (
                  <R2DailySlotConfig
                    key={`daily-${currentCloser.id}`}
                    closer={currentCloser}
                  />
                )}
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
