import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Asset, ASSET_TYPE_LABELS } from '@/types/patrimonio';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Monitor, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Printer, 
  HardDrive,
  Tag,
  Building2,
  Calendar,
  Hash,
  Cpu,
  FileText,
  MapPin,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  ShieldX
} from 'lucide-react';

interface AssetInfoCardProps {
  asset: Asset;
}

const typeIcons: Record<string, React.ReactNode> = {
  notebook: <Laptop className="h-5 w-5" />,
  desktop: <HardDrive className="h-5 w-5" />,
  monitor: <Monitor className="h-5 w-5" />,
  celular: <Smartphone className="h-5 w-5" />,
  tablet: <Tablet className="h-5 w-5" />,
  impressora: <Printer className="h-5 w-5" />,
  outro: <Cpu className="h-5 w-5" />,
};

const getWarrantyStatus = (garantiaFim: string | null) => {
  if (!garantiaFim) return null;
  const endDate = new Date(garantiaFim);
  if (isPast(endDate)) return 'expired';
  const daysLeft = differenceInDays(endDate, new Date());
  if (daysLeft <= 30) return 'expiring';
  return 'valid';
};

export const AssetInfoCard = ({ asset }: AssetInfoCardProps) => {
  const warrantyStatus = getWarrantyStatus(asset.garantia_fim);

  const infoItems = [
    { 
      icon: typeIcons[asset.tipo] || <Cpu className="h-5 w-5" />,
      label: 'Tipo',
      value: ASSET_TYPE_LABELS[asset.tipo]
    },
    { 
      icon: <Tag className="h-5 w-5" />,
      label: 'Marca/Modelo',
      value: [asset.marca, asset.modelo].filter(Boolean).join(' ') || '-'
    },
    { 
      icon: <Hash className="h-5 w-5" />,
      label: 'Número de Série',
      value: asset.numero_serie || '-'
    },
    { 
      icon: <Cpu className="h-5 w-5" />,
      label: 'Sistema Operacional',
      value: asset.sistema_operacional || '-'
    },
    { 
      icon: <Calendar className="h-5 w-5" />,
      label: 'Data de Compra',
      value: asset.data_compra 
        ? format(new Date(asset.data_compra), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : '-'
    },
    { 
      icon: <Building2 className="h-5 w-5" />,
      label: 'Fornecedor',
      value: asset.fornecedor || '-'
    },
    {
      icon: <MapPin className="h-5 w-5" />,
      label: 'Localização',
      value: asset.localizacao || '-'
    },
    {
      icon: <DollarSign className="h-5 w-5" />,
      label: 'Centro de Custo',
      value: asset.centro_custo || '-'
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Informações do Equipamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {infoItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="text-muted-foreground mt-0.5">
                {item.icon}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="font-medium">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Warranty section */}
        {(asset.garantia_inicio || asset.garantia_fim) && (
          <div className="mt-4 p-3 rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              {warrantyStatus === 'valid' && <ShieldCheck className="h-5 w-5 text-green-600" />}
              {warrantyStatus === 'expiring' && <ShieldAlert className="h-5 w-5 text-yellow-600" />}
              {warrantyStatus === 'expired' && <ShieldX className="h-5 w-5 text-destructive" />}
              {!warrantyStatus && <ShieldCheck className="h-5 w-5 text-muted-foreground" />}
              <p className="font-medium">Garantia</p>
              {warrantyStatus === 'expired' && (
                <Badge variant="destructive" className="text-xs">Vencida</Badge>
              )}
              {warrantyStatus === 'expiring' && (
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                  Vence em {differenceInDays(new Date(asset.garantia_fim!), new Date())} dias
                </Badge>
              )}
              {warrantyStatus === 'valid' && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Ativa</Badge>
              )}
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              {asset.garantia_inicio && (
                <span>Início: {format(new Date(asset.garantia_inicio), 'dd/MM/yyyy')}</span>
              )}
              {asset.garantia_fim && (
                <span>Fim: {format(new Date(asset.garantia_fim), 'dd/MM/yyyy')}</span>
              )}
            </div>
          </div>
        )}

        {asset.observacoes && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Observações</p>
            <p className="text-sm">{asset.observacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
