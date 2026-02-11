import { useState, useMemo, useCallback, useEffect } from 'react';
import { Upload, FileSpreadsheet, Search, Users, UserCheck, UserX, Download, Inbox, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

// Tag colors por estágio (normalized lowercase key)
const STAGE_TAG_CONFIG: Record<string, { className: string; label: string }> = {
  'contrato pago': { className: 'bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30', label: 'Contrato Pago' },
  'lead qualificado': { className: 'bg-blue-500/20 text-blue-700 hover:bg-blue-500/30', label: 'Lead Qualificado' },
  'sem interesse': { className: 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30', label: 'Sem Interesse' },
  'novo lead': { className: 'bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30', label: 'Novo Lead' },
  'agendamento': { className: 'bg-purple-500/20 text-purple-700 hover:bg-purple-500/30', label: 'Agendamento' },
  'reunião realizada': { className: 'bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/30', label: 'Reunião Realizada' },
  'proposta enviada': { className: 'bg-cyan-500/20 text-cyan-700 hover:bg-cyan-500/30', label: 'Proposta Enviada' },
  'negociação': { className: 'bg-orange-500/20 text-orange-700 hover:bg-orange-500/30', label: 'Negociação' },
};

function StageTag({ stage }: { stage: string }) {
  if (!stage) return <span className="text-xs text-muted-foreground">—</span>;
  const key = stage.toLowerCase().trim();
  const config = STAGE_TAG_CONFIG[key];
  return (
    <Badge className={config?.className || 'bg-muted text-muted-foreground hover:bg-muted/80'}>
      {config?.label || stage}
    </Badge>
  );
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

// ─── Persistence helpers ────────────────────────────────
const STORAGE_KEY = 'limbo-comparison-data';
const STORAGE_EXPIRY_HOURS = 24;

interface PersistenceData {
  results: LimboRow[];
  step: Step;
  statusFilter: StatusFilter;
  stageFilter: string;
  ownerFilter: string;
  page: number;
  pageSize: number;
  columnMapping: Record<ColumnKey, string>;
  savedAt: string;
}

function saveToStorage(data: PersistenceData) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to sessionStorage', e);
  }
}

function loadFromStorage(): PersistenceData | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const data = JSON.parse(stored) as PersistenceData;
    const hoursDiff = (Date.now() - new Date(data.savedAt).getTime()) / (1000 * 60 * 60);
    if (hoursDiff > STORAGE_EXPIRY_HOURS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Failed to load from sessionStorage', e);
    return null;
  }
}

function clearStorage() {
  sessionStorage.removeItem(STORAGE_KEY);
}

