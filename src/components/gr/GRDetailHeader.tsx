import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { GRWallet, GRMetrics } from '@/types/gr-types';
import { useUpdateGRWallet } from '@/hooks/useGRWallet';
import { GRCapacityDialog } from './GRCapacityDialog';
import { GRRedistributeDialog } from './GRRedistributeDialog';
import { formatCurrency } from '@/lib/formatters';
import { User, Settings, Shuffle, Users, TrendingUp } from 'lucide-react';

interface GRDetailHeaderProps {
  wallet: GRWallet;
  metrics?: GRMetrics | null;
}

export const GRDetailHeader = ({ wallet, metrics }: GRDetailHeaderProps) => {
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [showRedistributeDialog, setShowRedistributeDialog] = useState(false);
  const updateWallet = useUpdateGRWallet();
  
  const ocupacao = wallet.max_capacity > 0 
    ? Math.round((wallet.current_count / wallet.max_capacity) * 100) 
    : 0;
  
  const initials = wallet.gr_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'GR';
  
  const handleToggleWallet = () => {
    updateWallet.mutate({ id: wallet.id, is_open: !wallet.is_open });
  };
  
  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left: GR Info */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h1 className="text-2xl font-bold">{wallet.gr_name || 'Gerente de Conta'}</h1>
                <p className="text-muted-foreground">{wallet.gr_email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{wallet.bu.toUpperCase()}</Badge>
                  <Badge variant={wallet.is_open ? 'default' : 'secondary'}>
                    {wallet.is_open ? 'Carteira Aberta' : 'Carteira Fechada'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Right: Stats and Actions */}
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
                    <Users className="h-3 w-3" />
                    Capacidade
                  </div>
                  <p className="text-xl font-bold">
                    {wallet.current_count}/{wallet.max_capacity}
                  </p>
                  <Badge 
                    variant={ocupacao >= 90 ? 'destructive' : ocupacao >= 70 ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {ocupacao}%
                  </Badge>
                </div>
                
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
                    <User className="h-3 w-3" />
                    Ativos
                  </div>
                  <p className="text-xl font-bold text-primary">
                    {metrics?.ativos || 0}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-sm">
                    <TrendingUp className="h-3 w-3" />
                    Receita
                  </div>
                  <p className="text-xl font-bold text-emerald-500">
                    {formatCurrency(metrics?.receita_gerada || 0)}
                  </p>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Carteira:</span>
                  <Switch 
                    checked={wallet.is_open} 
                    onCheckedChange={handleToggleWallet}
                    disabled={updateWallet.isPending}
                  />
                  <span className="text-sm">{wallet.is_open ? 'Aberta' : 'Fechada'}</span>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowCapacityDialog(true)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Capacidade
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowRedistributeDialog(true)}
                  >
                    <Shuffle className="h-4 w-4 mr-1" />
                    Redistribuir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Dialogs */}
      <GRCapacityDialog
        open={showCapacityDialog}
        onClose={() => setShowCapacityDialog(false)}
        wallet={wallet}
      />
      
      <GRRedistributeDialog
        open={showRedistributeDialog}
        onClose={() => setShowRedistributeDialog(false)}
        wallet={wallet}
      />
    </>
  );
};
