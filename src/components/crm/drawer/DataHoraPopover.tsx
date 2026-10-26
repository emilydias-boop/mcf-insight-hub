import { useState, type ReactNode } from 'react';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addDaysYmd, capitalizar, rotuloLongo, spIso, spParts } from './registrarContato';

const HORARIOS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (iso: string) => void;
  children: ReactNode;
}

/** Escolha de dia + horário em São Paulo; devolve ISO com -03:00. */
export function DataHoraPopover({ open, onOpenChange, onConfirm, children }: Props) {
  const [dia, setDia] = useState<Date | undefined>();
  const [hora, setHora] = useState('');
  const agora = spParts(new Date());
  const hojeYmd = agora.ymd;
  const maxYmd = addDaysYmd(hojeYmd, 90);
  const diaYmd = dia ? ymdLocal(dia) : null;
  const ehHoje = diaYmd === hojeYmd;
  const passou = (hm: string) => ehHoje && Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) <= agora.minutes;
  const iso = diaYmd && /^\d{2}:\d{2}$/.test(hora) ? spIso(diaYmd, hora) : null;
  const valido = !!iso && new Date(iso).getTime() > Date.now();

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-[340px] p-3" aria-label="Escolher data e horário do retorno">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={dia}
          onSelect={setDia}
          disabled={(d) => { const y = ymdLocal(d); return y < hojeYmd || y > maxYmd; }}
          className="p-0 pointer-events-auto"
        />
        <p className="mt-2 text-xs font-medium text-muted-foreground">Horário</p>
        <div className="mt-1 grid grid-cols-5 gap-1">
          {HORARIOS.map(h => (
            <button key={h} type="button" aria-pressed={hora === h} disabled={passou(h)} onClick={() => setHora(h)}
              className={cn('rounded-md border px-1 py-1 text-xs tabular-nums disabled:opacity-40',
                hora === h ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent')}>
              {h}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          Outro horário
          <Input type="time" step={900} value={hora} onChange={e => setHora(e.target.value)} className="h-8 w-28" />
        </label>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
          <span className="text-xs text-muted-foreground">{iso ? capitalizar(rotuloLongo(iso)) : 'Escolha dia e horário'}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" disabled={!valido} onClick={() => { if (iso) { onConfirm(iso); onOpenChange(false); } }}>Confirmar</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
