import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { loadXLSX } from '@/lib/lazyExport';
import { formatCurrency } from '@/lib/formatters';
import { useImportarCotaStatus, LinhaImportacao, normalizarGrupoCota } from '@/hooks/useEmbraconClass';

/**
 * Importador do Power BI. O layout da planilha pode mudar, então o mapeamento de
 * colunas é feito na tela e nada é gravado antes da confirmação do usuário.
 */

const CAMPOS = [
  { key: 'grupo', label: 'Grupo', obrigatorio: true },
  { key: 'cota', label: 'Cota', obrigatorio: true },
  { key: 'contrato', label: 'Contrato', obrigatorio: false },
  { key: 'valor_bem', label: 'Valor do bem (crédito)', obrigatorio: true },
  { key: 'mes_producao', label: 'Período produção', obrigatorio: true },
  { key: 'status', label: 'Situação', obrigatorio: true },
  { key: 'parcelas_vencidas', label: 'Parcelas vencidas', obrigatorio: false },
  { key: 'plano', label: 'Plano', obrigatorio: false },
] as const;

type CampoKey = (typeof CAMPOS)[number]['key'];

const STATUS_MAP: Record<string, LinhaImportacao['status']> = {
  cancelada: 'cancelada',
  cancelado: 'cancelada',
  reativada: 'reativada',
  reativado: 'reativada',
  inadimplente: 'inadimplente',
  atrasada: 'inadimplente',
  atraso: 'inadimplente',
  'em atraso': 'inadimplente',
  ativa: 'ativa_em_dia',
  'ativa em dia': 'ativa_em_dia',
  'em dia': 'ativa_em_dia',
  adimplente: 'ativa_em_dia',
  n00: 'ativa_em_dia',
};

function normalizarStatus(v: unknown): LinhaImportacao['status'] | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return null;
  if (STATUS_MAP[s]) return STATUS_MAP[s];
  if (s.includes('cancel')) return 'cancelada';
  if (s.includes('reativ')) return 'reativada';
  if (s.includes('inadim') || s.includes('atras')) return 'inadimplente';
  if (s.includes('dia') || s.includes('ativ')) return 'ativa_em_dia';
  return null;
}

function numeroBR(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[^\d,.-]/g, '');
  // Formato brasileiro: 1.234.567,89
  const limpo = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Aceita 2026-03, 03/2026, mar/26, 01/03/2026 e datas do Excel. */
