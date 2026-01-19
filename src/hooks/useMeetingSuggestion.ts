import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format, isAfter, isBefore, startOfDay, setHours, setMinutes } from 'date-fns';

export interface QualificationData {
  renda?: string;
  empreende?: string;
  terreno?: string;
  investimento?: string;
  solucao?: string;
  leadSummary?: string;
}

export interface MeetingSuggestion {
  closerId: string;
  closerName: string;
  closerColor: string;
  date: Date;
  time: string;
  score: number;
  reasons: string[];
  availableSlots: number;
  maxSlots: number;
}

interface UseMeetingSuggestionOptions {
  qualificationData?: QualificationData;
  leadType?: string;
  enabled?: boolean;
}

/**
 * Hook que sugere os melhores horários para agendar uma reunião
 * baseado no perfil do lead e disponibilidade dos closers
 */
export function useMeetingSuggestion({ 
  qualificationData, 
  leadType = 'lead_a',
  enabled = true 
}: UseMeetingSuggestionOptions) {
  
  // Buscar closers ativos
  const { data: closers } = useQuery({
    queryKey: ['closers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closers')
        .select('id, name, email, color, priority')
        .eq('is_active', true)
        .order('priority', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled,
  });

  // Buscar disponibilidade dos closers
  const { data: availability } = useQuery({
    queryKey: ['closers-availability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('closer_availability')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled,
  });

  // Buscar slots já agendados para os próximos 7 dias
  const { data: existingSlots } = useQuery({
    queryKey: ['meeting-slots-next-7-days'],
    queryFn: async () => {
      const startDate = startOfDay(new Date());
      const endDate = addDays(startDate, 7);
      
      const { data, error } = await supabase
        .from('meeting_slots')
        .select(`
          id,
          closer_id,
          scheduled_at,
          status,
          meeting_slot_attendees(count)
        `)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .neq('status', 'canceled');
      if (error) throw error;
      return data;
    },
    enabled,
  });

  // Gerar sugestões baseadas nos dados
  const suggestions = useMemo<MeetingSuggestion[]>(() => {
    if (!closers || !availability || !existingSlots) return [];

    const allSuggestions: MeetingSuggestion[] = [];
    const today = startOfDay(new Date());
    const now = new Date();

    // Iterar pelos próximos 5 dias úteis
    for (let dayOffset = 0; dayOffset <= 5; dayOffset++) {
      const date = addDays(today, dayOffset);
      const dayOfWeek = date.getDay();
      
      // Pular domingos
      if (dayOfWeek === 0) continue;

      closers.forEach(closer => {
        // Encontrar disponibilidade para este dia da semana
        const dayAvailability = availability.filter(
          a => a.closer_id === closer.id && a.day_of_week === dayOfWeek
        );

        dayAvailability.forEach(avail => {
          // Gerar slots baseados no horário disponível
          const [startHour, startMin] = avail.start_time.split(':').map(Number);
          const [endHour, endMin] = avail.end_time.split(':').map(Number);
          
          const maxSlotsPerHour = avail.max_slots_per_hour || 4;
          
          // Gerar horários a cada 30 minutos
          for (let hour = startHour; hour < endHour; hour++) {
            for (let min = 0; min < 60; min += 30) {
              if (hour === startHour && min < startMin) continue;
              if (hour === endHour - 1 && min + 30 > endMin) continue;

              const slotTime = setMinutes(setHours(date, hour), min);
              
              // Pular horários passados
              if (isBefore(slotTime, now)) continue;

              const timeStr = format(slotTime, 'HH:mm');
              
              // Contar slots existentes neste horário
              const slotsAtTime = existingSlots.filter(
                s => s.closer_id === closer.id && 
                format(new Date(s.scheduled_at), 'yyyy-MM-dd HH:mm') === format(slotTime, 'yyyy-MM-dd HH:mm')
              );
              
              const currentOccupancy = slotsAtTime.reduce(
                (acc, s) => acc + ((s.meeting_slot_attendees as any)?.[0]?.count || 0), 
                0
              );
              
              const availableSlots = maxSlotsPerHour - currentOccupancy;
              
              if (availableSlots <= 0) continue;

              // Calcular score
              let score = 50;
              const reasons: string[] = [];

              // Bonus por disponibilidade alta
              if (availableSlots >= 3) {
                score += 15;
                reasons.push('Horário com alta disponibilidade');
              } else if (availableSlots >= 2) {
                score += 10;
                reasons.push('Boa disponibilidade');
              }

              // Bonus por proximidade (quanto mais próximo, melhor)
              const daysUntil = dayOffset;
              if (daysUntil === 0) {
                score += 20;
                reasons.push('Agendamento para hoje');
              } else if (daysUntil === 1) {
                score += 15;
                reasons.push('Agendamento para amanhã');
              } else if (daysUntil <= 3) {
                score += 10;
                reasons.push('Agendamento em breve');
              }

              // Bonus por horário prime (10h-12h, 14h-16h)
              if ((hour >= 10 && hour < 12) || (hour >= 14 && hour < 16)) {
                score += 10;
                reasons.push('Horário de alta conversão');
              }

              // Bonus por perfil do lead (se tiver qualificação)
              if (qualificationData) {
                if (qualificationData.investimento?.includes('+100') || 
                    qualificationData.investimento?.includes('mais de 100')) {
                  score += 5;
                  reasons.push('Lead com alto potencial de investimento');
                }
                if (qualificationData.renda?.includes('+20') || 
                    qualificationData.renda?.includes('+30')) {
                  score += 5;
                }
              }

              // Bonus por prioridade do closer
              if (closer.priority === 1) {
                score += 5;
                reasons.push(`${closer.name} - closer prioritário`);
              }

              allSuggestions.push({
                closerId: closer.id,
                closerName: closer.name,
                closerColor: closer.color || '#3b82f6',
                date: slotTime,
                time: timeStr,
                score: Math.min(100, score),
                reasons,
                availableSlots,
                maxSlots: maxSlotsPerHour,
              });
            }
          }
        });
      });
    }

    // Ordenar por score descendente e retornar top 5
    return allSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [closers, availability, existingSlots, qualificationData]);

  return {
    suggestions,
    isLoading: !closers || !availability || !existingSlots,
    topSuggestion: suggestions[0] || null,
  };
}
