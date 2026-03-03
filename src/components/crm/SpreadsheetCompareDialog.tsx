import { useState, useMemo, useCallback } from 'react';
import { Upload, FileSpreadsheet, Search, CheckCircle2, XCircle, Download, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { compareSpreadsheetWithDeals, SpreadsheetRow, useAddBaseClintTag } from '@/hooks/useSpreadsheetCompare';
import { DealStatus, getDealStatusLabel, getDealStatusColor } from '@/lib/dealStatusHelper';

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: any[];
}

export function SpreadsheetCompareDialog({ open, onOpenChange, deals }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ColumnKey, string>>({ name: '', email: '', phone: '' });
  const [results, setResults] = useState<SpreadsheetRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');

  const addTagMutation = useAddBaseClintTag();

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!json.length) {
          toast.error('Planilha vazia');
          return;
        }

        const hdrs = Object.keys(json[0] as any);
        setHeaders(hdrs);
        setRawData(json as any[]);
        setColumnMapping(autoMapColumns(hdrs));
        setStep('mapping');
      } catch {
        toast.error('Erro ao ler planilha');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

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
    setStep('results');
    
    const found = compared.filter(r => r.matchStatus === 'found').length;
    toast.success(`Comparação concluída: ${found} encontrados, ${compared.length - found} não encontrados`);
  }, [rawData, columnMapping, deals]);

  const handleApplyTag = useCallback(() => {
    const dealIds = results
      .filter(r => r.matchStatus === 'found' && r.localDealId)
      .map(r => r.localDealId!);

    if (!dealIds.length) {
      toast.info('Nenhum deal encontrado para aplicar tag');
      return;
    }

    addTagMutation.mutate(dealIds);
  }, [results, addTagMutation]);

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
            Compare leads da planilha com os deals da pipeline atual
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Upload className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Selecione um arquivo .xlsx do Clint</p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="max-w-sm"
            />
          </div>
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
                onClick={handleApplyTag}
                disabled={addTagMutation.isPending || counts.found === 0}
              >
                <Tag className="h-4 w-4 mr-1" />
                {addTagMutation.isPending ? 'Aplicando...' : `Aplicar tag 'base clint' (${counts.found})`}
              </Button>
            </div>

            {/* Table */}
            <div className="border rounded-lg max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                        Mostrando 200 de {filteredResults.length} resultados. Use o filtro ou exporte para ver todos.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-4">
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
