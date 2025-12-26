import { useEffect, useRef } from 'react';
import { parseISO, differenceInMilliseconds } from 'date-fns';
import { toast } from 'sonner';
import { useUpcomingMeetings } from './useAgendaData';

const REMINDER_MINUTES = 15;
const STORAGE_KEY = 'notified-meeting-reminders';

export function useMeetingReminders() {
  const { data: meetings } = useUpcomingMeetings(new Date());
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    // Clear previous timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!meetings?.length) return;

    const now = new Date();
    const notifiedIds: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    meetings.forEach(meeting => {
      // Skip already notified
      if (notifiedIds.includes(meeting.id)) return;

      // Skip non-scheduled meetings
      if (meeting.status !== 'scheduled' && meeting.status !== 'rescheduled') return;

      const meetingTime = parseISO(meeting.scheduled_at);
      const reminderTime = new Date(meetingTime.getTime() - REMINDER_MINUTES * 60 * 1000);
      const timeUntilReminder = differenceInMilliseconds(reminderTime, now);

      // Only set timer if reminder is in the future and within 24h
      if (timeUntilReminder > 0 && timeUntilReminder < 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => {
          const meetingHour = meetingTime.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const leadName = meeting.deal?.contact?.name || meeting.deal?.name || 'Lead';

          toast.info(`📅 Reunião em ${REMINDER_MINUTES} minutos!`, {
            description: `${leadName} às ${meetingHour}`,
            duration: 10000,
          });

          // Mark as notified
          const updated = [...notifiedIds, meeting.id];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }, timeUntilReminder);

        timersRef.current.push(timer);
      }
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [meetings]);

  // Clean old notifications daily
  useEffect(() => {
    const cleanOldNotifications = () => {
      const notifiedIds: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      // Keep only last 100 IDs
      if (notifiedIds.length > 100) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifiedIds.slice(-100)));
      }
    };
    cleanOldNotifications();
  }, []);
}
