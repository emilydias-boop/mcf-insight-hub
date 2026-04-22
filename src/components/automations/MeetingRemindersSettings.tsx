import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Play, Save, Bell } from 'lucide-react';
import {
  useMeetingReminderSettings,
  useUpdateMeetingReminderSettings,
  useRunRemindersCron,
} from '@/hooks/useMeetingReminderSettings';
import { ACSetupChecklist } from './ACSetupChecklist';
import { MeetingRemindersLogs } from './MeetingRemindersLogs';
import { MeetingRemindersMetrics } from './MeetingRemindersMetrics';

const OFFSETS = [
  { key: 'd-1', label: '24 horas antes' },
  { key: 'h-4', label: '4 horas antes' },
  { key: 'h-2', label: '2 horas antes' },
  { key: 'h-1', label: '1 hora antes' },
  { key: 'm-20', label: '20 minutos antes' },
  { key: 'm-0', label: 'Hora exata' },
];

export function MeetingRemindersSettings() {
  const { data: settings, isLoading } = useMeetingReminderSettings();
  const update = useUpdateMeetingReminderSettings();
  const run = useRunRemindersCron();

  const [fallbackLink, setFallbackLink] = useState('');
  const [acListId, setAcListId] = useState('');

  useEffect(() => {
    if (settings) {
      setFallbackLink(settings.fallback_meeting_link ?? '');
      setAcListId(settings.ac_list_id ? String(settings.ac_list_id) : '');
    }
  }, [settings?.id]);

  if (isLoading || !settings) {
    return <div className="text-sm text-muted-foreground">Carregando configurações...</div>;
  }

  const enabled = new Set(settings.enabled_offsets);
  const toggleOffset = (k: string, v: boolean) => {
    const next = v ? [...settings.enabled_offsets, k] : settings.enabled_offsets.filter(o => o !== k);
    update.mutate({ enabled_offsets: next });
  };

  const saveFallback = () => {
    update.mutate({
      fallback_meeting_link: fallbackLink.trim() || null,
      ac_list_id: acListId.trim() ? parseInt(acListId, 10) : null,
    });
  };

  const tryActivate = (next: boolean) => {
    if (next && !settings.ac_setup_confirmed) {
      // Block activation
      return;
    }
    update.mutate({ is_active: next });
  };

  return (
    <div className="space-y-6">
      {/* Status & Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Lembretes de Reunião por Email
          </CardTitle>
          <CardDescription>
            Sequência de 6 emails enviados via ActiveCampaign para reduzir no-show.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings.ac_setup_confirmed && (
            <Alert variant="default" className="border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle>Setup AC pendente</AlertTitle>
              <AlertDescription>
                Complete o checklist abaixo no painel da ActiveCampaign antes de ativar o sistema.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between p-4 border rounded-md">
            <div>
              <Label className="text-base">Sistema ativo</Label>
              <p className="text-sm text-muted-foreground">
                {settings.is_active ? 'Lembretes serão disparados a cada 5 minutos' : 'Sistema desligado'}
              </p>
            </div>
            <Switch
              checked={settings.is_active}
              onCheckedChange={tryActivate}
              disabled={!settings.ac_setup_confirmed && !settings.is_active}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => run.mutate()}
            disabled={run.isPending || !settings.is_active}
          >
            <Play className="h-4 w-4 mr-2" />
            {run.isPending ? 'Executando...' : 'Executar cron agora'}
          </Button>
        </CardContent>
      </Card>

      {/* Métricas */}
      <MeetingRemindersMetrics />

      {/* Setup AC */}
      <ACSetupChecklist />

      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription>Quais momentos disparam, para quais reuniões e link de fallback.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold mb-3">Momentos de envio</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {OFFSETS.map(o => (
                <div key={o.key} className="flex items-center gap-3 p-2 border rounded-md">
                  <Checkbox
                    checked={enabled.has(o.key)}
                    onCheckedChange={v => toggleOffset(o.key, !!v)}
                  />
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{o.label}</Label>
                    <Badge variant="outline" className="ml-2 text-xs">{o.key}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Tipos de reunião</h3>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label>Aplicar a R1 (qualificação)</Label>
              <Switch
                checked={settings.apply_to_r1}
                onCheckedChange={v => update.mutate({ apply_to_r1: v })}
              />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <Label>Aplicar a R2 (closer)</Label>
              <Switch
                checked={settings.apply_to_r2}
                onCheckedChange={v => update.mutate({ apply_to_r2: v })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <Label htmlFor="fallback-link">Link Meet de fallback</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Usado quando o closer não tem link cadastrado em closer_meeting_links.
              </p>
              <Input
                id="fallback-link"
                placeholder="https://meet.google.com/xxx-yyyy-zzz"
                value={fallbackLink}
                onChange={e => setFallbackLink(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ac-list">ID da Lista AC (opcional)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Inscreve o lead nessa lista ao enviar o lembrete.
              </p>
              <Input
                id="ac-list"
                type="number"
                placeholder="Ex: 123"
                value={acListId}
                onChange={e => setAcListId(e.target.value)}
              />
            </div>
            <Button onClick={saveFallback} disabled={update.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </section>
        </CardContent>
      </Card>

      {/* Logs */}
      <MeetingRemindersLogs />
    </div>
  );
}
