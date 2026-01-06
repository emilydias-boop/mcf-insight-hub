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
import { useOwnPayout, useOwnSdr } from '@/hooks/useSdrFechamento';
import { useMyEmployee } from '@/hooks/useMyEmployee';
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  RefreshCw,
  DollarSign,
  Target,
  Wallet,
  CreditCard,
  TrendingUp,
  UtensilsCrossed,
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

  const { data: sdr, isLoading: sdrLoading } = useOwnSdr();
  const { data: payout, isLoading: payoutLoading } = useOwnPayout(selectedMonth);
  const { data: myEmployee } = useMyEmployee();

  const isLoading = sdrLoading || payoutLoading;

  // Generate last 12 months options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    };
  });

  const calculateGlobalPct = () => {
    if (!payout) return 0;
    const pcts = [
      payout.pct_reunioes_agendadas,
      payout.pct_reunioes_realizadas,
      payout.pct_tentativas,
      payout.pct_organizacao,
    ].filter((p) => p !== null) as number[];

    if (pcts.length === 0) return 0;
    return pcts.reduce((a, b) => a + b, 0) / pcts.length;
  };

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
    queryClient.invalidateQueries({ queryKey: ['own-payout', selectedMonth] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sdr) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Você não está cadastrado como SDR no sistema.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Entre em contato com seu gestor para mais informações.
        </p>
      </div>
    );
  }

  const globalPct = calculateGlobalPct();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Meu Fechamento</h1>
          <p className="text-sm text-muted-foreground">
            Olá, {sdr.name}! Acompanhe seu fechamento mensal.
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

      {!payout ? (
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
                <SdrStatusBadge status={payout.status} />
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/fechamento-sdr/${payout.id}`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </Button>
            </CardHeader>
          </Card>

          {/* NFSe Card - Show when APPROVED */}
          {payout.status === 'APPROVED' && !payout.nfse_id && myEmployee && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium">Fechamento Aprovado!</p>
                    <p className="text-sm text-muted-foreground">
                      Envie sua NFSe no valor de {formatCurrency(payout.total_conta || 0)}
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
          {payout.nfse_id && (
            <Card className="border-green-500/50 bg-green-500/10">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600">NFSe Enviada</p>
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

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <TrendingUp className="h-3.5 w-3.5" />
                  % Meta Global
                </div>
                <div
                  className={`text-xl font-bold mt-1 ${
                    globalPct >= 100
                      ? 'text-green-400'
                      : globalPct >= 70
                      ? 'text-yellow-400'
                      : 'text-red-400'
                  }`}
                >
                  {globalPct.toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <Target className="h-3.5 w-3.5" />
                  OTE
                </div>
                <div className="text-xl font-bold mt-1">
                  {formatCurrency(4000)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <Wallet className="h-3.5 w-3.5" />
                  Fixo
                </div>
                <div className="text-xl font-bold mt-1">
                  {formatCurrency(payout.valor_fixo || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <DollarSign className="h-3.5 w-3.5" />
                  Variável
                </div>
                <div className="text-xl font-bold mt-1 text-primary">
                  {formatCurrency(payout.valor_variavel_total || 0)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-primary text-xs">
                  <CreditCard className="h-3.5 w-3.5" />
                  Total Conta
                </div>
                <div className="text-xl font-bold mt-1 text-primary">
                  {formatCurrency(payout.total_conta || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground/70 text-xs">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  Total iFood
                </div>
                <div className="text-xl font-bold mt-1">
                  {formatCurrency(payout.total_ifood || 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicators Preview */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold">Resumo dos Indicadores</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground/70">
                    Reuniões Agendadas
                  </div>
                  <div className="text-lg font-semibold mt-0.5">
                    {(payout.pct_reunioes_agendadas || 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    Mult: {payout.mult_reunioes_agendadas || 0}x
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground/70">
                    Reuniões Realizadas
                  </div>
                  <div className="text-lg font-semibold mt-0.5">
                    {(payout.pct_reunioes_realizadas || 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    Mult: {payout.mult_reunioes_realizadas || 0}x
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground/70">
                    Tentativas
                  </div>
                  <div className="text-lg font-semibold mt-0.5">
                    {(payout.pct_tentativas || 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    Mult: {payout.mult_tentativas || 0}x
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-xs text-muted-foreground/70">
                    Organização
                  </div>
                  <div className="text-lg font-semibold mt-0.5">
                    {(payout.pct_organizacao || 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground/70">
                    Mult: {payout.mult_organizacao || 0}x
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* NFSe Modal */}
      {myEmployee && payout && (
        <EnviarNfseFechamentoModal
          open={showNfseModal}
          onOpenChange={setShowNfseModal}
          payoutId={payout.id}
          employeeId={myEmployee.id}
          anoMes={selectedMonth}
          valorEsperado={payout.total_conta || 0}
          onSuccess={handleNfseSuccess}
        />
      )}
    </div>
  );
};

export default MeuFechamento;
