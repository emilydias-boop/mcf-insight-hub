import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAssetReports } from '@/hooks/useAssetReports';
import { ASSET_STATUS_LABELS, ASSET_TYPE_LABELS } from '@/types/patrimonio';
import { ArrowLeft, Download, Package, AlertTriangle, ShieldX, Users } from 'lucide-react';
import * as XLSX from 'xlsx';

const PatrimonioRelatorios = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tipoFilter, setTipoFilter] = useState<string>('');

  const { data, isLoading } = useAssetReports({
    status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
    tipo: tipoFilter && tipoFilter !== 'all' ? tipoFilter : undefined,
  });

  const handleExport = () => {
    if (!data?.assets?.length) return;
    
    const rows = data.assets.map(a => ({
      'Patrimônio': a.numero_patrimonio,
      'Tipo': ASSET_TYPE_LABELS[a.tipo as keyof typeof ASSET_TYPE_LABELS] || a.tipo,
      'Marca': a.marca || '',
      'Modelo': a.modelo || '',
      'Nº Série': a.numero_serie || '',
      'Status': ASSET_STATUS_LABELS[a.status as keyof typeof ASSET_STATUS_LABELS] || a.status,
      'Localização': a.localizacao || '',
      'Centro de Custo': a.centro_custo || '',
      'Garantia Fim': a.garantia_fim || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patrimônio');
    XLSX.writeFile(wb, `relatorio-patrimonio-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/patrimonio')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Relatórios de Patrimônio</h1>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={!data?.assets?.length}>
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(ASSET_STATUS_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(ASSET_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{data.stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{data.stats.em_uso}</p>
                  <p className="text-sm text-muted-foreground">Em Uso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{data.stats.garantia_proxima}</p>
                  <p className="text-sm text-muted-foreground">Garantia Expirando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ShieldX className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{data.stats.garantia_vencida}</p>
                  <p className="text-sm text-muted-foreground">Garantia Vencida</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* By Sector */}
      {data?.porSetor && data.porSetor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Equipamentos por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.porSetor.map(({ setor, count }) => (
                <div key={setor} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">{setor}</span>
                  <span className="text-muted-foreground">{count} equipamento(s)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Equipamentos ({data?.assets?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Patrimônio</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Marca/Modelo</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Localização</th>
                    <th className="text-left p-2">Garantia</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.assets?.map(asset => (
                    <tr key={asset.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/patrimonio/${asset.id}`)}>
                      <td className="p-2 font-medium">{asset.numero_patrimonio}</td>
                      <td className="p-2">{ASSET_TYPE_LABELS[asset.tipo as keyof typeof ASSET_TYPE_LABELS]}</td>
                      <td className="p-2">{[asset.marca, asset.modelo].filter(Boolean).join(' ') || '-'}</td>
                      <td className="p-2">{ASSET_STATUS_LABELS[asset.status as keyof typeof ASSET_STATUS_LABELS]}</td>
                      <td className="p-2">{asset.localizacao || '-'}</td>
                      <td className="p-2">{asset.garantia_fim || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PatrimonioRelatorios;
