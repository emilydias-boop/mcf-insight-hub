import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Asset, ASSET_TYPE_LABELS } from '@/types/patrimonio';
import { format } from 'date-fns';
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
  FileText
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

export const AssetInfoCard = ({ asset }: AssetInfoCardProps) => {
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
