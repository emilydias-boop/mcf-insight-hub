import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search } from 'lucide-react';
import { useGruposSaude, GrupoSaudeItem } from '@/hooks/useGruposSaude';
import { GrupoCard } from './GrupoCard';
import { GrupoDetailDrawer } from './GrupoDetailDrawer';

type SortKey = 'cotas' | 'saude' | 'ultima';

const statusOrder: Record<GrupoSaudeItem['status'], number> = { verde: 0, amarelo: 1, cinza: 2 };

export function GruposTab() {
  const { data: grupos = [], isLoading } = useGruposSaude();
  const [busca, setBusca] = useState('');
  const [sort, setSort] = useState<SortKey>('cotas');
  const [selecionado, setSelecionado] = useState<GrupoSaudeItem | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let arr = grupos.filter((g) => !q || g.grupo.toLowerCase().includes(q));
    arr = [...arr].sort((a, b) => {
      if (sort === 'cotas') return b.qtd_cotas - a.qtd_cotas;
      if (sort === 'saude') return statusOrder[a.status] - statusOrder[b.status];
      return (b.ultima_assembleia || '').localeCompare(a.ultima_assembleia || '');
    });
    return arr;
  }, [grupos, busca, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cotas">Mais cotas</SelectItem>
            <SelectItem value="saude">Mais saudáveis</SelectItem>
            <SelectItem value="ultima">Última assembleia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum grupo encontrado.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtrados.map((g) => (
            <GrupoCard key={g.grupo} item={g} onClick={() => setSelecionado(g)} />
          ))}
        </div>
      )}

      <GrupoDetailDrawer
        item={selecionado}
        open={!!selecionado}
        onOpenChange={(o) => !o && setSelecionado(null)}
      />
    </div>
  );
}