import { useState } from 'react';
import { ResourceGuard } from '@/components/auth/ResourceGuard';
import { useAssets } from '@/hooks/useAssets';
import { AssetStats } from '@/components/patrimonio/AssetStats';
import { AssetFormDialog } from '@/components/patrimonio/AssetFormDialog';
import { AssetStatusBadge } from '@/components/patrimonio/AssetStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AssetType, 
  AssetStatus, 
  ASSET_TYPE_LABELS, 
  ASSET_STATUS_LABELS 
} from '@/types/patrimonio';
import { Plus, Search, Monitor, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PatrimonioIndex = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [tipoFilter, setTipoFilter] = useState<AssetType | 'all'>('all');
  const [showFormDialog, setShowFormDialog] = useState(false);

  const { data: assets, isLoading } = useAssets({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    tipo: tipoFilter !== 'all' ? tipoFilter : undefined,
  });

  return (
    <ResourceGuard resource="patrimonio">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Central de Patrimônio</h1>
              <p className="text-muted-foreground">Gestão de equipamentos de TI</p>
            </div>
          </div>
          <Button onClick={() => setShowFormDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Equipamento
          </Button>
        </div>

        {/* Stats */}
        <AssetStats />

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Equipamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por patrimônio, marca ou modelo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssetStatus | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  {Object.entries(ASSET_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={(v) => setTipoFilter(v as AssetType | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patrimônio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Marca/Modelo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Compra</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : assets?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum equipamento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    assets?.map((asset) => (
                      <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{asset.numero_patrimonio}</TableCell>
                        <TableCell>{ASSET_TYPE_LABELS[asset.tipo]}</TableCell>
                        <TableCell>
                          {[asset.marca, asset.modelo].filter(Boolean).join(' ') || '-'}
                        </TableCell>
                        <TableCell>
                          <AssetStatusBadge status={asset.status} />
                        </TableCell>
                        <TableCell>
                          {asset.data_compra 
                            ? format(new Date(asset.data_compra), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/patrimonio/${asset.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <AssetFormDialog 
          open={showFormDialog} 
          onOpenChange={setShowFormDialog} 
        />
      </div>
    </ResourceGuard>
  );
};

export default PatrimonioIndex;
