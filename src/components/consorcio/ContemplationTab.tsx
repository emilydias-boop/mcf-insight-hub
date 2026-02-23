import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, Eye, Target, Dices } from 'lucide-react';
import { useContemplationCards, type ContemplationFilters } from '@/hooks/useContemplacao';
import { useConsorcioEmployees } from '@/hooks/useEmployees';
import { useConsorcioTipoOptions } from '@/hooks/useConsorcioConfigOptions';
import { ConsorcioCard } from '@/types/consorcio';
import { VerificarSorteioModal } from './VerificarSorteioModal';
import { LanceModal } from './LanceModal';
import { ContemplationDetailsDrawer } from './ContemplationDetailsDrawer';

function getContemplationBadge(card: ConsorcioCard) {
  if (!card.motivo_contemplacao) {
    return <Badge variant="outline" className="text-xs">Não contemplada</Badge>;
  }
  if (card.motivo_contemplacao === 'sorteio') {
    return <Badge className="bg-green-600 text-xs">Sorteio</Badge>;
  }
  if (card.motivo_contemplacao === 'lance' || card.motivo_contemplacao === 'lance_fixo') {
    return <Badge className="bg-blue-600 text-xs">Lance</Badge>;
  }
  return <Badge className="bg-purple-600 text-xs">{card.motivo_contemplacao}</Badge>;
}

export function ContemplationTab() {
  const [search, setSearch] = useState('');
  const [grupo, setGrupo] = useState('todos');
  const [statusContemplacao, setStatusContemplacao] = useState('todos');
  const [tipoProduto, setTipoProduto] = useState('todos');
  const [vendedor, setVendedor] = useState('todos');

  const [selectedCard, setSelectedCard] = useState<ConsorcioCard | null>(null);
  const [sorteioOpen, setSorteioOpen] = useState(false);
  const [lanceOpen, setLanceOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filters: ContemplationFilters = {
    search: search || undefined,
    grupo: grupo !== 'todos' ? grupo : undefined,
    status: statusContemplacao !== 'todos' ? statusContemplacao : undefined,
    tipoProduto: tipoProduto !== 'todos' ? tipoProduto : undefined,
    vendedorId: vendedor !== 'todos' ? vendedor : undefined,
  };

  const { data: cards, isLoading } = useContemplationCards(filters);
  const { data: employees } = useConsorcioEmployees();
  const { data: tipoOptions = [] } = useConsorcioTipoOptions();

  const uniqueGrupos = useMemo(() => {
    if (!cards) return [];
    return [...new Set(cards.map(c => c.grupo))].sort((a, b) => Number(a) - Number(b));
  }, [cards]);

  const openSorteio = (card: ConsorcioCard) => { setSelectedCard(card); setSorteioOpen(true); };
  const openLance = (card: ConsorcioCard) => { setSelectedCard(card); setLanceOpen(true); };
  const openDetails = (card: ConsorcioCard) => { setSelectedCard(card); setDetailsOpen(true); };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome, CPF, CNPJ, cota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>

        <Filter className="h-4 w-4 text-muted-foreground" />

        <Select value={grupo} onValueChange={setGrupo}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Grupo</SelectItem>
            {uniqueGrupos.map(g => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusContemplacao} onValueChange={setStatusContemplacao}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Contemplação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="nao_contemplado">Não contemplada</SelectItem>
            <SelectItem value="contemplado">Contemplada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tipoProduto} onValueChange={setTipoProduto}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Tipo</SelectItem>
            {tipoOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.name}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vendedor} onValueChange={setVendedor}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Vendedor</SelectItem>
            {employees?.map(emp => (
              <SelectItem key={emp.id} value={emp.id}>{emp.nome_completo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão Social</TableHead>
                <TableHead>CPF / CNPJ</TableHead>
                <TableHead className="text-center">Grupo</TableHead>
                <TableHead className="text-center">Cota</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status Cota</TableHead>
                <TableHead>Contemplação</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : cards && cards.length > 0 ? (
                cards.map(card => {
                  const displayName = card.tipo_pessoa === 'pf' ? card.nome_completo : card.razao_social;
                  const doc = card.tipo_pessoa === 'pf' ? card.cpf : card.cnpj;
                  return (
                    <TableRow key={card.id}>
                      <TableCell className="font-medium">{displayName || '-'}</TableCell>
                      <TableCell className="text-xs font-mono">{doc || '-'}</TableCell>
                      <TableCell className="text-center">{card.grupo}</TableCell>
                      <TableCell className="text-center font-medium">{card.cota}</TableCell>
                      <TableCell className="text-right">
                        R$ {Number(card.valor_credito).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{card.tipo_produto}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{card.status}</Badge>
                      </TableCell>
                      <TableCell>{getContemplationBadge(card)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => openDetails(card)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Verificar sorteio" onClick={() => openSorteio(card)}>
                            <Dices className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Simular lance" onClick={() => openLance(card)}>
                            <Target className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    Nenhuma cota encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <VerificarSorteioModal open={sorteioOpen} onOpenChange={setSorteioOpen} card={selectedCard} />
      <LanceModal open={lanceOpen} onOpenChange={setLanceOpen} card={selectedCard} />
      <ContemplationDetailsDrawer open={detailsOpen} onOpenChange={setDetailsOpen} card={selectedCard} />
    </div>
  );
}
