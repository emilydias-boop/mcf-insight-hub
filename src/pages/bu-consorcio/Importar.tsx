import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  
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
      
      // Try to auto-map common column names
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
    setMapping(prev => ({ ...prev, [field]: value }));
  };
  
  const handlePreview = () => {
    if (!mapping.consorciado) {
      toast.error('Selecione ao menos a coluna de Consorciado');
      return;
    }
    
    const parsed: ParsedRow[] = rawData.slice(0, 10).map(row => {
      const getColValue = (colName: string) => {
        const index = headers.indexOf(colName);
        return index >= 0 ? row[index] : undefined;
      };
      
      const parseDate = (value: any): string | undefined => {
        if (!value) return undefined;
        if (typeof value === 'number') {
          // Excel serial date
          const date = new Date((value - 25569) * 86400 * 1000);
          return date.toISOString().split('T')[0];
        }
        if (typeof value === 'string') {
          // Try DD/MM/YYYY format
          const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (match) {
            return `${match[3]}-${match[2]}-${match[1]}`;
          }
          return value;
        }
        return undefined;
      };
      
      const parseNumber = (value: any): number | undefined => {
        if (!value) return undefined;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const cleaned = value.replace(/[^\d.,\-]/g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          return isNaN(num) ? undefined : num;
        }
        return undefined;
      };
      
      return {
        consorciado: String(getColValue(mapping.consorciado) || ''),
        contrato: mapping.contrato ? String(getColValue(mapping.contrato) || '') : undefined,
        parcela: mapping.parcela ? parseNumber(getColValue(mapping.parcela)) : undefined,
        valor_comissao: mapping.valor_comissao ? parseNumber(getColValue(mapping.valor_comissao)) : undefined,
        data_interface: mapping.data_interface ? parseDate(getColValue(mapping.data_interface)) : undefined,
        vendedor_name: mapping.vendedor_name ? String(getColValue(mapping.vendedor_name) || '') : undefined,
        status: mapping.status ? String(getColValue(mapping.status) || '') : undefined
      };
    });
    
    setPreviewData(parsed);
    setStep('preview');
  };
  
  const handleImport = async () => {
    if (!mapping.consorciado) {
      toast.error('Mapeamento inválido');
      return;
    }
    
    setImporting(true);
    setProgress(0);
    
    try {
      const totalRows = rawData.length;
      const batchSize = 50;
      let imported = 0;
      
      for (let i = 0; i < totalRows; i += batchSize) {
        const batch = rawData.slice(i, i + batchSize);
        
        const records = batch.map(row => {
          const getColValue = (colName: string) => {
            const index = headers.indexOf(colName);
            return index >= 0 ? row[index] : undefined;
          };
          
          const parseDate = (value: any): string | undefined => {
            if (!value) return undefined;
            if (typeof value === 'number') {
              const date = new Date((value - 25569) * 86400 * 1000);
              return date.toISOString().split('T')[0];
            }
            if (typeof value === 'string') {
              const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (match) {
                return `${match[3]}-${match[2]}-${match[1]}`;
              }
              return value;
            }
            return undefined;
          };
          
          const parseNumber = (value: any): number | undefined => {
            if (!value) return undefined;
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
              const cleaned = value.replace(/[^\d.,\-]/g, '').replace(',', '.');
              const num = parseFloat(cleaned);
              return isNaN(num) ? undefined : num;
            }
            return undefined;
          };
          
          return {
            consorciado: String(getColValue(mapping.consorciado) || ''),
            contrato: mapping.contrato ? String(getColValue(mapping.contrato) || '') : null,
            parcela: mapping.parcela ? parseNumber(getColValue(mapping.parcela)) : null,
            valor_comissao: mapping.valor_comissao ? parseNumber(getColValue(mapping.valor_comissao)) : null,
            data_interface: mapping.data_interface ? parseDate(getColValue(mapping.data_interface)) : null,
            vendedor_name: mapping.vendedor_name ? String(getColValue(mapping.vendedor_name) || '') : null,
            status: mapping.status ? String(getColValue(mapping.status) || '') : null
          };
        }).filter(r => r.consorciado);
        
        const { error } = await supabase
          .from('consortium_payments')
          .insert(records);
        
        if (error) throw error;
        
        imported += batch.length;
        setProgress((imported / totalRows) * 100);
      }
      
      setStep('complete');
      toast.success(`${imported} registros importados com sucesso!`);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(`Erro na importação: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };
  
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
                    <SelectItem value="">Não mapear</SelectItem>
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
                    <SelectItem value="">Não mapear</SelectItem>
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
                    <SelectItem value="">Não mapear</SelectItem>
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
              <Button onClick={handlePreview}>
                Visualizar Dados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step 3: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Prévia dos Dados</CardTitle>
            <CardDescription>
              Confirme os primeiros 10 registros antes de importar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consorciado</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor Comissão</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.consorciado}</TableCell>
                      <TableCell>{row.contrato || '-'}</TableCell>
                      <TableCell>{row.parcela || '-'}</TableCell>
                      <TableCell>
                        {row.valor_comissao 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valor_comissao) 
                          : '-'}
                      </TableCell>
                      <TableCell>{row.data_interface || '-'}</TableCell>
                      <TableCell>{row.vendedor_name || '-'}</TableCell>
                      <TableCell>{row.status || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 inline mr-2" />
                Total de registros a importar: <strong>{rawData.length}</strong>
              </p>
            </div>
            
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Importando... {Math.round(progress)}%
                </p>
              </div>
            )}
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('mapping')} disabled={importing}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing}>
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
      )}
      
      {/* Step 4: Complete */}
      {step === 'complete' && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Importação Concluída!</h2>
            <p className="text-muted-foreground mb-6">
              Os dados foram importados com sucesso para o sistema.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => {
                setStep('upload');
                setFile(null);
                setHeaders([]);
                setRawData([]);
                setPreviewData([]);
                setProgress(0);
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
