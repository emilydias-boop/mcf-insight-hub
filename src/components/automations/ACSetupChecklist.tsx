import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useMeetingReminderSettings, useUpdateMeetingReminderSettings } from '@/hooks/useMeetingReminderSettings';

const CUSTOM_FIELDS = [
  { key: 'meeting_link', label: 'meeting_link', desc: 'URL do Google Meet' },
  { key: 'meeting_date', label: 'meeting_date', desc: 'Data formatada (DD/MM/AAAA)' },
  { key: 'meeting_time', label: 'meeting_time', desc: 'Hora (HH:mm)' },
  { key: 'meeting_type', label: 'meeting_type', desc: 'R1 ou R2' },
  { key: 'closer_name', label: 'closer_name', desc: 'Nome do closer' },
  { key: 'sdr_name', label: 'sdr_name', desc: 'Nome do SDR/owner' },
  { key: 'whatsapp_owner', label: 'whatsapp_owner', desc: 'Telefone do responsável' },
  { key: 'bu_name', label: 'bu_name', desc: 'Business Unit' },
];

const TAGS = [
  { key: 'reminder_d-1', desc: '24h antes' },
  { key: 'reminder_h-4', desc: '4h antes' },
  { key: 'reminder_h-2', desc: '2h antes' },
  { key: 'reminder_h-1', desc: '1h antes' },
  { key: 'reminder_m-20', desc: '20 min antes' },
  { key: 'reminder_m-0', desc: 'Hora exata' },
];

const AUTOMATIONS = TAGS.map(t => ({
  key: `automation_${t.key}`,
  label: `Automation: ${t.key}`,
  desc: `Trigger: tag "${t.key}" adicionada → enviar email → remover tag`,
}));

export function ACSetupChecklist() {
  const { data: settings } = useMeetingReminderSettings();
  const update = useUpdateMeetingReminderSettings();
  const checklist = (settings?.ac_setup_checklist as Record<string, boolean>) ?? {};

  const allItems = [
    ...CUSTOM_FIELDS.map(f => `field_${f.key}`),
    ...TAGS.map(t => `tag_${t.key}`),
    ...AUTOMATIONS.map(a => a.key),
  ];
  const allDone = allItems.every(k => checklist[k]);

  const toggle = (key: string, value: boolean) => {
    const next = { ...checklist, [key]: value };
    update.mutate({ ac_setup_checklist: next });
  };

  const confirmSetup = () => {
    update.mutate({ ac_setup_confirmed: true });
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copiado: ${text}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {settings?.ac_setup_confirmed ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <AlertCircle className="h-5 w-5 text-warning" />
          )}
          Checklist de Setup ActiveCampaign
        </CardTitle>
        <CardDescription>
          Marque cada item após criar no painel do ActiveCampaign. Os lembretes só funcionarão quando todos os itens estiverem configurados e o setup confirmado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold mb-2">1. Campos customizados de contato (perstag)</h3>
          <div className="space-y-2">
            {CUSTOM_FIELDS.map(f => {
              const k = `field_${f.key}`;
              return (
                <div key={k} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                  <Checkbox
                    checked={!!checklist[k]}
                    onCheckedChange={v => toggle(k, !!v)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{f.label}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(f.label)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">2. Tags</h3>
          <div className="space-y-2">
            {TAGS.map(t => {
              const k = `tag_${t.key}`;
              return (
                <div key={k} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                  <Checkbox
                    checked={!!checklist[k]}
                    onCheckedChange={v => toggle(k, !!v)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{t.key}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(t.key)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Badge variant="outline" className="text-xs">{t.desc}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2">3. Automations (1 por tag)</h3>
          <div className="space-y-2">
            {AUTOMATIONS.map(a => (
              <div key={a.key} className="flex items-center gap-3 p-2 rounded-md border bg-card">
                <Checkbox
                  checked={!!checklist[a.key]}
                  onCheckedChange={v => toggle(a.key, !!v)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pt-4 border-t flex items-center justify-between">
          <p className="text-sm">
            {allDone ? (
              <span className="text-success font-medium">✓ Todos os itens marcados</span>
            ) : (
              <span className="text-muted-foreground">
                {allItems.filter(k => checklist[k]).length}/{allItems.length} itens marcados
              </span>
            )}
          </p>
          <Button
            disabled={!allDone || settings?.ac_setup_confirmed || update.isPending}
            onClick={confirmSetup}
          >
            {settings?.ac_setup_confirmed ? 'Setup confirmado' : 'Confirmar setup AC'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
