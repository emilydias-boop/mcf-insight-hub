import { useState, useMemo, useCallback } from 'react';
import { Upload, FileSpreadsheet, Search, Users, UserCheck, UserX, Download, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  useInsideSalesDeals,
  useActiveSdrs,
  useProfilesByEmail,
  compareExcelWithLocal,
  useAssignLimboOwner,
  LimboRow,
} from '@/hooks/useLimboLeads';
import { CLOSER_LIST } from '@/constants/team';

type Step = 'upload' | 'mapping' | 'results';
type StatusFilter = 'todos' | 'com_dono' | 'sem_dono' | 'nao_encontrado';

const COLUMN_KEYS = ['name', 'email', 'phone', 'stage', 'value', 'owner'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Nome',
  email: 'Email',
  phone: 'Telefone',
  stage: 'Estágio',
  value: 'Valor',
  owner: 'Dono',
};

// Auto-map com heurísticas
const AUTO_MAP_HINTS: Record<ColumnKey, string[]> = {
  name: ['nome', 'name', 'lead', 'contato', 'contact'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['telefone', 'phone', 'celular', 'tel', 'whatsapp'],
  stage: ['estagio', 'estágio', 'stage', 'etapa', 'status', 'fase'],
  value: ['valor', 'value', 'amount', 'receita'],
  owner: ['dono', 'owner', 'responsavel', 'responsável', 'sdr', 'user'],
};

function autoMapColumns(headers: string[]): Record<ColumnKey, string> {
  const mapping: Record<ColumnKey, string> = { name: '', email: '', phone: '', stage: '', value: '', owner: '' };
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  for (const key of COLUMN_KEYS) {
    const hints = AUTO_MAP_HINTS[key];
    const idx = normalizedHeaders.findIndex(h => hints.some(hint => h.includes(hint)));
    if (idx >= 0) mapping[key] = headers[idx];
  }
  return mapping;
}

const PAGE_SIZE = 50;

export default function LeadsLimbo() {
  const [step, setStep] = useState<Step>('upload');
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ColumnKey, string>>({ name: '', email: '', phone: '', stage: '', value: '', owner: '' });
  const [results, setResults] = useState<LimboRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [assignSdrEmail, setAssignSdrEmail] = useState('');
  const [page, setPage] = useState(0);
  const [isComparing, setIsComparing] = useState(false);

  const { data: localDeals, isLoading: loadingDeals } = useInsideSalesDeals();
  const { data: sdrs } = useActiveSdrs();
  const { data: profiles } = useProfilesByEmail();
  const assignMutation = useAssignLimboOwner();

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) {
          toast.error('Planilha vazia');
          return;
        }
        const hdrs = Object.keys(json[0] as any);
        setHeaders(hdrs);
        setRawData(json as any[]);
        setColumnMapping(autoMapColumns(hdrs));
        setStep('mapping');
        toast.success(`${json.length} linhas carregadas`);
      } catch {
        toast.error('Erro ao ler o arquivo');
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  // Run comparison
  const runComparison = useCallback(() => {
    if (!localDeals) {
      toast.error('Aguarde o carregamento dos deals locais');
      return;
    }
    setIsComparing(true);

    // Parse excel rows using mapping
    const excelRows = rawData.map((row) => ({
      name: String(row[columnMapping.name] || ''),
      email: String(row[columnMapping.email] || ''),
      phone: String(row[columnMapping.phone] || ''),
      stage: String(row[columnMapping.stage] || ''),
      value: columnMapping.value ? parseFloat(String(row[columnMapping.value]).replace(/[^\d.,]/g, '').replace(',', '.')) || null : null,
      owner: String(row[columnMapping.owner] || ''),
    }));

    const compared = compareExcelWithLocal(excelRows, localDeals);
    setResults(compared);
    setStep('results');
    setPage(0);
    setSelectedIds(new Set());
    setIsComparing(false);
  }, [rawData, columnMapping, localDeals]);

  // Filtered results
  const filtered = useMemo(() => {
    let items = results;
    if (statusFilter !== 'todos') items = items.filter(r => r.status === statusFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(r =>
        r.excelName.toLowerCase().includes(term) ||
        r.excelEmail.toLowerCase().includes(term) ||
        (r.localContactName || '').toLowerCase().includes(term)
      );
    }
    return items;
  }, [results, statusFilter, searchTerm]);

  // Counts
  const counts = useMemo(() => ({
    total: results.length,
    com_dono: results.filter(r => r.status === 'com_dono').length,
    sem_dono: results.filter(r => r.status === 'sem_dono').length,
    nao_encontrado: results.filter(r => r.status === 'nao_encontrado').length,
  }), [results]);

  // Pagination
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Toggle selection
  const toggleSelect = (idx: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.filter(r => r.status === 'sem_dono').length) {
      setSelectedIds(new Set());
    } else {
      const ids = new Set<number>();
      filtered.forEach((r, i) => { if (r.status === 'sem_dono' && r.localDealId) ids.add(i); });
      setSelectedIds(ids);
    }
  };

  // Assign selected leads
  const handleBulkAssign = () => {
    if (!assignSdrEmail) {
      toast.error('Selecione um SDR');
      return;
    }
    const profile = profiles?.find(p => p.email === assignSdrEmail);
    if (!profile) {
      toast.error('Perfil do SDR não encontrado');
      return;
    }
    const dealIds = Array.from(selectedIds)
      .map(i => filtered[i]?.localDealId)
      .filter(Boolean) as string[];

    if (!dealIds.length) {
      toast.error('Nenhum deal selecionável');
      return;
    }

    assignMutation.mutate(
      { dealIds, ownerEmail: assignSdrEmail, ownerProfileId: profile.id },
      {
        onSuccess: () => {
          // Remove assigned from results
          setResults(prev =>
            prev.map(r => dealIds.includes(r.localDealId || '') ? { ...r, status: 'com_dono' as const, localOwner: assignSdrEmail } : r)
          );
          setSelectedIds(new Set());
          setAssignSdrEmail('');
        },
      }
    );
  };

  // Export não encontrados
  const exportNotFound = () => {
    const nf = results.filter(r => r.status === 'nao_encontrado');
    if (!nf.length) return;
    const wsData = nf.map(r => ({
      Nome: r.excelName,
      Email: r.excelEmail,
      Telefone: r.excelPhone,
      Estágio: r.excelStage,
      Valor: r.excelValue,
      Dono: r.excelOwner,
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Não Encontrados');
    XLSX.writeFile(wb, 'leads_nao_encontrados.xlsx');
    toast.success(`${nf.length} leads exportados`);
  };

  // ─── RENDER ────────────────────────────────────────────

  // Step: Upload
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Leads em Limbo</h2>
          <p className="text-muted-foreground mt-1">Upload da planilha exportada do Clint (Pipeline Inside Sales) para comparar com a base local</p>
        </div>

        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Arraste ou selecione o arquivo .xlsx</p>
              <p className="text-sm text-muted-foreground mt-1">Exportado do Clint → Pipeline Inside Sales</p>
            </div>
            <label>
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <Button asChild variant="default">
                <span><FileSpreadsheet className="h-4 w-4 mr-2" /> Selecionar Arquivo</span>
              </Button>
            </label>
          </CardContent>
        </Card>

        {loadingDeals && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Skeleton className="h-4 w-4 rounded-full" />
            Carregando deals locais para comparação...
          </div>
        )}
        {localDeals && (
          <p className="text-sm text-muted-foreground">
            ✓ {localDeals.length.toLocaleString()} deals da Pipeline Inside Sales carregados para comparação
          </p>
        )}
      </div>
    );
  }

  // Step: Mapping
  if (step === 'mapping') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Mapeamento de Colunas</h2>
          <p className="text-muted-foreground mt-1">{rawData.length} linhas carregadas. Confirme o mapeamento das colunas.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {COLUMN_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-4">
                <span className="w-24 text-sm font-medium text-foreground">{COLUMN_LABELS[key]}</span>
                <Select
                  value={columnMapping[key]}
                  onValueChange={(val) => setColumnMapping(prev => ({ ...prev, [key]: val }))}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Selecionar coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Não mapear —</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
          <Button
            onClick={runComparison}
            disabled={!columnMapping.name || isComparing || loadingDeals}
          >
            {isComparing ? 'Comparando...' : 'Comparar com Base Local'}
          </Button>
        </div>

        {/* Preview */}
        {rawData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Preview (5 primeiras linhas)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.slice(0, 8).map(h => <TableHead key={h}>{h}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rawData.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {headers.slice(0, 8).map(h => (
                          <TableCell key={h} className="max-w-[200px] truncate text-xs">{String(row[h] || '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Step: Results
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Resultados da Comparação</h2>
          <p className="text-muted-foreground text-sm mt-1">Pipeline Inside Sales — {results.length} leads analisados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportNotFound} disabled={counts.nao_encontrado === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar Não Encontrados ({counts.nao_encontrado})
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setStep('upload'); setResults([]); }}>
            Nova Comparação
          </Button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter('todos')}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Inbox className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold text-foreground">{counts.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter('com_dono')}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{counts.com_dono}</p>
              <p className="text-xs text-muted-foreground">Com Dono</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter('sem_dono')}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">{counts.sem_dono}</p>
              <p className="text-xs text-muted-foreground">Sem Dono</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStatusFilter('nao_encontrado')}>
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <UserX className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-foreground">{counts.nao_encontrado}</p>
              <p className="text-xs text-muted-foreground">Não Encontrado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Bulk assign bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(0); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos ({counts.total})</SelectItem>
            <SelectItem value="com_dono">Com Dono ({counts.com_dono})</SelectItem>
            <SelectItem value="sem_dono">Sem Dono ({counts.sem_dono})</SelectItem>
            <SelectItem value="nao_encontrado">Não Encontrado ({counts.nao_encontrado})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk assign */}
      {selectedIds.size > 0 && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">{selectedIds.size} leads selecionados</span>
            <Select value={assignSdrEmail} onValueChange={setAssignSdrEmail}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecionar SDR" />
              </SelectTrigger>
              <SelectContent>
                {sdrs?.map(s => (
                  <SelectItem key={s.id} value={s.email}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleBulkAssign} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? 'Atribuindo...' : `Atribuir ${selectedIds.size} leads`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(r => r.status === 'sem_dono').length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome (Clint)</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dono Atual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row, idx) => {
                  const globalIdx = page * PAGE_SIZE + idx;
                  const isSemDono = row.status === 'sem_dono';
                  return (
                    <TableRow key={globalIdx} className={isSemDono ? 'bg-amber-500/5' : row.status === 'nao_encontrado' ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        {isSemDono && row.localDealId && (
                          <Checkbox
                            checked={selectedIds.has(globalIdx)}
                            onCheckedChange={() => toggleSelect(globalIdx)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{row.excelName}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{row.excelEmail}</TableCell>
                      <TableCell className="text-xs">{row.excelPhone}</TableCell>
                      <TableCell className="text-xs">{row.excelStage || row.localStage}</TableCell>
                      <TableCell className="text-xs">
                        {row.excelValue ? `R$ ${row.excelValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell>
                        {row.status === 'com_dono' && <Badge className="bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30">Com Dono</Badge>}
                        {row.status === 'sem_dono' && <Badge className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30">Sem Dono</Badge>}
                        {row.status === 'nao_encontrado' && <Badge variant="destructive">Não Encontrado</Badge>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {row.localOwner || row.excelOwner || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum resultado encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próximo</Button>
          </div>
        </div>
      )}
    </div>
  );
}
