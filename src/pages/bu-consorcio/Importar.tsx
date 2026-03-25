import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface ParsedRow {
  consorciado: string;
  contrato?: string;
  parcela?: number;
  valor_comissao?: number;
  data_interface?: string;
  vendedor_name?: string;
  status?: string;
  isDuplicate?: boolean;
  allowDuplicate?: boolean;
}

interface ColumnMapping {
  consorciado: string;
  contrato: string;
  parcela: string;
  valor_comissao: string;
  data_interface: string;
  vendedor_name: string;
  status: string;
}

function parseDate(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  if (typeof value === 'string') {
    const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return value;
  }
  return undefined;
}

function parseNumber(value: any): number | undefined {
  if (!value) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.,\-]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

export default function ImportarConsorcioPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    consorciado: '',
    contrato: '',
    parcela: '',
    valor_comissao: '',
    data_interface: '',
    vendedor_name: '',
    status: ''
  });
  const [previewData, setPreviewData] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesReviewed, setDuplicatesReviewed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [importStats, setImportStats] = useState<{ imported: number; blocked: number } | null>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        toast.error('Arquivo vazio ou inválido');
        return;
      }

      const fileHeaders = (jsonData[0] as string[]).map(h => String(h || '').trim());
      const rows = jsonData.slice(1) as any[];

      setHeaders(fileHeaders);
      setRawData(rows);
      setStep('mapping');

      const autoMapping: ColumnMapping = {
        consorciado: '',
        contrato: '',
        parcela: '',
        valor_comissao: '',
        data_interface: '',
        vendedor_name: '',
        status: ''
      };

      fileHeaders.forEach((header) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('consorciado') || lowerHeader.includes('cliente') || lowerHeader.includes('nome')) {
          if (!autoMapping.consorciado) autoMapping.consorciado = header;
        }
        if (lowerHeader.includes('contrato') || lowerHeader.includes('grupo')) {
          if (!autoMapping.contrato) autoMapping.contrato = header;
        }
        if (lowerHeader.includes('parcela')) {
          if (!autoMapping.parcela) autoMapping.parcela = header;
        }
        if (lowerHeader.includes('valor') || lowerHeader.includes('comiss')) {
          if (!autoMapping.valor_comissao) autoMapping.valor_comissao = header;
        }
        if (lowerHeader.includes('data') || lowerHeader.includes('date')) {
          if (!autoMapping.data_interface) autoMapping.data_interface = header;
        }
        if (lowerHeader.includes('vendedor') || lowerHeader.includes('representante')) {
          if (!autoMapping.vendedor_name) autoMapping.vendedor_name = header;
        }
        if (lowerHeader.includes('status') || lowerHeader.includes('situacao')) {
          if (!autoMapping.status) autoMapping.status = header;
        }
      });

      setMapping(autoMapping);
      toast.success('Arquivo carregado! Configure o mapeamento das colunas.');
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Erro ao ler arquivo');
    }
  }, []);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value === '__none__' ? '' : value }));
  };

  const handlePreview = async () => {
    if (!mapping.consorciado) {
      toast.error('Selecione ao menos a coluna de Consorciado');
      return;
    }

    setCheckingDuplicates(true);
    setDuplicatesReviewed(false);

    try {
      // Parse ALL rows
      const parsed: ParsedRow[] = rawData.map(row => {
        const getColValue = (colName: string) => {
          const index = headers.indexOf(colName);
          return index >= 0 ? row[index] : undefined;
        };

        return {
          consorciado: String(getColValue(mapping.consorciado) || ''),
          contrato: mapping.contrato ? String(getColValue(mapping.contrato) || '') : undefined,
          parcela: mapping.parcela ? parseNumber(getColValue(mapping.parcela)) : undefined,
          valor_comissao: mapping.valor_comissao ? parseNumber(getColValue(mapping.valor_comissao)) : undefined,
          data_interface: mapping.data_interface ? parseDate(getColValue(mapping.data_interface)) : undefined,
          vendedor_name: mapping.vendedor_name ? String(getColValue(mapping.vendedor_name) || '') : undefined,
          status: mapping.status ? String(getColValue(mapping.status) || '') : undefined,
          isDuplicate: false,
          allowDuplicate: false,
        };
      }).filter(r => r.consorciado);

      // Batch check duplicates in sets of 200
      const allNames = [...new Set(parsed.map(r => r.consorciado.trim()))].filter(Boolean);
      const existingNames = new Set<string>();
      const batchSize = 200;

      for (let i = 0; i < allNames.length; i += batchSize) {
        const batch = allNames.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('consortium_payments')
          .select('consorciado')
          .in('consorciado', batch);

        if (error) throw error;
        if (data) {
          data.forEach(r => existingNames.add(r.consorciado.trim()));
        }
      }

      // Mark duplicates
      const withDuplicates = parsed.map(r => ({
        ...r,
        isDuplicate: existingNames.has(r.consorciado.trim()),
        allowDuplicate: false,
      }));

      setPreviewData(withDuplicates);
      setStep('preview');

      const dupCount = withDuplicates.filter(r => r.isDuplicate).length;
      if (dupCount > 0) {
        toast.warning(`${dupCount} nome(s) duplicado(s) encontrado(s). Revise antes de importar.`);
      } else {
        setDuplicatesReviewed(true);
      }
    } catch (error: any) {
      console.error('Error checking duplicates:', error);
      toast.error('Erro ao verificar duplicados');
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const toggleAllowDuplicate = (index: number) => {
    setPreviewData(prev => prev.map((r, i) =>
      i === index ? { ...r, allowDuplicate: !r.allowDuplicate } : r
    ));
    setDuplicatesReviewed(false);
  };

  const blockAllDuplicates = () => {
    setPreviewData(prev => prev.map(r => r.isDuplicate ? { ...r, allowDuplicate: false } : r));
    setDuplicatesReviewed(false);
  };

  const confirmDuplicateReview = () => {
    setDuplicatesReviewed(true);
    toast.success('Revisão confirmada. Você pode prosseguir com a importação.');
  };

  const handleImport = async () => {
    if (!mapping.consorciado) {
      toast.error('Mapeamento inválido');
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const toImport = previewData.filter(r => !r.isDuplicate || r.allowDuplicate);
      const blockedCount = previewData.filter(r => r.isDuplicate && !r.allowDuplicate).length;
      const batchSize = 50;
      let imported = 0;

      for (let i = 0; i < toImport.length; i += batchSize) {
        const batch = toImport.slice(i, i + batchSize);

        const records = batch.map(r => ({
          consorciado: r.consorciado,
          contrato: r.contrato || null,
          parcela: r.parcela ?? null,
          valor_comissao: r.valor_comissao ?? null,
          data_interface: r.data_interface || null,
          vendedor_name: r.vendedor_name || null,
          status: r.status || null,
        }));

        const { error } = await supabase
          .from('consortium_payments')
          .insert(records);

        if (error) throw error;

        imported += batch.length;
        setProgress((imported / toImport.length) * 100);
      }

      setImportStats({ imported, blocked: blockedCount });
      setStep('complete');
      toast.success(`${imported} registros importados com sucesso!`);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erro na importação: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const duplicateRows = previewData.filter(r => r.isDuplicate);
  const hasDuplicates = duplicateRows.length > 0;
  const canImport = !hasDuplicates || duplicatesReviewed;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/consorcio')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Importar Consórcio</h1>
          <p className="text-muted-foreground mt-1">Importe dados de cartas de consórcio via Excel/CSV</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4 mb-8">
        {['upload', 'mapping', 'preview', 'complete'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s
                ? 'bg-primary text-primary-foreground'
                : i < ['upload', 'mapping', 'preview', 'complete'].indexOf(step)
                  ? 'bg-green-500 text-white'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {i < ['upload', 'mapping', 'preview', 'complete'].indexOf(step) ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className={step === s ? 'font-medium text-foreground' : 'text-muted-foreground'}>
              {s === 'upload' && 'Upload'}
              {s === 'mapping' && 'Mapeamento'}
              {s === 'preview' && 'Revisão'}
              {s === 'complete' && 'Concluído'}
            </span>
            {i < 3 && <div className="w-12 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Selecione o arquivo
            </CardTitle>
            <CardDescription>
              Faça upload de um arquivo Excel (.xlsx, .xls) ou CSV com os dados do consórcio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-primary hover:underline">Clique para selecionar</span>
                <span className="text-muted-foreground"> ou arraste o arquivo aqui</span>
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeamento de Colunas</CardTitle>
            <CardDescription>
              Relacione as colunas do seu arquivo com os campos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Consorciado / Cliente *</Label>
                <Select value={mapping.consorciado} onValueChange={(v) => handleMappingChange('consorciado', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contrato / Grupo</Label>
                <Select value={mapping.contrato} onValueChange={(v) => handleMappingChange('contrato', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não mapear</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Parcela</Label>
                <Select value={mapping.parcela} onValueChange={(v) => handleMappingChange('parcela', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não mapear</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor Comissão</Label>
                <Select value={mapping.valor_comissao} onValueChange={(v) => handleMappingChange('valor_comissao', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não mapear</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Select value={mapping.data_interface} onValueChange={(v) => handleMappingChange('data_interface', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não mapear</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={mapping.vendedor_name} onValueChange={(v) => handleMappingChange('vendedor_name', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não mapear</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={mapping.status} onValueChange={(v) => handleMappingChange('status', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Não mapear</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button onClick={handlePreview} disabled={checkingDuplicates}>
                {checkingDuplicates ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando duplicados...
                  </>
                ) : (
                  'Visualizar Dados'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* Duplicate Approval Panel */}
          {hasDuplicates && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  {duplicateRows.length} nome(s) duplicado(s) encontrado(s)
                </CardTitle>
                <CardDescription>
                  Esses registros já existem no banco de dados. Revise cada um e decida se deve ser <strong>bloqueado</strong> ou <strong>permitido</strong>. Após revisar, confirme para liberar a importação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Contrato</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.map((row, i) => {
                        if (!row.isDuplicate) return null;
                        return (
                          <TableRow key={i} className="bg-destructive/5">
                            <TableCell className="font-medium">{row.consorciado}</TableCell>
                            <TableCell className="text-muted-foreground">{row.contrato || '—'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-3">
                                <span className={`text-xs font-medium ${row.allowDuplicate ? 'text-chart-4' : 'text-destructive'}`}>
                                  {row.allowDuplicate ? (
                                    <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Permitido</span>
                                  ) : (
                                    <span className="flex items-center gap-1"><ShieldX className="h-3 w-3" /> Bloqueado</span>
                                  )}
                                </span>
                                <Switch
                                  checked={row.allowDuplicate}
                                  onCheckedChange={() => toggleAllowDuplicate(i)}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-sm text-muted-foreground">
                    <span className="text-destructive font-medium">
                      {duplicateRows.filter(r => !r.allowDuplicate).length} bloqueado(s)
                    </span>
                    {' · '}
                    <span className="text-chart-4 font-medium">
                      {duplicateRows.filter(r => r.allowDuplicate).length} permitido(s)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={blockAllDuplicates}>
                      <ShieldX className="h-3.5 w-3.5 mr-1" />
                      Bloquear Todos
                    </Button>
                    <Button size="sm" onClick={confirmDuplicateReview} disabled={duplicatesReviewed}>
                      {duplicatesReviewed ? (
                        <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Revisão Confirmada</>
                      ) : (
                        'Confirmar Revisão'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preview Table */}
          <Card>
            <CardHeader>
              <CardTitle>Prévia dos Dados</CardTitle>
              <CardDescription>
                {previewData.length} registros — exibindo os primeiros 50
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Consorciado</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Valor Comissão</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Vendedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 50).map((row, i) => (
                      <TableRow
                        key={i}
                        className={row.isDuplicate && !row.allowDuplicate ? 'bg-destructive/5 opacity-70' : ''}
                      >
                        <TableCell>
                          {row.isDuplicate ? (
                            row.allowDuplicate ? (
                              <Badge variant="outline" className="border-chart-4 text-chart-4">Permitido</Badge>
                            ) : (
                              <Badge variant="destructive">Bloqueado</Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="border-chart-2 text-chart-2">Novo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.consorciado}</TableCell>
                        <TableCell>{row.contrato || '-'}</TableCell>
                        <TableCell>{row.parcela || '-'}</TableCell>
                        <TableCell>
                          {row.valor_comissao
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_comissao)
                            : '-'}
                        </TableCell>
                        <TableCell>{row.data_interface || '-'}</TableCell>
                        <TableCell>{row.vendedor_name || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">
                  Total: <strong>{previewData.length}</strong>
                </span>
                <span className="text-chart-2">
                  Novos: <strong>{previewData.filter(r => !r.isDuplicate).length}</strong>
                </span>
                {hasDuplicates && (
                  <>
                    <span className="text-destructive">
                      Bloqueados: <strong>{previewData.filter(r => r.isDuplicate && !r.allowDuplicate).length}</strong>
                    </span>
                    <span className="text-chart-4">
                      Duplicados permitidos: <strong>{previewData.filter(r => r.isDuplicate && r.allowDuplicate).length}</strong>
                    </span>
                  </>
                )}
              </div>

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Importando... {Math.round(progress)}%
                  </p>
                </div>
              )}

              {hasDuplicates && !duplicatesReviewed && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border text-foreground text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Confirme a revisão dos duplicados acima para liberar a importação.
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('mapping')} disabled={importing}>
                  Voltar
                </Button>
                <Button onClick={handleImport} disabled={importing || !canImport}>
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    'Importar Dados'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-chart-2 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Importação Concluída!</h2>
            <p className="text-muted-foreground mb-6">
              Os dados foram processados com sucesso.
            </p>

            {importStats && (
              <div className="inline-flex flex-col gap-2 mb-6 text-left bg-muted/50 rounded-lg p-4 min-w-48">
                <div className="flex items-center gap-2 text-chart-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">{importStats.imported} registros importados</span>
                </div>
                {importStats.blocked > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <ShieldX className="h-4 w-4" />
                    <span className="font-medium">{importStats.blocked} bloqueados por duplicidade</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setFile(null);
                setHeaders([]);
                setRawData([]);
                setPreviewData([]);
                setProgress(0);
                setImportStats(null);
                setDuplicatesReviewed(false);
              }}>
                Nova Importação
              </Button>
              <Button onClick={() => navigate('/consorcio')}>
                Ver Consórcios
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
