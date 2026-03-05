import { useState, useMemo, useCallback } from 'react';
import { Upload, FileSpreadsheet, Search, CheckCircle2, XCircle, Download, Tag, ClipboardPaste, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { compareSpreadsheetWithDeals, SpreadsheetRow, useCreateNotFoundDeals } from '@/hooks/useSpreadsheetCompare';
import { DealStatus, getDealStatusLabel, getDealStatusColor } from '@/lib/dealStatusHelper';
import { useBulkTransfer } from '@/hooks/useBulkTransfer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type Step = 'upload' | 'mapping' | 'results';
type StatusFilter = 'all' | 'found' | 'not_found' | 'open' | 'won' | 'lost';

const COLUMN_KEYS = ['name', 'email', 'phone'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Nome',
  email: 'Email',
  phone: 'Telefone',
};

const AUTO_MAP_HINTS: Record<ColumnKey, string[]> = {
  name: ['nome', 'name', 'lead', 'contato', 'contact'],
  email: ['email', 'e-mail', 'mail'],
  phone: ['telefone', 'phone', 'celular', 'tel', 'whatsapp'],
};

function autoMapColumns(headers: string[]): Record<ColumnKey, string> {
  const mapping: Record<ColumnKey, string> = { name: '', email: '', phone: '' };
  const normalized = headers.map(h => h.toLowerCase().trim());

  for (const key of COLUMN_KEYS) {
    const hints = AUTO_MAP_HINTS[key];
    let idx = normalized.findIndex(h => hints.some(hint => h === hint));
    if (idx < 0) idx = normalized.findIndex(h => hints.some(hint => h.includes(hint)));
    if (idx >= 0) mapping[key] = headers[idx];
  }
  return mapping;
}

/** Detect separator from text lines */
function detectSeparator(lines: string[]): string {
  const candidates = [';', ',', '\t', ' - '];
  const sample = lines.slice(0, 10);
  let best = ';';
  let bestCount = 0;
  for (const sep of candidates) {
    const total = sample.reduce((sum, line) => sum + (line.split(sep).length - 1), 0);
    if (total > bestCount) {
      bestCount = total;
      best = sep;
    }
  }
  return best;
}

/** Check if line looks like a header */
function looksLikeHeader(line: string): boolean {
  const lower = line.toLowerCase();
  const headerWords = ['nome', 'name', 'telefone', 'phone', 'email', 'contato', 'celular'];
  return headerWords.some(w => lower.includes(w));
}

/** Parse plain text into headers + rawData */
function parseTextToRows(text: string): { headers: string[]; rawData: any[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { headers: [], rawData: [] };

  const sep = detectSeparator(lines);
  const firstLine = lines[0];
  const hasHeader = looksLikeHeader(firstLine);

  let headers: string[];
  let dataLines: string[];

  if (hasHeader) {
    headers = firstLine.split(sep).map(h => h.trim());
    dataLines = lines.slice(1);
  } else {
    // Auto-generate headers based on column count
    const colCount = firstLine.split(sep).length;
    if (colCount >= 3) {
      headers = ['Nome', 'Telefone', 'Email'];
    } else if (colCount === 2) {
      headers = ['Nome', 'Telefone'];
    } else {
      headers = ['Nome'];
    }
    dataLines = lines;
  }

  const rawData = dataLines.map(line => {
    const parts = line.split(sep).map(p => p.trim());
    const row: any = {};
    headers.forEach((h, i) => {
      row[h] = parts[i] || '';
    });
    return row;
  });

  return { headers, rawData };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: any[];
  originId?: string;
}

export function SpreadsheetCompareDialog({ open, onOpenChange, deals, originId }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ColumnKey, string>>({ name: '', email: '', phone: '' });
  const [results, setResults] = useState<SpreadsheetRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);

  const createNotFoundMutation = useCreateNotFoundDeals();
  const bulkTransfer = useBulkTransfer();

  // Query available SDRs/Closers for transfer
  const { data: availableUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['transfer-users-sdr-closer'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select(`id, full_name, email, user_roles!inner(role)`)
        .in('user_roles.role', ['sdr', 'closer', 'admin', 'manager', 'coordenador'])
        .order('full_name');
      return data || [];
    },
    enabled: open && step === 'results',
  });

  const processFileData = useCallback((hdrs: string[], data: any[]) => {
    setHeaders(hdrs);
    setRawData(data);
    setColumnMapping(autoMapColumns(hdrs));
    setStep('mapping');
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const { headers: hdrs, rawData: data } = parseTextToRows(text);
          if (!data.length) { toast.error('Arquivo vazio'); return; }
          processFileData(hdrs, data);
        } catch { toast.error('Erro ao ler arquivo'); }
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          if (!json.length) { toast.error('Planilha vazia'); return; }
          const hdrs = Object.keys(json[0] as any);
          processFileData(hdrs, json as any[]);
        } catch { toast.error('Erro ao ler planilha'); }
      };
      reader.readAsArrayBuffer(file);
    }
  }, [processFileData]);

  const handlePasteSubmit = useCallback(() => {
    if (!pastedText.trim()) {
      toast.error('Cole uma lista de leads');
      return;
    }
    const { headers: hdrs, rawData: data } = parseTextToRows(pastedText);
    if (!data.length) { toast.error('Nenhum dado detectado na lista'); return; }
    processFileData(hdrs, data);
  }, [pastedText, processFileData]);

  const handleCompare = useCallback(() => {
    if (!columnMapping.name && !columnMapping.email && !columnMapping.phone) {
      toast.error('Mapeie pelo menos uma coluna (nome, email ou telefone)');
      return;
    }

    const rows = rawData.map((row) => ({
      name: String(row[columnMapping.name] || ''),
      email: String(row[columnMapping.email] || ''),
      phone: String(row[columnMapping.phone] || ''),
    }));

    const compared = compareSpreadsheetWithDeals(rows, deals);
    setResults(compared);
    setSelectedDealIds(new Set());
    setSelectedOwner(null);
    setStep('results');
    
    const found = compared.filter(r => r.matchStatus === 'found').length;
    toast.success(`Comparação concluída: ${found} encontrados, ${compared.length - found} não encontrados`);
  }, [rawData, columnMapping, deals]);

  const handleCreateLeads = useCallback(() => {
    if (!originId) {
      toast.error('Pipeline não identificada');
      return;
    }

    const allLeads = results.map(r => ({ name: r.excelName, email: r.excelEmail, phone: r.excelPhone }));

    if (!allLeads.length) {
      toast.info('Nenhum lead para processar');
      return;
    }

    setBatchProgress({ current: 0, total: 1 });
    createNotFoundMutation.mutate({
      leads: allLeads,
      originId,
      onProgress: (batch, totalBatches) => setBatchProgress({ current: batch, total: totalBatches }),
    }, {
      onSettled: () => setBatchProgress(null),
    });
  }, [results, originId, createNotFoundMutation]);

  const handleExport = useCallback(() => {
    const exportData = filteredResults.map(r => ({
      'Nome (Planilha)': r.excelName,
      'Email (Planilha)': r.excelEmail,
      'Telefone (Planilha)': r.excelPhone,
      'Status': r.matchStatus === 'found' ? 'Encontrado' : 'Não encontrado',
      'Status Deal': r.dealStatus ? getDealStatusLabel(r.dealStatus) : '',
      'Nome (Sistema)': r.localContactName || '',
      'Email (Sistema)': r.localContactEmail || '',
      'Telefone (Sistema)': r.localContactPhone || '',
      'Estágio': r.localStageName || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparação');
    XLSX.writeFile(wb, 'comparacao_base_clint.xlsx');
  }, [results, statusFilter, searchText]);

  // Transfer selected deals
  const handleTransferSelected = useCallback(async () => {
    if (!selectedOwner || selectedDealIds.size === 0) return;
    const user = availableUsers?.find((u: any) => u.email === selectedOwner);
    if (!user) return;

    await bulkTransfer.mutateAsync({
      dealIds: Array.from(selectedDealIds),
      newOwnerEmail: user.email,
      newOwnerName: user.full_name || user.email,
      newOwnerProfileId: user.id,
    });

    setSelectedDealIds(new Set());
    setSelectedOwner(null);
  }, [selectedOwner, selectedDealIds, availableUsers, bulkTransfer]);

  // Toggle selection
  const toggleDealSelection = (dealId: string) => {
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  };

  const foundWithDealId = useMemo(() => 
    filteredResults.filter(r => r.matchStatus === 'found' && r.localDealId),
  [filteredResults]);

  const toggleSelectAllFound = () => {
    if (selectedDealIds.size === foundWithDealId.length && foundWithDealId.length > 0) {
      setSelectedDealIds(new Set());
    } else {
      setSelectedDealIds(new Set(foundWithDealId.map(r => r.localDealId!)));
    }
  };

  // Counts
  const counts = useMemo(() => {
    const found = results.filter(r => r.matchStatus === 'found');
    return {
      total: results.length,
      found: found.length,
      notFound: results.length - found.length,
      open: found.filter(r => r.dealStatus === 'open').length,
      won: found.filter(r => r.dealStatus === 'won').length,
      lost: found.filter(r => r.dealStatus === 'lost').length,
    };
  }, [results]);

  const filteredResults = useMemo(() => {
    let filtered = results;

    if (statusFilter === 'found') filtered = filtered.filter(r => r.matchStatus === 'found');
    else if (statusFilter === 'not_found') filtered = filtered.filter(r => r.matchStatus === 'not_found');
    else if (statusFilter === 'open') filtered = filtered.filter(r => r.matchStatus === 'found' && r.dealStatus === 'open');
    else if (statusFilter === 'won') filtered = filtered.filter(r => r.matchStatus === 'found' && r.dealStatus === 'won');
    else if (statusFilter === 'lost') filtered = filtered.filter(r => r.matchStatus === 'found' && r.dealStatus === 'lost');

    if (searchText) {
      const s = searchText.toLowerCase();
      filtered = filtered.filter(r =>
        r.excelName.toLowerCase().includes(s) ||
        r.excelEmail.toLowerCase().includes(s) ||
        r.excelPhone.includes(searchText) ||
        (r.localContactName || '').toLowerCase().includes(s)
      );
    }

    return filtered;
  }, [results, statusFilter, searchText]);

  const handleReset = () => {
    setStep('upload');
    setHeaders([]);
    setRawData([]);
    setResults([]);
    setStatusFilter('all');
    setSearchText('');
    setColumnMapping({ name: '', email: '', phone: '' });
    setPastedText('');
    setSelectedDealIds(new Set());
    setSelectedOwner(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha Base Clint
          </DialogTitle>
          <DialogDescription>
            Compare leads da planilha ou lista com os deals da pipeline atual
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="flex items-center gap-1">
                <Upload className="h-4 w-4" /> Arquivo
              </TabsTrigger>
              <TabsTrigger value="paste" className="flex items-center gap-1">
                <ClipboardPaste className="h-4 w-4" /> Colar Lista
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              <div className="flex flex-col items-center gap-4 py-8">
                <Upload className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Selecione um arquivo .xlsx, .csv ou .txt</p>
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileUpload}
                  className="max-w-sm"
                />
              </div>
            </TabsContent>
            <TabsContent value="paste">
              <div className="flex flex-col gap-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Cole sua lista abaixo. Formatos aceitos: <br />
                  <code className="text-xs bg-muted px-1 rounded">Nome - 11999998888</code> ou{' '}
                  <code className="text-xs bg-muted px-1 rounded">Nome;Telefone;Email</code> ou{' '}
                  <code className="text-xs bg-muted px-1 rounded">Nome,Telefone</code>
                </p>
                <Textarea
                  placeholder={"João Silva - 11999998888\nMaria Santos - 21988887777\nCarlos Souza - 31977776666"}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handlePasteSubmit} disabled={!pastedText.trim()}>
                    Processar Lista
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mapeie as colunas da planilha ({rawData.length} linhas detectadas)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {COLUMN_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium">{COLUMN_LABELS[key]}</label>
                  <Select
                    value={columnMapping[key] || '__none__'}
                    onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [key]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
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
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleReset}>Voltar</Button>
              <Button size="sm" onClick={handleCompare}>Comparar</Button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && (
          <div className="space-y-4">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="cursor-pointer" onClick={() => setStatusFilter('all')}>
                Total: {counts.total}
              </Badge>
              <Badge className="bg-green-500/20 text-green-700 cursor-pointer hover:bg-green-500/30" onClick={() => setStatusFilter('found')}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Encontrados: {counts.found}
              </Badge>
              <Badge className="bg-red-500/20 text-red-700 cursor-pointer hover:bg-red-500/30" onClick={() => setStatusFilter('not_found')}>
                <XCircle className="h-3 w-3 mr-1" /> Não encontrados: {counts.notFound}
              </Badge>
              <Badge className="bg-blue-500/20 text-blue-700 cursor-pointer hover:bg-blue-500/30" onClick={() => setStatusFilter('open')}>
                Abertos: {counts.open}
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-700 cursor-pointer hover:bg-emerald-500/30" onClick={() => setStatusFilter('won')}>
                Ganhos: {counts.won}
              </Badge>
              <Badge className="bg-orange-500/20 text-orange-700 cursor-pointer hover:bg-orange-500/30" onClick={() => setStatusFilter('lost')}>
                Perdidos: {counts.lost}
              </Badge>
            </div>

            {/* Search + Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  className="pl-8 h-8 text-xs"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateLeads}
                disabled={createNotFoundMutation.isPending || results.length === 0}
              >
                <Tag className="h-4 w-4 mr-1" />
                {createNotFoundMutation.isPending && batchProgress
                  ? `Processando batch ${batchProgress.current}/${batchProgress.total}...`
                  : `Criar leads inexistentes com tag 'base clint' (${results.length})`}
              </Button>
            </div>

            {/* Transfer section */}
            {counts.found > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 flex-1">
                  <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">
                    {selectedDealIds.size > 0
                      ? `${selectedDealIds.size} lead(s) selecionado(s)`
                      : 'Selecione leads encontrados para transferir'}
                  </span>
                  <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={toggleSelectAllFound}>
                    {selectedDealIds.size === foundWithDealId.length && foundWithDealId.length > 0
                      ? 'Limpar seleção'
                      : `Selecionar todos (${foundWithDealId.length})`}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedOwner || ''} onValueChange={setSelectedOwner}>
                    <SelectTrigger className="h-8 text-xs w-[200px]">
                      <SelectValue placeholder="Selecionar SDR/Closer" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingUsers ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        availableUsers?.map((user: any) => (
                          <SelectItem key={user.id} value={user.email}>
                            <span className="flex items-center gap-2">
                              {user.full_name || user.email}
                              <span className="text-muted-foreground text-xs">
                                ({user.user_roles?.[0]?.role?.toUpperCase()})
                              </span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="text-xs h-8"
                    onClick={handleTransferSelected}
                    disabled={selectedDealIds.size === 0 || !selectedOwner || bulkTransfer.isPending}
                  >
                    {bulkTransfer.isPending ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Transferindo...</>
                    ) : (
                      `Transferir ${selectedDealIds.size}`
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Batch progress */}
            {batchProgress && createNotFoundMutation.isPending && (
              <div className="space-y-1">
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Processando batch {batchProgress.current} de {batchProgress.total}...
                </p>
              </div>
            )}

            {/* Table */}
            <div className="border rounded-lg max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-8"></TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Nome (Planilha)</TableHead>
                    <TableHead className="text-xs">Email (Planilha)</TableHead>
                    <TableHead className="text-xs">Tel (Planilha)</TableHead>
                    <TableHead className="text-xs">Nome (Sistema)</TableHead>
                    <TableHead className="text-xs">Estágio</TableHead>
                    <TableHead className="text-xs">Status Deal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.slice(0, 200).map((row, i) => (
                    <TableRow key={i} className={row.matchStatus === 'not_found' ? 'opacity-60' : ''}>
                      <TableCell className="py-1">
                        {row.matchStatus === 'found' && row.localDealId ? (
                          <Checkbox
                            checked={selectedDealIds.has(row.localDealId)}
                            onCheckedChange={() => toggleDealSelection(row.localDealId!)}
                          />
                        ) : null}
                      </TableCell>
                      <TableCell className="py-1">
                        {row.matchStatus === 'found' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-1">{row.excelName}</TableCell>
                      <TableCell className="text-xs py-1">{row.excelEmail}</TableCell>
                      <TableCell className="text-xs py-1">{row.excelPhone}</TableCell>
                      <TableCell className="text-xs py-1">{row.localContactName || '—'}</TableCell>
                      <TableCell className="text-xs py-1">
                        {row.localStageName ? (
                          <Badge variant="outline" className="text-xs">{row.localStageName}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs py-1">
                        {row.dealStatus ? (
                          <span className={`font-medium ${getDealStatusColor(row.dealStatus)}`}>
                            {getDealStatusLabel(row.dealStatus)}
                          </span>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredResults.length > 200 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-2">
                        Mostrando 200 de {filteredResults.length} resultados. Use o filtro ou exporte para ver todos.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">
                        Nenhum resultado encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleReset}>Nova comparação</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
