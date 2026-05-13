import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Briefcase } from 'lucide-react';
import { useEmployeeOperational, useUpdateOperationalCloser, useUpdateOperationalSdr } from '@/hooks/useEmployeeOperational';

interface Props {
  employeeId: string;
}

export default function EmployeeOperationalTab({ employeeId }: Props) {
  const { data, isLoading } = useEmployeeOperational(employeeId);
  const updateCloser = useUpdateOperationalCloser(employeeId);
  const updateSdr = useUpdateOperationalSdr(employeeId);

  const [closerForm, setCloserForm] = useState<any>(null);
  const [sdrForm, setSdrForm] = useState<any>(null);

  useEffect(() => {
    if (data?.closer) setCloserForm(data.closer);
  }, [data?.closer?.id]);
  useEffect(() => {
    if (data?.sdr) setSdrForm(data.sdr);
  }, [data?.sdr?.id]);

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!data || !data.roleSystem) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          Este colaborador não possui cargo operacional (Closer ou SDR).
        </CardContent>
      </Card>
    );
  }

  // ---------- CLOSER ----------
  if ((data.roleSystem === 'closer' || data.roleSystem === 'closer_sombra')) {
    if (!closerForm) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Registro de closer não encontrado. Edite e salve o cargo do colaborador para gerar automaticamente.
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Configuração de Closer
            <Badge variant={closerForm.is_active ? 'default' : 'secondary'}>
              {closerForm.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Edite aqui os dados que aparecem na agenda e na distribuição de leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome de exibição</Label>
            <Input value={closerForm.name || ''} onChange={(e) => setCloserForm({ ...closerForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>E-mail (login)</Label>
            <Input value={closerForm.email || ''} onChange={(e) => setCloserForm({ ...closerForm, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>BU</Label>
            <Select value={closerForm.bu || ''} onValueChange={(v) => setCloserForm({ ...closerForm, bu: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consorcio">Consórcio</SelectItem>
                <SelectItem value="incorporador">Incorporador / Inside Sales</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de reunião</Label>
            <Select value={closerForm.meeting_type || ''} onValueChange={(v) => setCloserForm({ ...closerForm, meeting_type: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="r1">R1</SelectItem>
                <SelectItem value="r2">R2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cor (calendário)</Label>
            <Input type="color" value={closerForm.color || '#8B5CF6'} onChange={(e) => setCloserForm({ ...closerForm, color: e.target.value })} />
          </div>
          <div className="space-y-2 flex items-center gap-3 pt-6">
            <Switch checked={!!closerForm.is_active} onCheckedChange={(v) => setCloserForm({ ...closerForm, is_active: v })} />
            <Label>Ativo</Label>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Calendly: Event Type URI</Label>
            <Input value={closerForm.calendly_event_type_uri || ''} onChange={(e) => setCloserForm({ ...closerForm, calendly_event_type_uri: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Calendly: Link padrão</Label>
            <Input value={closerForm.calendly_default_link || ''} onChange={(e) => setCloserForm({ ...closerForm, calendly_default_link: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Google Calendar ID</Label>
            <Input value={closerForm.google_calendar_id || ''} onChange={(e) => setCloserForm({ ...closerForm, google_calendar_id: e.target.value })} />
          </div>
          <div className="space-y-2 flex items-center gap-3">
            <Switch checked={!!closerForm.google_calendar_enabled} onCheckedChange={(v) => setCloserForm({ ...closerForm, google_calendar_enabled: v })} />
            <Label>Google Calendar habilitado</Label>
          </div>
          {closerForm.meeting_type === 'r2' && (
            <>
              <div className="space-y-2">
                <Label>Prioridade (R2)</Label>
                <Input type="number" value={closerForm.priority ?? ''} onChange={(e) => setCloserForm({ ...closerForm, priority: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Máx. leads por slot</Label>
                <Input type="number" value={closerForm.max_leads_per_slot ?? ''} onChange={(e) => setCloserForm({ ...closerForm, max_leads_per_slot: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </>
          )}
          <div className="md:col-span-2 flex justify-end pt-2">
            <Button
              disabled={updateCloser.isPending}
              onClick={() => updateCloser.mutate({ id: closerForm.id, data: closerForm })}
            >
              {updateCloser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---------- SDR ----------
  if (data.roleSystem === 'sdr') {
    if (!sdrForm) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Registro de SDR não encontrado. Edite e salve o cargo do colaborador para gerar automaticamente.
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Configuração de SDR
            <Badge variant={sdrForm.active ? 'default' : 'secondary'}>
              {sdrForm.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </CardTitle>
          <CardDescription>Configurações operacionais do SDR.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={sdrForm.name || ''} onChange={(e) => setSdrForm({ ...sdrForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={sdrForm.email || ''} onChange={(e) => setSdrForm({ ...sdrForm, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Squad</Label>
            <Input value={sdrForm.squad || ''} onChange={(e) => setSdrForm({ ...sdrForm, squad: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Meta diária</Label>
            <Input type="number" value={sdrForm.meta_diaria ?? ''} onChange={(e) => setSdrForm({ ...sdrForm, meta_diaria: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Nível</Label>
            <Input type="number" value={sdrForm.nivel ?? ''} onChange={(e) => setSdrForm({ ...sdrForm, nivel: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
          <div className="space-y-2 flex items-center gap-3 pt-6">
            <Switch checked={!!sdrForm.active} onCheckedChange={(v) => setSdrForm({ ...sdrForm, active: v })} />
            <Label>Ativo</Label>
          </div>
          <div className="md:col-span-2 flex justify-end pt-2">
            <Button
              disabled={updateSdr.isPending}
              onClick={() => updateSdr.mutate({ id: sdrForm.id, data: sdrForm })}
            >
              {updateSdr.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}