import { useState, useMemo, useCallback } from 'react';
import { Upload, FileSpreadsheet, Search, CheckCircle2, XCircle, Download, Tag, ClipboardPaste, UserPlus, Loader2, ArrowRightLeft, Users, GitBranch } from 'lucide-react';
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
import { compareSpreadsheetGlobal, SpreadsheetRow, useCreateNotFoundDeals } from '@/hooks/useSpreadsheetCompare';
import { DealStatus, getDealStatusLabel, getDealStatusColor } from '@/lib/dealStatusHelper';
import { useBulkTransfer } from '@/hooks/useBulkTransfer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSdrsFromSquad } from '@/hooks/useSdrsFromSquad';
import { BusinessUnit } from '@/hooks/useMyBU';

type Step = 'upload' | 'mapping' | 'results';
type StatusFilter = 'all' | 'found_in_current' | 'found_elsewhere' | 'not_found';
type AssignMode = 'single' | 'distribute';

const COLUMN_KEYS = ['name', 'email', 'phone'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Nome',
  email: 'Email',
  phone: 'Telefone',
};

const AUTO_MAP_HINTS: Record<ColumnKey, string[]> = {
  name: ['nome', 'name', 'lead', 'contato', 'contact', 'cliente'],
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
  const headerWords = ['nome', 'name', 'telefone', 'phone', 'email', 'contato', 'celular', 'cliente'];
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
    const rawHeaders = firstLine.split(sep).map(h => h.trim());
    const seen = new Map<string, number>();
    headers = rawHeaders.map(h => {
      const key = h.toLowerCase();
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      return count > 1 ? `${h}_${count}` : h;
    });
    dataLines = lines.slice(1);
  } else {
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

  const stripQuotes = (val: string): string => {
    const trimmed = val.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  const rawData = dataLines.map(line => {
    const parts = line.split(sep).map(p => stripQuotes(p));
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
  activeBU?: BusinessUnit | null;
}

export function SpreadsheetCompareDialog({ open, onOpenChange, deals, originId, activeBU }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ColumnKey, string>>({ name: '', email: '', phone: '' });
  const [results, setResults] = useState<SpreadsheetRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [selectedStageId, setSelectedStageId] = useState<string>('__default__');
  const [assignMode, setAssignMode] = useState<AssignMode>('single');
  const [selectedDestinationOriginId, setSelectedDestinationOriginId] = useState<string>('');

  const createNotFoundMutation = useCreateNotFoundDeals();
  const bulkTransfer = useBulkTransfer();

  // SDRs do Consórcio for distribution
  const { data: consorcioSdrs } = useSdrsFromSquad('consorcio');

  // Query BU-filtered pipeline origins (for destination selector)
  const { data: buFilteredOrigins } = useQuery({
    queryKey: ['bu-filtered-origins', activeBU],
    queryFn: async () => {
      if (!activeBU) return [];
      // Get entity_ids from bu_origin_mapping for this BU (origin type)
      const { data: mappings } = await supabase
        .from('bu_origin_mapping')
        .select('entity_id, entity_type')
        .eq('bu', activeBU);
      if (!mappings?.length) return [];
      const originIds = mappings.filter(m => m.entity_type === 'origin').map(m => m.entity_id);
      if (!originIds.length) return [];
      const { data: origins } = await supabase
        .from('crm_origins')
        .select('id, name')
        .in('id', originIds)
        .order('name');
      return origins || [];
    },
    enabled: !!activeBU && open,
  });

  // The effective destination origin: user-selected > prop > nothing
  const activeOriginId = selectedDestinationOriginId || originId;

  // Query available SDRs/Closers
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

  // Query stages for the current pipeline
  const { data: pipelineStages } = useQuery({
    queryKey: ['pipeline-stages', activeOriginId],
    queryFn: async () => {
      if (!activeOriginId) return [];
      const { data } = await supabase
        .from('crm_stages')
        .select('id, stage_name, stage_order')
        .eq('origin_id', activeOriginId)
        .order('stage_order', { ascending: true });
      return data || [];
    },
    enabled: !!activeOriginId && open && step === 'results',
  });

  // Detect extra columns (not mapped to name/email/phone)
  const extraColumnHeaders = useMemo(() => {
    const mappedValues = new Set(Object.values(columnMapping).filter(Boolean));
    return headers.filter(h => !mappedValues.has(h));
  }, [headers, columnMapping]);

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
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
          if (!json.length) { toast.error('Planilha vazia'); return; }
          const rawHdrs = Object.keys(json[0]);
          const seenXlsx = new Map<string, number>();
          const hdrs = rawHdrs.map(h => {
            const key = h.toLowerCase();
            const count = (seenXlsx.get(key) || 0) + 1;
            seenXlsx.set(key, count);
            return count > 1 ? `${h}_${count}` : h;
          });
          // Remap data keys if headers were renamed
          const remappedJson = json.map(row => {
            const newRow: any = {};
            rawHdrs.forEach((orig, i) => { newRow[hdrs[i]] = row[orig] ?? ''; });
            return newRow;
          });
          processFileData(hdrs, remappedJson);
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

  const handleCompare = useCallback(async () => {
    if (!columnMapping.name && !columnMapping.email && !columnMapping.phone) {
      toast.error('Mapeie pelo menos uma coluna (nome, email ou telefone)');
      return;
    }

    if (!activeOriginId) {
      toast.error('Selecione uma pipeline de destino');
      return;
    }

    // Build extra columns map
    const mappedValues = new Set(Object.values(columnMapping).filter(Boolean));

    const rows = rawData.map((row) => {
      const extraColumns: Record<string, string> = {};
      for (const h of headers) {
        if (!mappedValues.has(h)) {
          extraColumns[h] = String(row[h] || '');
        }
      }
      return {
        name: String(row[columnMapping.name] || '').replace(/^["']|["']$/g, '').trim(),
        email: String(row[columnMapping.email] || '').replace(/^["']|["']$/g, '').trim(),
        phone: String(row[columnMapping.phone] || '').replace(/^["']|["']$/g, '').trim(),
        extraColumns,
      };
    });

    setIsComparing(true);
    try {
      const compared = await compareSpreadsheetGlobal(
        rows,
        activeOriginId,
        (current, total) => setBatchProgress({ current, total })
      );

      // Merge extraColumns back into results
      const resultsWithExtras = compared.map((r, i) => ({
        ...r,
        extraColumns: rows[i]?.extraColumns,
      }));

      setResults(resultsWithExtras);
      setSelectedOwner(null);
      setStep('results');

      const inCurrent = compared.filter(r => r.matchStatus === 'found_in_current').length;
      const elsewhere = compared.filter(r => r.matchStatus === 'found_elsewhere').length;
      const notFound = compared.filter(r => r.matchStatus === 'not_found').length;
      toast.success(`Busca global: ${inCurrent} nesta pipeline, ${elsewhere} em outras, ${notFound} novos`);
    } catch (err: any) {
      toast.error(`Erro na busca: ${err.message}`);
    } finally {
      setIsComparing(false);
      setBatchProgress(null);
    }
  }, [rawData, columnMapping, activeOriginId, headers]);

  // Smart import: handle all 3 categories
  const handleSmartImport = useCallback(async () => {
    if (!activeOriginId) {
      toast.error('Selecione uma pipeline de destino');
      return;
    }

    // Determine SDR list based on assign mode
    let sdrList: Array<{ email: string; id: string; name: string }> = [];

    if (assignMode === 'distribute') {
      if (!consorcioSdrs?.length) {
        toast.error('Nenhum SDR do Consórcio encontrado');
        return;
      }
      // Resolve real profile IDs from profiles table (sdr.id ≠ profiles.id)
      const sdrEmails = consorcioSdrs.filter(s => s.email).map(s => s.email!);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('email', sdrEmails);
      
      if (!profilesData?.length) {
        toast.error('Não foi possível resolver os perfis dos SDRs');
        return;
      }
      sdrList = profilesData.map(p => ({ email: p.email || '', id: p.id, name: p.full_name || p.email || '' }));
    } else {
      if (!selectedOwner) {
        toast.error('Selecione um SDR/Closer');
        return;
      }
      const user = availableUsers?.find((u: any) => u.email === selectedOwner);
      if (!user) return;
      sdrList = [{ email: user.email, id: user.id, name: user.full_name || user.email }];
    }

    setIsImporting(true);
    setBatchProgress({ current: 0, total: 3 });

    const tags = customTag.trim() ? [customTag.trim()] : undefined;
    const stageId = selectedStageId === '__default__' ? undefined : selectedStageId;

    try {
      let updatedCount = 0;
      let createdCount = 0;
      let skippedCount = 0;

      // 1. found_in_current → só atualizar tags (preservar owner e stage)
      const inCurrent = results.filter(r => r.matchStatus === 'found_in_current' && r.localDealId);
      if (inCurrent.length > 0) {
        setBatchProgress({ current: 1, total: 3 });
        const allDealIds = inCurrent.map(r => r.localDealId!);

        if (tags?.length) {
          const { error: tagError } = await supabase
            .from('crm_deals')
            .update({ tags: [...new Set(['base clint', ...tags])] })
            .in('id', allDealIds);
          if (tagError) {
            console.error('Error updating tags for existing deals:', tagError);
          }
        }
        updatedCount += inCurrent.length;
        toast.info(`${inCurrent.length} leads já existentes — apenas tags atualizadas (owner e estágio preservados)`);
      }

      // 2. found_elsewhere → create deal with existing contact_id
      const elsewhere = results.filter(r => r.matchStatus === 'found_elsewhere' && r.contactId);
      if (elsewhere.length > 0) {
        setBatchProgress({ current: 2, total: 3 });
        if (assignMode === 'distribute') {
          const groups = new Map<string, typeof elsewhere>();
          elsewhere.forEach((r, i) => {
            const sdr = sdrList[i % sdrList.length];
            if (!groups.has(sdr.email)) groups.set(sdr.email, []);
            groups.get(sdr.email)!.push(r);
          });
          for (const [email, leads] of groups) {
            const sdr = sdrList.find(s => s.email === email)!;
            const { data, error } = await supabase.functions.invoke('import-spreadsheet-leads', {
              body: {
                leads: leads.map(r => ({
                  name: r.localContactName || r.excelName,
                  email: r.localContactEmail || r.excelEmail,
                  phone: r.localContactPhone || r.excelPhone,
                  contact_id: r.contactId!,
                })),
                origin_id: activeOriginId,
                owner_email: sdr.email,
                owner_profile_id: sdr.id,
                tags,
                stage_id: stageId,
              },
            });
            if (error) throw error;
            createdCount += (data as any).created || 0;
            updatedCount += (data as any).updated || 0;
            skippedCount += (data as any).skipped || 0;
          }
        } else {
          const sdr = sdrList[0];
          const elseLeads = elsewhere.map(r => ({
            name: r.localContactName || r.excelName,
            email: r.localContactEmail || r.excelEmail,
            phone: r.localContactPhone || r.excelPhone,
            contact_id: r.contactId!,
          }));
          const { data, error } = await supabase.functions.invoke('import-spreadsheet-leads', {
            body: {
              leads: elseLeads,
              origin_id: activeOriginId,
              owner_email: sdr.email,
              owner_profile_id: sdr.id,
              tags,
              stage_id: stageId,
            },
          });
          if (error) throw error;
          createdCount += (data as any).created || 0;
          updatedCount += (data as any).updated || 0;
          skippedCount += (data as any).skipped || 0;
        }
      }

      // 3. not_found → create contact + deal
      const notFound = results.filter(r => r.matchStatus === 'not_found');
      if (notFound.length > 0) {
        setBatchProgress({ current: 3, total: 3 });
        if (assignMode === 'distribute') {
          const groups = new Map<string, typeof notFound>();
          notFound.forEach((r, i) => {
            const sdr = sdrList[i % sdrList.length];
            if (!groups.has(sdr.email)) groups.set(sdr.email, []);
            groups.get(sdr.email)!.push(r);
          });
          for (const [email, leads] of groups) {
            const sdr = sdrList.find(s => s.email === email)!;
            const { data, error } = await supabase.functions.invoke('import-spreadsheet-leads', {
              body: {
                leads: leads.map(r => ({ name: r.excelName, email: r.excelEmail, phone: r.excelPhone })),
                origin_id: activeOriginId,
                owner_email: sdr.email,
                owner_profile_id: sdr.id,
                tags,
                stage_id: stageId,
              },
            });
            if (error) throw error;
            createdCount += (data as any).created || 0;
            updatedCount += (data as any).updated || 0;
            skippedCount += (data as any).skipped || 0;
          }
        } else {
          const sdr = sdrList[0];
          const newLeads = notFound.map(r => ({ name: r.excelName, email: r.excelEmail, phone: r.excelPhone }));
          const { data, error } = await supabase.functions.invoke('import-spreadsheet-leads', {
            body: {
              leads: newLeads,
              origin_id: activeOriginId,
              owner_email: sdr.email,
              owner_profile_id: sdr.id,
              tags,
              stage_id: stageId,
            },
          });
          if (error) throw error;
          createdCount += (data as any).created || 0;
          updatedCount += (data as any).updated || 0;
          skippedCount += (data as any).skipped || 0;
        }
      }

      const distributionMsg = assignMode === 'distribute' ? ` (distribuídos entre ${sdrList.length} SDRs)` : '';
      const parts = [];
      if (updatedCount > 0) parts.push(`${updatedCount} atualizados`);
      if (createdCount > 0) parts.push(`${createdCount} criados`);
      if (skippedCount > 0) parts.push(`${skippedCount} já estavam corretos`);
      toast.success(`✅ ${parts.join(', ')}${distributionMsg}`);
    } catch (err: any) {
      toast.error(`Erro na importação: ${err.message}`);
    } finally {
      setIsImporting(false);
      setBatchProgress(null);
    }
  }, [activeOriginId, selectedOwner, assignMode, consorcioSdrs, availableUsers, results, bulkTransfer, customTag, selectedStageId]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: results.length,
      inCurrent: results.filter(r => r.matchStatus === 'found_in_current').length,
      elsewhere: results.filter(r => r.matchStatus === 'found_elsewhere').length,
      notFound: results.filter(r => r.matchStatus === 'not_found').length,
    };
  }, [results]);

  const filteredResults = useMemo(() => {
    let filtered = results;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.matchStatus === statusFilter);
    }

    if (searchText) {
      const s = searchText.toLowerCase();
      filtered = filtered.filter(r =>
        r.excelName.toLowerCase().includes(s) ||
        r.excelEmail.toLowerCase().includes(s) ||
        r.excelPhone.includes(searchText) ||
        (r.localContactName || '').toLowerCase().includes(s) ||
        Object.values(r.extraColumns || {}).some(v => v.toLowerCase().includes(s))
      );
    }

    return filtered;
  }, [results, statusFilter, searchText]);

  const handleExport = useCallback(() => {
    const exportData = filteredResults.map(r => {
      const base: Record<string, string> = {
        'Nome (Planilha)': r.excelName,
        'Email (Planilha)': r.excelEmail,
        'Telefone (Planilha)': r.excelPhone,
        'Status': r.matchStatus === 'found_in_current' ? 'Já nesta pipeline'
          : r.matchStatus === 'found_elsewhere' ? 'Em outra pipeline'
          : 'Não encontrado',
        'Pipeline Origem': r.originName || '',
        'Nome (Sistema)': r.localContactName || '',
        'Email (Sistema)': r.localContactEmail || '',
        'Telefone (Sistema)': r.localContactPhone || '',
        'Estágio': r.localStageName || '',
      };
      // Add extra columns
      if (r.extraColumns) {
        for (const [key, val] of Object.entries(r.extraColumns)) {
          base[key] = val;
        }
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comparação');
    XLSX.writeFile(wb, 'comparacao_global.xlsx');
  }, [filteredResults]);

  const handleReset = () => {
    setStep('upload');
    setHeaders([]);
    setRawData([]);
    setResults([]);
    setStatusFilter('all');
    setSearchText('');
    setColumnMapping({ name: '', email: '', phone: '' });
    setPastedText('');
    setSelectedOwner(null);
    setIsComparing(false);
    setIsImporting(false);
    setCustomTag('');
    setSelectedStageId('__default__');
    setAssignMode('single');
    setSelectedDestinationOriginId('');
  };

  const getStatusIcon = (status: SpreadsheetRow['matchStatus']) => {
    switch (status) {
      case 'found_in_current':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'found_elsewhere':
        return <ArrowRightLeft className="h-4 w-4 text-amber-500" />;
      case 'not_found':
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusLabel = (status: SpreadsheetRow['matchStatus']) => {
    switch (status) {
      case 'found_in_current': return 'Nesta pipeline';
      case 'found_elsewhere': return 'Outra pipeline';
      case 'not_found': return 'Novo';
    }
  };

  const canImport = assignMode === 'distribute'
    ? (consorcioSdrs?.length ?? 0) > 0
    : !!selectedOwner;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha — Busca Global
          </DialogTitle>
          <DialogDescription>
            Busca contatos em TODA a base (todas as pipelines) e importa para a pipeline atual
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <Tabs defaultValue="file" className="w-full">
            <TabsList className="w-full">
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

            {extraColumnHeaders.length > 0 && (
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded border">
                <span className="font-medium">Colunas extras detectadas:</span>{' '}
                {extraColumnHeaders.join(', ')}
                <br />
                <span className="text-muted-foreground">Estas colunas serão preservadas e exibidas nos resultados.</span>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleReset}>Voltar</Button>
              <Button size="sm" onClick={handleCompare} disabled={isComparing}>
                {isComparing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Buscando na base...
                    {batchProgress && ` (${batchProgress.current}/${batchProgress.total})`}
                  </>
                ) : (
                  'Comparar (busca global)'
                )}
              </Button>
            </div>

            {isComparing && batchProgress && (
              <div className="space-y-1">
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Buscando {batchProgress.current} de {batchProgress.total} contatos...
                </p>
              </div>
            )}
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
              <Badge className="bg-green-500/20 text-green-700 cursor-pointer hover:bg-green-500/30" onClick={() => setStatusFilter('found_in_current')}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Nesta pipeline: {counts.inCurrent}
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-700 cursor-pointer hover:bg-amber-500/30" onClick={() => setStatusFilter('found_elsewhere')}>
                <ArrowRightLeft className="h-3 w-3 mr-1" /> Outra pipeline: {counts.elsewhere}
              </Badge>
              <Badge className="bg-red-500/20 text-red-700 cursor-pointer hover:bg-red-500/30" onClick={() => setStatusFilter('not_found')}>
                <XCircle className="h-3 w-3 mr-1" /> Novos: {counts.notFound}
              </Badge>
            </div>

            {/* Destination pipeline selector (only when BU has multiple origins) */}
            {activeBU && buFilteredOrigins && buFilteredOrigins.length > 1 && (
              <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex flex-col flex-1 gap-1">
                  <label className="text-xs font-medium">Pipeline de destino</label>
                  <Select
                    value={activeOriginId || ''}
                    onValueChange={setSelectedDestinationOriginId}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar pipeline de destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {buFilteredOrigins.map((origin: any) => (
                        <SelectItem key={origin.id} value={origin.id}>{origin.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Tag + Stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tag (opcional)
                </label>
                <Input
                  placeholder="Ex: sem carta consórcio"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Estágio (opcional)</label>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Primeiro estágio (padrão)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Primeiro estágio (padrão)</SelectItem>
                    {pipelineStages?.map((stage: any) => (
                      <SelectItem key={stage.id} value={stage.id}>{stage.stage_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assignment Mode + SDR Selector + Import */}
            <div className="flex flex-col gap-2 p-3 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium">Modo de atribuição:</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={assignMode === 'single' ? 'default' : 'outline'}
                    className="text-xs h-7 px-3"
                    onClick={() => setAssignMode('single')}
                  >
                    SDR único
                  </Button>
                  <Button
                    size="sm"
                    variant={assignMode === 'distribute' ? 'default' : 'outline'}
                    className="text-xs h-7 px-3"
                    onClick={() => setAssignMode('distribute')}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Distribuir igualmente
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {assignMode === 'single' ? (
                  <Select value={selectedOwner || ''} onValueChange={setSelectedOwner}>
                    <SelectTrigger className="h-8 text-xs w-[250px]">
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
                ) : (
                  <div className="text-xs text-muted-foreground">
                    {consorcioSdrs?.length
                      ? `${consorcioSdrs.length} SDRs do Consórcio: ${consorcioSdrs.map(s => s.name.split(' ')[0]).join(', ')}`
                      : 'Carregando SDRs...'}
                  </div>
                )}
                <Button
                  size="sm"
                  className="text-xs h-8 ml-auto"
                  onClick={handleSmartImport}
                  disabled={!canImport || isImporting || results.length === 0}
                >
                  {isImporting ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Importando...</>
                  ) : (
                    <>Importar {results.length} leads</>
                  )}
                </Button>
              </div>
            </div>

            {/* What will happen */}
            {canImport && (
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded border space-y-1">
                <p className="font-medium">Ao importar:</p>
                {counts.inCurrent > 0 && <p>• {counts.inCurrent} leads já nesta pipeline → <strong>transferir owner</strong></p>}
                {counts.elsewhere > 0 && <p>• {counts.elsewhere} contatos de outras pipelines → <strong>criar deal aqui</strong> (sem duplicar contato)</p>}
                {counts.notFound > 0 && <p>• {counts.notFound} novos → <strong>criar contato + deal</strong></p>}
                {customTag && <p>• Tag: <Badge variant="outline" className="text-xs">{customTag}</Badge></p>}
                {selectedStageId && selectedStageId !== '__default__' && pipelineStages && (
                  <p>• Estágio: <strong>{pipelineStages.find((s: any) => s.id === selectedStageId)?.stage_name}</strong></p>
                )}
                {assignMode === 'distribute' && consorcioSdrs && (
                  <p>• Distribuição round-robin entre {consorcioSdrs.length} SDRs</p>
                )}
              </div>
            )}

            {/* Progress */}
            {isImporting && batchProgress && (
              <div className="space-y-1">
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Etapa {batchProgress.current} de {batchProgress.total}...
                </p>
              </div>
            )}

            {/* Search + Export */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, telefone ou colunas extras..."
                  className="pl-8 h-8 text-xs"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
            </div>

            {/* Table */}
            <div className="border rounded-lg max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sticky left-0 bg-background z-10">Status</TableHead>
                    <TableHead className="text-xs">Nome (Planilha)</TableHead>
                    <TableHead className="text-xs">Tel (Planilha)</TableHead>
                    {extraColumnHeaders.map(h => (
                      <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                    ))}
                    <TableHead className="text-xs">Nome (Sistema)</TableHead>
                    <TableHead className="text-xs">Tel (Sistema)</TableHead>
                    <TableHead className="text-xs">Pipeline / Estágio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.slice(0, 200).map((row, i) => (
                    <TableRow key={i} className={row.matchStatus === 'not_found' ? 'opacity-60' : ''}>
                      <TableCell className="py-1 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(row.matchStatus)}
                          <span className="text-xs">{getStatusLabel(row.matchStatus)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-1">{row.excelName}</TableCell>
                      <TableCell className="text-xs py-1">{row.excelPhone}</TableCell>
                      {extraColumnHeaders.map(h => (
                        <TableCell key={h} className="text-xs py-1 whitespace-nowrap">
                          {row.extraColumns?.[h] || '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs py-1">{row.localContactName || '—'}</TableCell>
                      <TableCell className="text-xs py-1">{row.localContactPhone || '—'}</TableCell>
                      <TableCell className="text-xs py-1">
                        {row.matchStatus === 'found_in_current' && row.localStageName ? (
                          <Badge variant="outline" className="text-xs">{row.localStageName}</Badge>
                        ) : row.matchStatus === 'found_elsewhere' && row.originName ? (
                          <Badge className="bg-amber-500/20 text-amber-700 text-xs">{row.originName}</Badge>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredResults.length > 200 && (
                    <TableRow>
                      <TableCell colSpan={6 + extraColumnHeaders.length} className="text-center text-xs text-muted-foreground py-2">
                        Mostrando 200 de {filteredResults.length} resultados.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredResults.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6 + extraColumnHeaders.length} className="text-center text-xs text-muted-foreground py-4">
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
