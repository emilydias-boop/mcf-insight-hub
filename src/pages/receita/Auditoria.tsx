import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Download } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

interface SpreadsheetRow {
  date: string;
  product: string;
  customer: string;
  email: string;
  phone: string;
  installment: number;
  grossValue: number;
  netValue: number;
}

interface ComparisonResult {
  id: string;
  spreadsheet: SpreadsheetRow;
  database: {
    hubla_id: string;
    product_name: string;
    product_price: number;
    net_value: number;
    customer_name: string;
    customer_email: string;
    sale_date: string;
  } | null;
  status: "correct" | "missing" | "divergent" | "duplicate";
  divergences: string[];
  selected: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export default function Auditoria() {
  const [file, setFile] = useState<File | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetRow[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  // Fetch transactions from database when we have a date range
  const { data: dbTransactions, refetch: refetchTransactions } = useQuery({
    queryKey: ["audit-transactions", dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!dateRange.start || !dateRange.end) return [];
      
      const { data, error } = await supabase
        .from("hubla_transactions")
        .select("*")
        .gte("sale_date", dateRange.start)
        .lte("sale_date", dateRange.end + "T23:59:59")
        .order("sale_date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!dateRange.start && !!dateRange.end,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    setIsProcessing(true);
    
    try {
      const data = await parseSpreadsheet(uploadedFile);
      setSpreadsheetData(data);
      
      // Calculate date range from spreadsheet
      if (data.length > 0) {
        const dates = data.map(row => row.date).sort();
        setDateRange({
          start: dates[0],
          end: dates[dates.length - 1],
        });
      }
      
      toast.success(`${data.length} transações importadas da planilha`);
    } catch (error: any) {
      toast.error(`Erro ao processar arquivo: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const parseSpreadsheet = async (file: File): Promise<SpreadsheetRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          // Skip header row and parse data
          const rows: SpreadsheetRow[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 6) continue;
            
            // Parse date - handle Excel date serial numbers
            let dateStr = "";
            const dateVal = row[0];
            if (typeof dateVal === "number") {
              // Excel date serial number
              const excelDate = XLSX.SSF.parse_date_code(dateVal);
              dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
            } else if (typeof dateVal === "string") {
              // Try to parse DD/MM/YYYY or YYYY-MM-DD
              if (dateVal.includes("/")) {
                const parts = dateVal.split("/");
                dateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
              } else {
                dateStr = dateVal;
              }
            }
            
            // Parse currency values
            const parseValue = (val: any): number => {
              if (typeof val === "number") return val;
              if (typeof val === "string") {
                // Remove R$, spaces, and convert comma to dot
                const cleaned = val.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
                return parseFloat(cleaned) || 0;
              }
              return 0;
            };
            
            rows.push({
              date: dateStr,
              product: String(row[1] || ""),
              customer: String(row[2] || ""),
              email: String(row[3] || "").toLowerCase().trim(),
              phone: String(row[4] || ""),
              installment: parseInt(row[5]) || 1,
              grossValue: parseValue(row[6]),
              netValue: parseValue(row[7]),
            });
          }
          
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsBinaryString(file);
    });
  };

  const compareData = async () => {
    if (!spreadsheetData.length || !dbTransactions) {
      toast.error("Carregue uma planilha e aguarde os dados do banco");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const results: ComparisonResult[] = [];
      
      for (const row of spreadsheetData) {
        // Find matching transaction in database
        // Match by email + date (±1 day tolerance) + similar product
        const matchingTx = dbTransactions.find(tx => {
          const emailMatch = tx.customer_email?.toLowerCase() === row.email.toLowerCase();
          const txDate = tx.sale_date?.split("T")[0];
          const dateMatch = Math.abs(new Date(txDate).getTime() - new Date(row.date).getTime()) <= 86400000; // 1 day tolerance
          return emailMatch && dateMatch;
        });
        
        if (!matchingTx) {
          results.push({
            id: `missing-${row.email}-${row.date}`,
            spreadsheet: row,
            database: null,
            status: "missing",
            divergences: ["Transação não encontrada no banco de dados"],
            selected: true,
          });
          continue;
        }
        
        // Check for divergences
        const divergences: string[] = [];
        
        // Check gross value (product_price) - tolerance of 5%
        const priceDiff = Math.abs((matchingTx.product_price || 0) - row.grossValue);
        const priceThreshold = row.grossValue * 0.05;
        if (priceDiff > priceThreshold && row.grossValue > 0) {
          divergences.push(`Valor bruto: Planilha R$ ${row.grossValue} vs Banco R$ ${matchingTx.product_price}`);
        }
        
        // Check net value - tolerance of 5%
        const netDiff = Math.abs((matchingTx.net_value || 0) - row.netValue);
        const netThreshold = row.netValue * 0.05;
        if (netDiff > netThreshold && row.netValue > 0) {
          divergences.push(`Valor líquido: Planilha R$ ${row.netValue.toFixed(2)} vs Banco R$ ${(matchingTx.net_value || 0).toFixed(2)}`);
        }
        
        results.push({
          id: matchingTx.hubla_id,
          spreadsheet: row,
          database: {
            hubla_id: matchingTx.hubla_id,
            product_name: matchingTx.product_name,
            product_price: matchingTx.product_price || 0,
            net_value: matchingTx.net_value || 0,
            customer_name: matchingTx.customer_name || "",
            customer_email: matchingTx.customer_email || "",
            sale_date: matchingTx.sale_date,
          },
          status: divergences.length > 0 ? "divergent" : "correct",
          divergences,
          selected: divergences.length > 0,
        });
      }
      
      setComparisonResults(results);
      toast.success(`Comparação concluída: ${results.length} transações analisadas`);
    } catch (error: any) {
      toast.error(`Erro na comparação: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyCorrections = async () => {
    const selectedCorrections = comparisonResults.filter(r => r.selected && (r.status === "missing" || r.status === "divergent"));
    
    if (selectedCorrections.length === 0) {
      toast.error("Selecione pelo menos uma correção para aplicar");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("apply-audit-corrections", {
        body: {
          corrections: selectedCorrections.map(c => ({
            type: c.status,
            spreadsheet: c.spreadsheet,
            database: c.database,
          })),
        },
      });
      
      if (error) throw error;
      
      toast.success(`${data.applied} correções aplicadas com sucesso`);
      
      // Refresh data
      refetchTransactions();
      compareData();
    } catch (error: any) {
      toast.error(`Erro ao aplicar correções: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    setComparisonResults(prev => 
      prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r)
    );
  };

  const selectAll = (status: "missing" | "divergent") => {
    setComparisonResults(prev =>
      prev.map(r => r.status === status ? { ...r, selected: true } : r)
    );
  };

  const summary = useMemo(() => {
    const correct = comparisonResults.filter(r => r.status === "correct").length;
    const missing = comparisonResults.filter(r => r.status === "missing").length;
    const divergent = comparisonResults.filter(r => r.status === "divergent").length;
    const selected = comparisonResults.filter(r => r.selected && (r.status === "missing" || r.status === "divergent")).length;
    
    return { correct, missing, divergent, selected };
  }, [comparisonResults]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auditoria de Receitas</h1>
          <p className="text-muted-foreground">Compare dados da planilha com o banco de dados</p>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="file-upload">Arquivo CSV ou Excel</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
                {file && (
                  <Badge variant="secondary">{file.name}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Formato esperado: Data | Produto | Cliente | Email | Telefone | Parcela | Valor Bruto | Valor Líquido
              </p>
            </div>
          </div>

          {spreadsheetData.length > 0 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm">
                <span className="font-medium">{spreadsheetData.length}</span> transações carregadas
                {dateRange.start && (
                  <span className="text-muted-foreground ml-2">
                    ({dateRange.start} a {dateRange.end})
                  </span>
                )}
              </div>
              <Button onClick={compareData} disabled={isProcessing}>
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Comparar com Banco
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {comparisonResults.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.correct}</p>
                  <p className="text-sm text-muted-foreground">Corretas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.divergent}</p>
                  <p className="text-sm text-muted-foreground">Divergentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.missing}</p>
                  <p className="text-sm text-muted-foreground">Faltantes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{summary.selected}</p>
                  <p className="text-sm text-muted-foreground">Selecionadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comparison Results Table */}
      {comparisonResults.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Resultados da Comparação</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => selectAll("missing")}>
                Selecionar Faltantes
              </Button>
              <Button variant="outline" size="sm" onClick={() => selectAll("divergent")}>
                Selecionar Divergentes
              </Button>
              <Button 
                onClick={applyCorrections} 
                disabled={isProcessing || summary.selected === 0}
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Aplicar {summary.selected} Correções
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Planilha (Bruto)</TableHead>
                  <TableHead className="text-right">Banco (Bruto)</TableHead>
                  <TableHead>Divergências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonResults
                  .filter(r => r.status !== "correct")
                  .map((result) => (
                    <TableRow key={result.id} className={result.status === "missing" ? "bg-red-50" : result.status === "divergent" ? "bg-yellow-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={result.selected}
                          onCheckedChange={() => toggleSelection(result.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {result.status === "correct" && (
                          <Badge variant="outline" className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                        {result.status === "missing" && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Faltante
                          </Badge>
                        )}
                        {result.status === "divergent" && (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Divergente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {result.spreadsheet.date}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={result.spreadsheet.customer}>
                          {result.spreadsheet.customer}
                        </div>
                        <div className="text-xs text-muted-foreground truncate" title={result.spreadsheet.email}>
                          {result.spreadsheet.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[150px] truncate" title={result.spreadsheet.product}>
                          {result.spreadsheet.product}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(result.spreadsheet.grossValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {result.database ? formatCurrency(result.database.product_price) : "-"}
                      </TableCell>
                      <TableCell>
                        {result.divergences.length > 0 && (
                          <div className="text-xs text-muted-foreground max-w-[200px]">
                            {result.divergences.map((d, i) => (
                              <div key={i} className="truncate" title={d}>{d}</div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            
            {comparisonResults.filter(r => r.status === "correct").length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {comparisonResults.filter(r => r.status === "correct").length} transações corretas não exibidas
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
