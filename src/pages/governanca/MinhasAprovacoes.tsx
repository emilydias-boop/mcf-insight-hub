import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMinhasAprovacoes, type Pendencia } from '@/hooks/useMinhasAprovacoes';
import { DecisaoDialog } from '@/components/governanca/AssinaturaTrilha';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');

export default function MinhasAprovacoes() {
  const q = useMinhasAprovacoes();
  const [sel, setSel] = useState<Pendencia | null>(null);
  const agora = Date.now();
  return <div className="space-y-6 p-6">
    <div><h1 className="text-2xl font-bold">Minhas aprovações</h1><p className="text-muted-foreground">Pedidos que aguardam a sua assinatura, na ordem do fluxo.</p></div>
    {q.isLoading ? <Skeleton className="h-40 w-full" /> : q.error ? <p className="text-destructive">Não foi possível carregar as aprovações.</p> :
      <Table><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Tipo</TableHead><TableHead>Seu papel</TableHead><TableHead>Enviado em</TableHead><TableHead>Prazo</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>{(q.data ?? []).map(p => <TableRow key={p.etapa_id}>
          <TableCell className="font-medium">{p.titulo || 'Sem título'}</TableCell>
          <TableCell>{p.doc_tipo === 'requisicao' ? 'Contratação' : 'Desligamento'}</TableCell>
          <TableCell>{p.papel}</TableCell><TableCell>{fmt(p.enviado_em)}</TableCell>
          <TableCell>{p.prazo && new Date(p.prazo).getTime() < agora ? <Badge variant="destructive">Atrasado</Badge> : fmt(p.prazo)}</TableCell>
          <TableCell className="space-x-2 text-right"><Button variant="outline" size="sm" asChild><Link to={`/governanca/verificacao/${p.doc_tipo}/${p.doc_id}`}>Ver documento</Link></Button><Button size="sm" onClick={() => setSel(p)}>Decidir</Button></TableCell>
        </TableRow>)}{!q.data?.length && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">Nenhuma aprovação pendente</TableCell></TableRow>}</TableBody></Table>}
    <DecisaoDialog etapa={sel ? { id: sel.etapa_id, papel: sel.papel } : null} hash={sel?.hash ?? ''} onClose={() => setSel(null)} onDone={() => { setSel(null); void q.refetch(); }} />
  </div>;
}
