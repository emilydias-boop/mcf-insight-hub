import { Badge } from '@/components/ui/badge';
import { useContatosAlternativos } from '@/hooks/useContatosAlternativos';

const origemLabel = (origem: string | null) =>
  origem && (origem.startsWith('venda_vinculada') || origem.startsWith('backfill_venda_vinculada'))
    ? 'Comprador da venda'
    : 'Manual';

export function OutrosContatosLead({ contactId }: { contactId?: string }) {
  const { data: aliases = [] } = useContatosAlternativos(contactId);
  if (!aliases.length) return null;

  return (
    <div className="rounded-lg border border-dashed p-2 space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Outros contatos deste lead
      </div>
      {aliases.map((a) => (
        <div key={a.id} className="text-xs text-muted-foreground leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="truncate">{a.nome || '—'}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal text-muted-foreground">
              {origemLabel(a.origem)}
            </Badge>
          </div>
          {a.email && <div className="truncate">{a.email}</div>}
          {a.telefone && <div className="truncate">{a.telefone}</div>}
        </div>
      ))}
    </div>
  );
}
