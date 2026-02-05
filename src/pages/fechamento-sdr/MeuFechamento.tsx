import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SdrStatusBadge } from '@/components/sdr-fechamento/SdrStatusBadge';
import { EnviarNfseFechamentoModal } from '@/components/sdr-fechamento/EnviarNfseFechamentoModal';
import { SdrFechamentoView } from '@/components/fechamento/SdrFechamentoView';
import { CloserFechamentoView } from '@/components/fechamento/CloserFechamentoView';
import { useOwnFechamento } from '@/hooks/useOwnFechamento';
import { useMyEmployee } from '@/hooks/useMyEmployee';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertTriangle,
  Download,
} from 'lucide-react';

const MeuFechamento = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showNfseModal, setShowNfseModal] = useState(false);

  const { 
    userType, 
    userRecord, 
    payout, 
    closerMetrics,
    isLoading 
  } = useOwnFechamento(selectedMonth);
  const { data: myEmployee } = useMyEmployee();

  // Filter: only show payout if NOT in DRAFT status
  const visiblePayout = payout?.status !== 'DRAFT' ? payout : null;

  // Generate last 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  const handleDownloadNfse = async () => {
    if (!payout?.nfse_id) return;

    try {
      // Fetch the NFSe record to get the storage path
      const { data: nfseData, error } = await supabase
        .from('rh_nfse')
        .select('storage_path')
        .eq('id', payout.nfse_id)
        .single();

      if (error || !nfseData?.storage_path) {
        toast.error('NFSe não encontrada');
        return;
      }

      const { data: urlData } = await supabase.storage
        .from('user-files')
        .createSignedUrl(nfseData.storage_path, 60);

      if (urlData?.signedUrl) {
        window.open(urlData.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Erro ao baixar NFSe:', error);
      toast.error('Erro ao baixar NFSe');
    }
  };

  const handleNfseSuccess = () => {
    setShowNfseModal(false);
    queryClient.invalidateQueries({ 
      queryKey: ['own-payout'],
      exact: false 
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userRecord) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Você não está cadastrado no sistema de fechamento.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Entre em contato com seu gestor para mais informações.
        </p>
      </div>
    );
  }

  const getRoleLabel = () => {
    if (userType === 'closer') return 'Closer';
    if (userType === 'sdr') return 'SDR';
    return '';
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Meu Fechamento</h1>
          <p className="text-sm text-muted-foreground">
            Olá, {userRecord.name}! Acompanhe seu fechamento mensal{getRoleLabel() ? ` como ${getRoleLabel()}` : ''}.
          </p>
        </div>

        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!visiblePayout ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum fechamento encontrado para{' '}
              {monthOptions.find((o) => o.value === selectedMonth)?.label}.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              O fechamento será gerado pela gestão.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="flex items-center gap-3 text-sm font-medium">
                Fechamento de{' '}
                {monthOptions.find((o) => o.value === selectedMonth)?.label}
                <SdrStatusBadge status={visiblePayout.status} />
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/fechamento-sdr/${visiblePayout.id}`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </Button>
            </CardHeader>
          </Card>

          {/* NFSe Card - Show when APPROVED */}
          {visiblePayout.status === 'APPROVED' && !visiblePayout.nfse_id && myEmployee && (
            <Card className="border-warning/50 bg-warning/10">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium">Fechamento Aprovado!</p>
                    <p className="text-sm text-muted-foreground">
                      Envie sua NFSe no valor de {formatCurrency(visiblePayout.total_conta || 0)}
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowNfseModal(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Enviar NFSe
                </Button>
              </CardContent>
            </Card>
          )}

          {/* NFSe Sent Card */}
          {visiblePayout.nfse_id && (
            <Card className="border-success/50 bg-success/10">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium text-success">NFSe Enviada</p>
                    <p className="text-sm text-muted-foreground">
                      Aguardando confirmação do financeiro
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadNfse}>
                  <Download className="h-4 w-4 mr-2" />
                  Ver NFSe
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Render view based on user type */}
          {userType === 'sdr' && <SdrFechamentoView payout={visiblePayout} />}
          {userType === 'closer' && (
            <CloserFechamentoView payout={visiblePayout} closerMetrics={closerMetrics} />
          )}
        </>
      )}

      {/* NFSe Modal */}
      {myEmployee && visiblePayout && (
        <EnviarNfseFechamentoModal
          open={showNfseModal}
          onOpenChange={setShowNfseModal}
          payoutId={visiblePayout.id}
          employeeId={myEmployee.id}
          anoMes={selectedMonth}
          valorEsperado={visiblePayout.total_conta || 0}
          onSuccess={handleNfseSuccess}
        />
      )}
    </div>
  );
};

export default MeuFechamento;
