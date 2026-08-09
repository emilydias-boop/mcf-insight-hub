import { supabase } from '@/integrations/supabase/client';

export type GoogleCalendarSyncAction = 'create' | 'update' | 'cancel';

/**
 * Dispara a sincronização do evento no Google Calendar do closer.
 * Fire-and-forget: nunca lança erro nem trava a UI — falhas do Google
 * apenas são logadas no console.
 */
export function syncGoogleCalendar(
  action: GoogleCalendarSyncAction,
  meetingSlotId?: string | null,
): void {
  if (!meetingSlotId) return;

  void supabase.functions
    .invoke('google-calendar-sync', {
      body: { action, meeting_slot_id: meetingSlotId },
    })
    .then(({ data, error }) => {
      if (error) {
        console.warn('[google-calendar-sync] falha ao sincronizar evento', error);
        return;
      }
      if (data && data.success === false) {
        console.warn('[google-calendar-sync] sucesso parcial', data);
      }
    })
    .catch((err) => {
      console.warn('[google-calendar-sync] erro inesperado', err);
    });
}