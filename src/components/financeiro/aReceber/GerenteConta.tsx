import { useQuery } from '@tanstack/react-query';
import { Mail, MessageCircle, Phone, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface GerenteConta {
  titulo_id: string;
  gerente_nome: string | null;
  gerente_email: string | null;
  gerente_telefone: string | null;
  area: string | null;
  recebido_em: string | null;
}

const AREA_LABEL: Record<string, string> = {
  solar: 'MCF Solar',
  consorcio: 'Consórcio',
  incorporador: 'Incorporador',
};

/** Mapa titulo_id → gerente de contas (leitura dos encaminhamentos do app externo). */
export function useGerentesConta(tituloId?: string) {
  return useQuery({
    queryKey: ['ar-gerente-conta', tituloId ?? 'todos'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('ar_gerente_conta_por_titulo', {
        p_titulo_id: tituloId ?? null,
      });
      if (error) throw error;
      const map = new Map<string, GerenteConta>();
      for (const r of (data ?? []) as GerenteConta[]) map.set(r.titulo_id, r);
      return map;
    },
  });
}

export function GerenteContaInfo({ gerente, compact = false }: { gerente?: GerenteConta; compact?: boolean }) {
  if (!gerente?.gerente_nome) {
    return <span className="text-xs text-muted-foreground">Sem gerente vinculado</span>;
  }
  const fone = (gerente.gerente_telefone ?? '').replace(/\D/g, '');
  const wa = fone ? (fone.length <= 11 ? `55${fone}` : fone) : '';
  return (
    <div className={compact ? 'space-y-0.5 text-xs' : 'space-y-1 text-sm'}>
      <div className="flex items-center gap-1 font-medium">
        <UserCog className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{gerente.gerente_nome}</span>
      </div>
      {gerente.area && (
        <div className="text-[11px] text-muted-foreground">
          Fila: {AREA_LABEL[gerente.area] ?? gerente.area}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {gerente.gerente_email && (
          <a href={`mailto:${gerente.gerente_email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-foreground">
            <Mail className="w-3 h-3" />{!compact && gerente.gerente_email}
          </a>
        )}
        {fone && (
          <>
            <a href={`tel:${fone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-foreground">
              <Phone className="w-3 h-3" />{!compact && gerente.gerente_telefone}
            </a>
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 hover:text-foreground">
              <MessageCircle className="w-3 h-3" />{!compact && 'WhatsApp'}
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export function GerenteContaFilter({
  value, onChange, gerentes,
}: { value: string; onChange: (v: string) => void; gerentes?: Map<string, GerenteConta> }) {
  const nomes = Array.from(new Set(Array.from(gerentes?.values() ?? []).map(g => g.gerente_nome).filter(Boolean) as string[])).sort();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Gerente de contas" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os gerentes</SelectItem>
        <SelectItem value="none">Sem gerente vinculado</SelectItem>
        {nomes.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
