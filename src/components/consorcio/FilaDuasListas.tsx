import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TablePagination } from '@/components/ui/table-pagination';
import { cn } from '@/lib/utils';

/**
 * Fila de duas listas usada nas etapas 1, 2 e 4 do funil Consórcio.
 *
 * Padrão único (uma implementação, três usos):
 *  - PENDENTES vem primeiro: é o trabalho. Aberta por padrão e ordenada do mais
 *    parado para o mais recente (a fila se auto-prioriza).
 *  - TRATADAS vem depois, recolhida por padrão.
 *  - cada seção tem sua própria contagem no título e sua própria paginação.
 *
 * A tabela em si é responsabilidade de quem chama (`renderTabela`), para não
 * duplicar colunas/ações de cada etapa.
 */
export function FilaDuasListas<T>({
  pendentes,
  tratadas,
  renderTabela,
  tituloPendentes,
  tituloTratadas,
  descricaoPendentes,
  vazioPendentes = 'Nada pendente por aqui.',
  vazioTratadas = 'Nenhum item tratado no período.',
  secaoIntermediaria,
}: {
  pendentes: T[];
  tratadas: T[];
  renderTabela: (linhas: T[]) => ReactNode;
  tituloPendentes: string;
  tituloTratadas: string;
  descricaoPendentes?: string;
  vazioPendentes?: string;
  vazioTratadas?: string;
  /**
   * Seção OPCIONAL entre pendentes e tratadas, recolhida por padrão: itens que
   * ainda não são demanda da equipe (ex.: etapa 4 — venda esperando assinatura
   * do termo). Fica visível na tela para nada "desaparecer", mas fora do bloco
   * de trabalho e fora da contagem do funil.
   */
  secaoIntermediaria?: {
    titulo: string;
    descricao?: string;
    linhas: T[];
    vazio?: string;
    renderTabela?: (linhas: T[]) => ReactNode;
  };
}) {
  return (
    <div className="space-y-4">
      <Secao
        titulo={tituloPendentes}
        descricao={descricaoPendentes}
        linhas={pendentes}
        renderTabela={renderTabela}
        vazio={vazioPendentes}
        abertaInicialmente
        destaque
      />
      {secaoIntermediaria && secaoIntermediaria.linhas.length > 0 && (
        <Secao
          titulo={secaoIntermediaria.titulo}
          descricao={secaoIntermediaria.descricao}
          linhas={secaoIntermediaria.linhas}
          renderTabela={secaoIntermediaria.renderTabela || renderTabela}
          vazio={secaoIntermediaria.vazio || 'Nada aqui.'}
          abertaInicialmente={false}
        />
      )}
      <Secao
        titulo={tituloTratadas}
        linhas={tratadas}
        renderTabela={renderTabela}
        vazio={vazioTratadas}
        abertaInicialmente={false}
      />
    </div>
  );
}


function Secao<T>({
  titulo,
  descricao,
  linhas,
  renderTabela,
  vazio,
  abertaInicialmente,
  destaque = false,
}: {
  titulo: string;
  descricao?: string;
  linhas: T[];
  renderTabela: (linhas: T[]) => ReactNode;
  vazio: string;
  abertaInicialmente: boolean;
  destaque?: boolean;
}) {
  const [aberta, setAberta] = useState(abertaInicialmente);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => { setPage(0); }, [linhas.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(linhas.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = useMemo(
    () => linhas.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [linhas, safePage, pageSize],
  );

  return (
    <div className={cn('rounded-lg border', destaque ? 'border-amber-500/30 bg-amber-500/[0.03]' : 'border-border')}>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {aberta ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">{titulo}</span>
        <Badge
          variant="outline"
          className={cn(
            'tabular-nums text-[11px]',
            destaque && linhas.length > 0 && 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400',
          )}
        >
          {linhas.length}
        </Badge>
        {descricao && (
          <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">{descricao}</span>
        )}
      </button>

      {aberta && (
        <div className="px-3 pb-3">
          {linhas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>
          ) : (
            <>
              <div className="overflow-x-auto">{renderTabela(pageRows)}</div>
              <TablePagination
                page={safePage}
                pageSize={pageSize}
                total={linhas.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
