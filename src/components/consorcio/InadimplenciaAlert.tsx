import { AlertTriangle, AlertCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { InadimplenciaInfo } from '@/lib/inadimplenciaUtils';

interface InadimplenciaAlertProps {
  info: InadimplenciaInfo;
  onRegularizar?: () => void;
}

export function InadimplenciaAlert({ info, onRegularizar }: InadimplenciaAlertProps) {
  if (info.risco === 'baixo') {
    return null;
  }

  const getIcon = () => {
    switch (info.risco) {
      case 'medio':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'alto':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'cancelamento':
        return <XCircle className="h-5 w-5 text-red-700" />;
      default:
        return null;
    }
  };

  const getVariant = (): 'default' | 'destructive' => {
    return info.risco === 'cancelamento' || info.risco === 'alto' ? 'destructive' : 'default';
  };

  const getBgClass = () => {
    switch (info.risco) {
      case 'medio':
        return 'bg-yellow-50 border-yellow-200';
      case 'alto':
        return 'bg-red-50 border-red-200';
      case 'cancelamento':
        return 'bg-red-100 border-red-300';
      default:
        return '';
    }
  };

  return (
    <Alert variant={getVariant()} className={getBgClass()}>
      {getIcon()}
      <AlertTitle className="flex items-center justify-between">
        <span>
          {info.risco === 'cancelamento' ? 'Cota em Cancelamento' : 
           info.risco === 'alto' ? 'Risco de Cancelamento' : 
           'Parcelas em Atraso'}
        </span>
        {onRegularizar && info.risco !== 'cancelamento' && (
          <Button 
            size="sm" 
            variant={info.risco === 'alto' ? 'destructive' : 'outline'}
            onClick={onRegularizar}
          >
            Regularizar Parcelas
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {info.mensagem}
        {info.risco === 'alto' && (
          <p className="mt-1 font-medium">
            ⚠️ Se mais uma parcela vencer sem pagamento, a cota será automaticamente cancelada.
          </p>
        )}
        {info.risco === 'cancelamento' && (
          <p className="mt-1 font-medium">
            Esta cota possui {info.parcelasAtrasadas} parcelas em atraso e deve ser marcada como cancelada.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
