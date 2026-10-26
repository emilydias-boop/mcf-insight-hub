import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { DataHoraPopover } from './DataHoraPopover';
import { useRegistrarContato } from './useRegistrarContato';
import { presets, RESULTADOS, rotuloCurto, rotuloLongo, rotuloToast, TIPO_LABEL, podeRegistrar, type ProximaTipo, type ResultadoContato } from './registrarContato';

export function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick}
      className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-accent')}>
      {children}
    </button>
  );
}

type Proxima = 'hoje' | 'amanha' | '3dias' | 'custom' | 'nenhum' | null;
const TIPOS: ProximaTipo[] = ['ligar', 'whatsapp', 'reuniao'];

interface Props {
  dealId: string;
  isNoShow?: boolean;
  onRegistrado?: (comResultado: boolean) => void;
}

export function RegistrarContatoFooter({ dealId, isNoShow, onRegistrado }: Props) {
  const [resultado, setResultado] = useState<ResultadoContato | null>(null);
  const [nota, setNota] = useState('');
  const [proxima, setProxima] = useState<Proxima>(null);
  const [customIso, setCustomIso] = useState<string | null>(null);
  const [tipo, setTipo] = useState<ProximaTipo>(isNoShow ? 'reuniao' : 'ligar');
  const [popOpen, setPopOpen] = useState(false);
  const mut = useRegistrarContato();
  // Recalcula a cada render relevante (o rótulo "Hoje" depende do horário atual).
  const opcoes = useMemo(() => presets(new Date()), [proxima, popOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const proximaEm = proxima === 'custom' ? customIso : opcoes.find(o => o.key === proxima)?.iso ?? null;
  const habilitado = podeRegistrar(resultado, proximaEm) && !mut.isPending;

  const limpar = () => { setResultado(null); setNota(''); setProxima(null); setCustomIso(null); setTipo(isNoShow ? 'reuniao' : 'ligar'); };

  const registrar = () => {
    if (!habilitado) return;
    mut.mutate({ dealId, resultado, nota: nota.trim() || null, proximaTipo: proximaEm ? tipo : null, proximaEm }, {
      onSuccess: () => {
        if (resultado && proximaEm) toast.success('Contato registrado e retorno agendado');
        else if (proximaEm) toast.success(`Retorno agendado para ${rotuloToast(proximaEm)}`);
        else toast.success('Contato registrado');
        const comResultado = !!resultado;
        limpar();
        onRegistrado?.(comResultado);
      },
      onError: (e: unknown) => toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message || 'Erro ao registrar contato'),
    });
  };

  return (
    <div className="shrink-0 border-t border-border bg-muted/50 px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Registrar contato</span>
        {RESULTADOS.map(r => (
          <Chip key={r.value} active={resultado === r.value} onClick={() => setResultado(resultado === r.value ? null : r.value)}>{r.label}</Chip>
        ))}
      </div>
      <Textarea
        rows={2}
        value={nota}
        onChange={e => setNota(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); registrar(); } }}
        placeholder="O que foi falado? (opcional)"
        className="min-h-0 resize-none bg-background text-sm"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Próxima ação</span>
        {opcoes.map(o => (
          <Chip key={o.key} active={proxima === o.key} onClick={() => setProxima(proxima === o.key ? null : o.key)}>{o.label}</Chip>
        ))}
        <DataHoraPopover open={popOpen} onOpenChange={setPopOpen} onConfirm={iso => { setCustomIso(iso); setProxima('custom'); }}>
          <button type="button" aria-pressed={proxima === 'custom'}
            className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors',
              proxima === 'custom' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-accent')}>
            {proxima === 'custom' && customIso ? rotuloCurto(customIso) : 'Personalizado…'}
          </button>
        </DataHoraPopover>
        <Chip active={proxima === 'nenhum'} onClick={() => setProxima(proxima === 'nenhum' ? null : 'nenhum')}>Sem retorno</Chip>
        <Button size="sm" className="ml-auto" disabled={!habilitado} onClick={registrar}>
          {mut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Registrar
        </Button>
      </div>
      {proximaEm && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Como</span>
          {TIPOS.map(t => <Chip key={t} active={tipo === t} onClick={() => setTipo(t)}>{TIPO_LABEL[t]}</Chip>)}
          <span className="text-xs text-muted-foreground">{`${TIPO_LABEL[tipo]} ${rotuloLongo(proximaEm)}`}</span>
        </div>
      )}
    </div>
  );
}
