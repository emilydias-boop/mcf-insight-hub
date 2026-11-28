import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useConsorcioResumoCotas, type FiltrosResumoCotas } from '@/hooks/useConsorcioCotasPagamentos';
import { CotaParcelasGrade } from './CotaParcelasGrade';
import { formatCurrency } from '@/lib/consorcioCalculos';

const filtrosIniciais: FiltrosResumoCotas = { busca: '', grupo: '', status: '', quemPaga: '', soAtraso: false, responsavel: '' };
const statusCotas = ['ativo', 'inativo', 'contemplado', 'descontemplado', 'cancelado'];
const dataCurta = (data: string) => data.split('-').reverse().join('/');

export function PorCotaTab() {
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [aplicados, setAplicados] = useState(filtrosIniciais);
  const [pagina, setPagina] = useState(1);
  const [expandida, setExpandida] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => { setAplicados(filtros); setPagina(1); setExpandida(null); }, 300);
    return () => clearTimeout(timer);
  }, [filtros]);
  const resumo = useConsorcioResumoCotas(aplicados, pagina);
  const total = Number(resumo.data?.[0]?.total || 0);
  const paginas = Math.max(1, Math.ceil(total / 50));
  const atualizar = (campo: keyof FiltrosResumoCotas, valor: string | boolean) => setFiltros(f => ({ ...f, [campo]: valor }));
  const mudarPagina = (nova: number) => { setPagina(nova); setExpandida(null); };

  return (
    <div className="space-y-4">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1.5"><Label htmlFor="cotas-busca">Busca</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="cotas-busca" className="pl-9" placeholder="Nome, grupo ou cota" value={filtros.busca} onChange={e => atualizar('busca', e.target.value)} /></div></div>
        <div className="space-y-1.5"><Label htmlFor="cotas-grupo">Grupo</Label><Input id="cotas-grupo" placeholder="Todos os grupos" value={filtros.grupo} onChange={e => atualizar('grupo', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Status da cota</Label><Select value={filtros.status || 'todos'} onValueChange={v => atualizar('status', v === 'todos' ? '' : v)}><SelectTrigger aria-label="Status da cota"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{statusCotas.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Quem paga a próxima</Label><Select value={filtros.quemPaga || 'todos'} onValueChange={v => atualizar('quemPaga', v === 'todos' ? '' : v)}><SelectTrigger aria-label="Quem paga a próxima"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="cliente">Cliente</SelectItem><SelectItem value="empresa">MCF</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="cotas-responsavel">Responsável</Label><Input id="cotas-responsavel" placeholder="Todos os responsáveis" value={filtros.responsavel} onChange={e => atualizar('responsavel', e.target.value)} /></div>
        <div className="flex min-h-10 items-center gap-2"><Checkbox id="cotas-atraso" checked={filtros.soAtraso} onCheckedChange={v => atualizar('soAtraso', v === true)} /><Label htmlFor="cotas-atraso">Só com atraso</Label></div>
      </div>
      {resumo.isError ? <div role="alert" className="flex flex-wrap items-center gap-3 text-destructive">Não foi possível carregar as cotas.<Button variant="outline" onClick={() => resumo.refetch()}>Tentar novamente</Button></div> : (
        <Table>
          <TableHeader><TableRow><TableHead className="w-12" /><TableHead>Cliente</TableHead><TableHead>Grupo / cota</TableHead><TableHead>Status</TableHead><TableHead>Responsável</TableHead><TableHead>Última paga</TableHead><TableHead>Vencidas</TableHead><TableHead>Próxima parcela</TableHead><TableHead>Quem paga</TableHead></TableRow></TableHeader>
          <TableBody>
            {resumo.isLoading ? Array.from({ length: 8 }, (_, i) => <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : (resumo.data || []).map(cota => (
              <Fragment key={cota.card_id}>
                <TableRow>
                  <TableCell><Button variant="ghost" size="icon" aria-label={`Parcelas de ${cota.cliente}`} title="Ver parcelas" aria-expanded={expandida === cota.card_id} disabled={resumo.isFetching} onClick={() => setExpandida(v => v === cota.card_id ? null : cota.card_id)}>{expandida === cota.card_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></TableCell>
                  <TableCell className="min-w-44 max-w-72 whitespace-normal font-medium">{cota.cliente}</TableCell><TableCell className="whitespace-nowrap">{cota.grupo} / {cota.cota}</TableCell><TableCell><Badge variant="secondary">{cota.status_cota}</Badge></TableCell><TableCell className="min-w-36 whitespace-normal">{cota.responsavel || '—'}</TableCell><TableCell>{cota.ultima_paga ? `#${cota.ultima_paga}` : 'Nenhuma'}</TableCell>
                  <TableCell className={Number(cota.vencidas_qtd) > 0 ? 'text-destructive' : ''}><span className="whitespace-nowrap">{cota.vencidas_qtd} · {formatCurrency(Number(cota.vencidas_valor))}</span></TableCell>
                  <TableCell className="min-w-40">{cota.proxima_numero ? <div>#{cota.proxima_numero} · {cota.proxima_vencimento ? dataCurta(cota.proxima_vencimento) : '—'}<div className="text-muted-foreground">{formatCurrency(Number(cota.proxima_valor))}</div></div> : '—'}</TableCell>
                  <TableCell>{cota.proxima_quem_paga ? <Badge variant={cota.proxima_quem_paga === 'empresa' ? 'default' : 'outline'}>{cota.proxima_quem_paga === 'empresa' ? 'MCF' : 'Cliente'}</Badge> : '—'}</TableCell>
                </TableRow>
                {expandida === cota.card_id && <TableRow><TableCell colSpan={9}><CotaParcelasGrade cota={cota} /></TableCell></TableRow>}
              </Fragment>
            ))}
            {!resumo.isLoading && !resumo.data?.length && <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Nenhuma cota encontrada.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{total} cotas · 50 por página {resumo.isFetching && '· Atualizando…'}</span>
        <div className="flex items-center gap-3"><Button variant="outline" size="icon" title="Página anterior" aria-label="Página anterior" disabled={pagina <= 1 || resumo.isFetching} onClick={() => mudarPagina(pagina - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Página {pagina} de {paginas}</span><Button variant="outline" size="icon" title="Próxima página" aria-label="Próxima página" disabled={pagina >= paginas || resumo.isFetching} onClick={() => mudarPagina(pagina + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
      </div>
    </div>
  );
}