// ─── Component ──────────────────────────────────────────
export default function LeadsLimbo() {
  const [step, setStep] = useState<Step>(() => {
    const stored = loadFromStorage();
    return stored?.step || 'upload';
  });
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ColumnKey, string>>(() => {
    const stored = loadFromStorage();
    return stored?.columnMapping || { name: '', email: '', phone: '', stage: '', value: '', owner: '' };
  });
  const [results, setResults] = useState<LimboRow[]>(() => {
    const stored = loadFromStorage();
    return stored?.results || [];
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const stored = loadFromStorage();
    return stored?.statusFilter || 'todos';
  });
  const [stageFilter, setStageFilter] = useState<string>(() => {
    const stored = loadFromStorage();
    return stored?.stageFilter || 'todos';
  });
  const [ownerFilter, setOwnerFilter] = useState<string>(() => {
    const stored = loadFromStorage();
    return stored?.ownerFilter || 'todos';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectCount, setSelectCount] = useState('');
  const [assignSdrEmail, setAssignSdrEmail] = useState('');
  const [page, setPage] = useState<number>(() => {
    const stored = loadFromStorage();
    return stored?.page || 0;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = loadFromStorage();
    return stored?.pageSize || 50;
  });
  const [isComparing, setIsComparing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LimboRow | null>(null);

  const { data: localDeals, isLoading: loadingDeals } = useInsideSalesDeals();
  const { data: sdrs } = useActiveSdrs();
  const { data: profiles } = useProfilesByEmail();
  const assignMutation = useAssignLimboOwner();

  // Auto-save to sessionStorage
  useEffect(() => {
    if (step === 'results' && results.length > 0) {
      saveToStorage({
        results,
        step,
        statusFilter,
        stageFilter,
        ownerFilter,
        page,
        pageSize,
        columnMapping,
        savedAt: new Date().toISOString(),
      });
    }
  }, [results, step, statusFilter, stageFilter, ownerFilter, page, pageSize, columnMapping]);

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
    setStageFilter('todos');
    setOwnerFilter('todos');
    setIsComparing(false);
  }, [rawData, columnMapping, localDeals]);

  // Unique stages and owners for filters
  const uniqueStages = useMemo(() => {
    const stages = new Set(results.map(r => r.excelStage).filter(Boolean));
    return Array.from(stages).sort();
  }, [results]);

  const uniqueOwners = useMemo(() => {
    const owners = new Set(results.map(r => r.excelOwner || r.localOwner || '').filter(Boolean));
    return Array.from(owners).sort();
  }, [results]);

  // Filtered results
  const filtered = useMemo(() => {
    let items = results;
    if (statusFilter !== 'todos') items = items.filter(r => r.status === statusFilter);
    if (stageFilter !== 'todos') items = items.filter(r => r.excelStage === stageFilter);
    if (ownerFilter !== 'todos') items = items.filter(r => (r.excelOwner || r.localOwner || '') === ownerFilter);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(r =>
        r.excelName.toLowerCase().includes(term) ||
        r.excelEmail.toLowerCase().includes(term) ||
        (r.excelPhone || '').toLowerCase().includes(term) ||
        (r.localContactName || '').toLowerCase().includes(term)
      );
    }
    return items;
  }, [results, statusFilter, stageFilter, ownerFilter, searchTerm]);

  // Counts
  const counts = useMemo(() => ({
    total: results.length,
    com_dono: results.filter(r => r.status === 'com_dono').length,
    sem_dono: results.filter(r => r.status === 'sem_dono').length,
    nao_encontrado: results.filter(r => r.status === 'nao_encontrado').length,
  }), [results]);

  // Pagination
  const showAll = pageSize === 0;
  const paged = showAll ? filtered : filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = showAll ? 1 : Math.ceil(filtered.length / pageSize);

  // Toggle selection
  const toggleSelect = (idx: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageStart = page * pageSize;
    const pageIndices = paged
      .map((r, i) => ({ r, globalIdx: showAll ? i : pageStart + i }))
      .filter(({ r }) => r.status === 'sem_dono' && r.localDealId);

    const allPageSelected = pageIndices.length > 0 && pageIndices.every(({ globalIdx }) => selectedIds.has(globalIdx));

    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIndices.forEach(({ globalIdx }) => next.delete(globalIdx));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pageIndices.forEach(({ globalIdx }) => next.add(globalIdx));
        return next;
      });
    }
  };

  const selectByCount = (count: number) => {
    const ids = new Set<number>();
    let added = 0;
    for (let i = 0; i < filtered.length && added < count; i++) {
      if (filtered[i].status === 'sem_dono' && filtered[i].localDealId) {
        ids.add(i);
        added++;
      }
    }
    setSelectedIds(ids);
  };

  const selectAllFiltered = () => {
    const ids = new Set<number>();
    filtered.forEach((r, i) => {
      if (r.status === 'sem_dono' && r.localDealId) ids.add(i);
    });
    setSelectedIds(ids);
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
          <Button variant="outline" size="sm" onClick={() => {
            clearStorage();
            setStep('upload');
            setResults([]);
            setColumnMapping({ name: '', email: '', phone: '', stage: '', value: '', owner: '' });
            setStatusFilter('todos');
            setStageFilter('todos');
            setOwnerFilter('todos');
            setPage(0);
          }}>
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
            placeholder="Buscar por nome, email ou telefone..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(0); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos ({counts.total})</SelectItem>
            <SelectItem value="com_dono">Com Dono ({counts.com_dono})</SelectItem>
            <SelectItem value="sem_dono">Sem Dono ({counts.sem_dono})</SelectItem>
            <SelectItem value="nao_encontrado">Não Encontrado ({counts.nao_encontrado})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Estágios</SelectItem>
            {uniqueStages.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ownerFilter} onValueChange={(v) => { setOwnerFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Dono" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Donos</SelectItem>
            {uniqueOwners.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(n => (
              <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>
            ))}
            <SelectItem value="0">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selection controls */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              placeholder="Qtd"
              value={selectCount}
              onChange={e => setSelectCount(e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const count = parseInt(selectCount);
                if (!count || count <= 0) { toast.error('Digite uma quantidade válida'); return; }
                selectByCount(count);
              }}
            >
              Selecionar
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={selectAllFiltered}>
            Selecionar todos filtrados ({filtered.filter(r => r.status === 'sem_dono' && r.localDealId).length})
          </Button>
          {selectedIds.size > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-medium text-foreground">{selectedIds.size} selecionados</span>
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
              <Button size="sm" variant="ghost" onClick={() => { setSelectedIds(new Set()); setSelectCount(''); }}>Limpar</Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={(() => {
                        const pageStart = page * pageSize;
                        const pageIndices = paged
                          .map((r, i) => ({ r, globalIdx: showAll ? i : pageStart + i }))
                          .filter(({ r }) => r.status === 'sem_dono' && r.localDealId);
                        return pageIndices.length > 0 && pageIndices.every(({ globalIdx }) => selectedIds.has(globalIdx));
                      })()}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome (Clint)</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ult. Mov.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dono Atual</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((row, idx) => {
                  const globalIdx = showAll ? idx : page * pageSize + idx;
                  const isSemDono = row.status === 'sem_dono';
                  return (
                    <TableRow
                      key={globalIdx}
                      className={`cursor-pointer ${isSemDono ? 'bg-amber-500/5' : row.status === 'nao_encontrado' ? 'bg-destructive/5' : ''}`}
                      onClick={() => setSelectedLead(row)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                      <TableCell>
                        <StageTag stage={row.excelStage || row.localStage || ''} />
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {row.localCreatedAt ? format(new Date(row.localCreatedAt), 'dd/MM/yy') : '--'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {row.localUpdatedAt ? format(new Date(row.localUpdatedAt), 'dd/MM/yy') : '--'}
                      </TableCell>
                      <TableCell>
                        {row.status === 'com_dono' && <Badge className="bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30">Com Dono</Badge>}
                        {row.status === 'sem_dono' && <Badge className="bg-amber-500/20 text-amber-700 hover:bg-amber-500/30">Sem Dono</Badge>}
                        {row.status === 'nao_encontrado' && <Badge variant="destructive">Não Encontrado</Badge>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">
                        {row.localOwner || row.excelOwner || '—'}
                      </TableCell>
                      <TableCell>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
            Mostrando {showAll ? filtered.length : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)}`} de {filtered.length}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próximo</Button>
          </div>
        </div>
      )}

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLead?.excelName || 'Detalhes do Lead'}
              {selectedLead && (
                <>
                  {selectedLead.status === 'com_dono' && <Badge className="bg-emerald-500/20 text-emerald-700">Com Dono</Badge>}
                  {selectedLead.status === 'sem_dono' && <Badge className="bg-amber-500/20 text-amber-700">Sem Dono</Badge>}
                  {selectedLead.status === 'nao_encontrado' && <Badge variant="destructive">Não Encontrado</Badge>}
                </>
              )}
            </DialogTitle>
            <DialogDescription>Comparação entre dados do Clint e base local</DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="grid grid-cols-2 gap-6 mt-4">
              {/* Dados do Clint */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground border-b pb-1">📋 Dados do Clint</h4>
                <DetailItem label="Nome" value={selectedLead.excelName} />
                <DetailItem label="Email" value={selectedLead.excelEmail} />
                <DetailItem label="Telefone" value={selectedLead.excelPhone} />
                <DetailItem label="Estágio" value={selectedLead.excelStage} />
                <DetailItem label="Valor" value={selectedLead.excelValue ? `R$ ${selectedLead.excelValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'} />
                <DetailItem label="Dono (Clint)" value={selectedLead.excelOwner} />
              </div>

              {/* Dados Locais */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-foreground border-b pb-1">🏠 Dados Locais</h4>
                {selectedLead.status === 'nao_encontrado' ? (
                  <p className="text-sm text-muted-foreground italic">Lead não encontrado na base local</p>
                ) : (
                  <>
                    <DetailItem label="Deal ID" value={selectedLead.localDealId || '—'} />
                    <DetailItem label="Nome Deal" value={selectedLead.localDealName || '—'} />
                    <DetailItem label="Contato" value={selectedLead.localContactName || '—'} />
                    <DetailItem label="Email" value={selectedLead.localContactEmail || '—'} />
                    <DetailItem label="Telefone" value={selectedLead.localContactPhone || '—'} />
                    <DetailItem label="Owner" value={selectedLead.localOwner || '—'} />
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium truncate">{value || '—'}</p>
    </div>
  );
}