function primeiroDiaDoMes(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const s = String(v).trim();
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  let m = s.match(/^(\d{4})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-01`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-01`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}-01`;
  m = s.toLowerCase().match(/^([a-zç]{3})[a-zç]*[\/\s-](\d{2,4})$/);
  if (m) {
    const idx = meses.indexOf(m[1]);
    if (idx >= 0) {
      const ano = m[2].length === 2 ? `20${m[2]}` : m[2];
      return `${ano}-${String(idx + 1).padStart(2, '0')}-01`;
    }
  }
  return null;
}

export function EmbraconImportDialog() {
  const [open, setOpen] = useState(false);
  const [dataReferencia, setDataReferencia] = useState(new Date().toISOString().slice(0, 10));
  const [colunas, setColunas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<Record<string, unknown>[]>([]);
  const [mapa, setMapa] = useState<Record<CampoKey, string>>({} as Record<CampoKey, string>);
  const importar = useImportarCotaStatus();

  const handleFile = async (file: File) => {
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (!json.length) {
        toast.warning('A planilha não tem linhas de dados');
        return;
      }
      const cols = Object.keys(json[0]);
      setColunas(cols);
      setLinhas(json);
      // Tentativa de mapeamento automático por nome de coluna.
      const auto = {} as Record<CampoKey, string>;
      for (const campo of CAMPOS) {
        const alvo = campo.label.toLowerCase();
        const achou = cols.find((c) => {
          const l = c.toLowerCase();
          if (campo.key === 'valor_bem') return l.includes('bem') || l.includes('crédito') || l.includes('credito');
          if (campo.key === 'mes_producao') return l.includes('produç') || l.includes('produc');
          if (campo.key === 'status') return l.includes('situa') || l.includes('status');
          if (campo.key === 'parcelas_vencidas') return l.includes('vencid') || l.includes('atras');
          return l.includes(campo.key) || l.includes(alvo);
        });
        if (achou) auto[campo.key] = achou;
      }
      setMapa(auto);
    } catch (e: any) {
      toast.error('Não foi possível ler o arquivo: ' + (e?.message || 'formato inválido'));
    }
  };

  const preview = useMemo(() => {
    if (!linhas.length) return null;
    const validas: LinhaImportacao[] = [];
    const chaves = new Set<string>();
    let descartadas = 0;

    for (const row of linhas) {
      const grupo = String(row[mapa.grupo] ?? '').trim();
      const cota = String(row[mapa.cota] ?? '').trim();
      const status = normalizarStatus(row[mapa.status]);
      const mes = primeiroDiaDoMes(row[mapa.mes_producao]);
      if (!grupo || !cota || !status) {
        descartadas++;
        continue;
      }
      const chave = normalizarGrupoCota(grupo, cota);
      if (chaves.has(chave)) {
        descartadas++;
        continue;
      }
      chaves.add(chave);
      const [g, c] = chave.split('-');
      validas.push({
        data_referencia: dataReferencia,
        grupo: g,
        cota: c,
        contrato: mapa.contrato ? String(row[mapa.contrato] ?? '').trim() || null : null,
        valor_bem: numeroBR(row[mapa.valor_bem]),
        mes_producao: mes,
        status,
        parcelas_vencidas: mapa.parcelas_vencidas ? (numeroBR(row[mapa.parcelas_vencidas]) ?? null) : null,
        plano: mapa.plano ? String(row[mapa.plano] ?? '').trim() || null : null,
        fonte: 'power_bi',
      });
    }

    const porMes = new Map<string, { qtd: number; credito: number }>();
    for (const l of validas) {
      const k = l.mes_producao || 'sem mês';
      const atual = porMes.get(k) || { qtd: 0, credito: 0 };
      atual.qtd += 1;
      atual.credito += l.valor_bem || 0;
      porMes.set(k, atual);
    }

    return {
      validas,
      descartadas,
      canceladas: validas.filter((l) => l.status === 'cancelada').length,
      inadimplentes: validas.filter((l) => l.status === 'inadimplente').length,
      reativadas: validas.filter((l) => l.status === 'reativada').length,
      semMes: validas.filter((l) => !l.mes_producao).length,
      porMes: Array.from(porMes.entries()).sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [linhas, mapa, dataReferencia]);

  const faltando = CAMPOS.filter((c) => c.obrigatorio && !mapa[c.key]).map((c) => c.label);

  const confirmar = async () => {
    if (!preview?.validas.length) return;
    await importar.mutateAsync(preview.validas);
    setOpen(false);
    setLinhas([]);
    setColunas([]);
    setMapa({} as Record<CampoKey, string>);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="h-4 w-4" />
          Importar Power BI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar situação das cotas (Power BI)</DialogTitle>
          <DialogDescription>
            Confira o resumo antes de confirmar. Nada é gravado até você clicar em confirmar; a
            importação não altera cotas, parcelas nem cobranças.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Data de referência</Label>
              <Input type="date" value={dataReferencia} onChange={(e) => setDataReferencia(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo (CSV ou XLSX)</Label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>

          {colunas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Mapeamento de colunas</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CAMPOS.map((campo) => (
                  <div key={campo.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {campo.label}
                      {campo.obrigatorio && ' *'}
                    </Label>
                    <Select
                      value={mapa[campo.key] ?? ''}
                      onValueChange={(v) => setMapa((m) => ({ ...m, [campo.key]: v }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecionar coluna..." />
                      </SelectTrigger>
                      <SelectContent>
                        {colunas.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4" />
                Prévia — {preview.validas.length} cota(s) válida(s)
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="destructive">{preview.canceladas} canceladas</Badge>
                <Badge variant="secondary">{preview.inadimplentes} inadimplentes</Badge>
                <Badge variant="outline">{preview.reativadas} reativadas</Badge>
                {preview.descartadas > 0 && (
                  <Badge variant="outline">{preview.descartadas} linha(s) descartada(s)</Badge>
                )}
                {preview.semMes > 0 && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    {preview.semMes} sem mês de produção
                  </Badge>
                )}
              </div>
              <div className="max-h-52 overflow-y-auto text-xs">
                <table className="w-full">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left py-1">Mês de produção</th>
                      <th className="text-right py-1">Cotas</th>
                      <th className="text-right py-1">Valor do bem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.porMes.map(([mes, v]) => (
                      <tr key={mes} className="border-t border-border/50">
                        <td className="py-1">{mes.slice(0, 7)}</td>
                        <td className="py-1 text-right">{v.qtd}</td>
                        <td className="py-1 text-right">{formatCurrency(v.credito)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {faltando.length > 0 && (
                <p className="text-xs text-amber-600">Mapeie antes: {faltando.join(', ')}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={!preview?.validas.length || faltando.length > 0 || importar.isPending}
          >
            {importar.isPending ? 'Importando...' : `Confirmar importação (${preview?.validas.length ?? 0})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
