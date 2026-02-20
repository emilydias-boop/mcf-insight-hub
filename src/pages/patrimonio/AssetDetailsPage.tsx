import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAsset } from '@/hooks/useAssets';
import { useAssetHistory } from '@/hooks/useAssetHistory';
import { useAssetAssignments } from '@/hooks/useAssetAssignments';
import { AssetInfoCard } from '@/components/patrimonio/AssetInfoCard';
import { AssetTimeline } from '@/components/patrimonio/AssetTimeline';
import { AssetCurrentHolder } from '@/components/patrimonio/AssetCurrentHolder';
import { AssetAssignmentHistory } from '@/components/patrimonio/AssetAssignmentHistory';
import { AssetStatusBadge } from '@/components/patrimonio/AssetStatusBadge';
import { AssetFormDialog } from '@/components/patrimonio/AssetFormDialog';
import { AssetAssignDialog } from '@/components/patrimonio/AssetAssignDialog';
import { AssetReturnDialog } from '@/components/patrimonio/AssetReturnDialog';
import { AssetTransferDialog } from '@/components/patrimonio/AssetTransferDialog';
import { AssetMaintenanceDialog } from '@/components/patrimonio/AssetMaintenanceDialog';
import { AssetWriteOffDialog } from '@/components/patrimonio/AssetWriteOffDialog';
import { AssetQRCode } from '@/components/patrimonio/AssetQRCode';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Edit, UserPlus, Undo2, ArrowRightLeft, Wrench, XCircle, QrCode } from 'lucide-react';

const AssetDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: asset, isLoading: assetLoading } = useAsset(id);
  const { data: history, isLoading: historyLoading } = useAssetHistory(id);
  const { data: assignments, isLoading: assignmentsLoading } = useAssetAssignments(id);

  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  if (assetLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Equipamento não encontrado</p>
          <Button variant="link" onClick={() => navigate('/patrimonio')}>
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  const canAssign = asset.status === 'em_estoque';
  const canReturn = asset.status === 'em_uso' && asset.current_assignment;
  const canTransfer = asset.status === 'em_uso' && asset.current_assignment;
  const canMaintenance = asset.status === 'em_uso' || asset.status === 'em_estoque';
  const canWriteOff = asset.status !== 'baixado';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/patrimonio')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{asset.numero_patrimonio}</h1>
              <AssetStatusBadge status={asset.status} />
            </div>
            <p className="text-muted-foreground">
              {[asset.marca, asset.modelo].filter(Boolean).join(' ') || 'Equipamento'}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="mr-2 h-4 w-4" />
            QR Code
          </Button>
          
          {canAssign && (
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Liberar
            </Button>
          )}

          {canTransfer && (
            <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Transferir
            </Button>
          )}
          
          {canReturn && (
            <Button variant="secondary" size="sm" onClick={() => setReturnOpen(true)}>
              <Undo2 className="mr-2 h-4 w-4" />
              Devolver
            </Button>
          )}
          
          {canMaintenance && (
            <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(true)}>
              <Wrench className="mr-2 h-4 w-4" />
              Manutenção
            </Button>
          )}
          
          {canWriteOff && (
            <Button variant="destructive" size="sm" onClick={() => setWriteOffOpen(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Baixa
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <AssetInfoCard asset={asset} />
          <AssetTimeline history={history || []} isLoading={historyLoading} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <AssetCurrentHolder assignment={asset.current_assignment} />
          <AssetAssignmentHistory assignments={assignments || []} isLoading={assignmentsLoading} />
        </div>
      </div>

      {/* Dialogs */}
      <AssetFormDialog open={editOpen} onOpenChange={setEditOpen} asset={asset} />
      <AssetAssignDialog open={assignOpen} onOpenChange={setAssignOpen} asset={asset} />
      <AssetReturnDialog open={returnOpen} onOpenChange={setReturnOpen} asset={asset} />
      <AssetTransferDialog open={transferOpen} onOpenChange={setTransferOpen} asset={asset} currentAssignment={asset.current_assignment as any} />
      <AssetMaintenanceDialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen} asset={asset} />
      <AssetWriteOffDialog open={writeOffOpen} onOpenChange={setWriteOffOpen} asset={asset} />
      <AssetQRCode open={qrOpen} onOpenChange={setQrOpen} assetId={asset.id} numeroPatrimonio={asset.numero_patrimonio} />
    </div>
  );
};

export default AssetDetailsPage;
