import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { OrgCardData } from './OrgNodes';

type Props = {
  raizes: string[];
  filhos: Map<string, string[]>;
  dados: Map<string, OrgCardData>;
  onAbrir: (id: string) => void;
};

/** Visão em lista: árvore recolhível com a mesma hierarquia do fluxograma. */
export function OrgLista({ raizes, filhos, dados, onAbrir }: Props) {
  if (!raizes.length) return <p className="p-6 text-center text-sm text-muted-foreground">Nada para mostrar com os filtros atuais.</p>;
  return <ul className="space-y-1">{raizes.map((id) => <Item key={id} id={id} filhos={filhos} dados={dados} onAbrir={onAbrir} nivel={0} />)}</ul>;
}

function Item({ id, filhos, dados, onAbrir, nivel }: Omit<Props, 'raizes'> & { id: string; nivel: number }) {
  const [aberto, setAberto] = useState(nivel < 1);
  const d = dados.get(id);
  if (!d) return null;
  const f = (filhos.get(id) ?? []).filter((x) => dados.has(x));
  return (
    <li>
      <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-2" style={{ marginLeft: nivel * 14, borderLeft: `4px solid hsl(var(--org-${d.cor}))` }}>
        {f.length ? (
          <button type="button" onClick={() => setAberto(!aberto)} className="rounded p-0.5 hover:bg-accent" aria-label={aberto ? 'Recolher' : 'Expandir'}>
            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : <span className="w-5" />}
        <button type="button" onClick={() => onAbrir(id)} className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-medium">{d.titulo}</div>
          {d.subtitulo && <div className="truncate text-xs text-muted-foreground">{d.subtitulo}</div>}
        </button>
        {d.badges?.filter((b) => b.tipo !== 'setor').map((b, i) => <Badge key={i} variant={b.tipo === 'vago' ? 'outline' : 'secondary'} className="text-[10px]">{b.texto}</Badge>)}
        {f.length > 0 && <span className="text-xs text-muted-foreground">{f.length}</span>}
      </div>
      {aberto && f.length > 0 && <ul className="mt-1 space-y-1">{f.map((x) => <Item key={x} id={x} filhos={filhos} dados={dados} onAbrir={onAbrir} nivel={nivel + 1} />)}</ul>}
    </li>
  );
}
