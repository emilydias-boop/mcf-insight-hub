import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMyAssets } from '@/hooks/useAssetAssignments';
import { useAssetTerms, useTermMutations } from '@/hooks/useAssetTerms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ASSET_TYPE_LABELS } from '@/types/patrimonio';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Laptop, FileCheck, AlertCircle, Loader2, Eye, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const MyEquipmentPage = () => {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [termDialogOpen, setTermDialogOpen] = useState(false);
  const [viewTermDialogOpen, setViewTermDialogOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<any>(null);
  const [viewedTerm, setViewedTerm] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);

  const { data: myAssets, isLoading: assetsLoading } = useMyAssets(employeeId || undefined);
  const { data: myTerms, isLoading: termsLoading } = useAssetTerms(employeeId || undefined);
  const { acceptTerm } = useTermMutations();

  useEffect(() => {
    const loadEmployeeId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const client: any = supabase;
      const { data: rows } = await client.from('employees').select('id').eq('profile_id', user.id).limit(1);
      setEmployeeId(rows?.[0]?.id || null);
      setLoading(false);
    };
    loadEmployeeId();
  }, []);

  const pendingTerms = myTerms?.filter((t: any) => !t.aceito) || [];

  const handleAcceptTerm = async () => {
    if (!selectedTerm || !accepted) return;
    try {
      await acceptTerm.mutateAsync({ termId: selectedTerm.id });
      setTermDialogOpen(false);
      setAccepted(false);
      setSelectedTerm(null);
    } catch {
      toast.error('Erro ao aceitar termo');
    }
  };

  if (loading || assetsLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Seu perfil não está vinculado a um colaborador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus Equipamentos</h1>
        <p className="text-muted-foreground">Seus equipamentos de TI e termos de responsabilidade</p>
      </div>

      {/* Pending Terms Alert */}
      {pendingTerms.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-accent-foreground" />
              <div className="flex-1">
                <p className="font-medium">Você tem {pendingTerms.length} termo(s) pendente(s) de aceite</p>
                <p className="text-sm text-muted-foreground">Clique em "Aceitar" para concordar com o termo de responsabilidade.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Equipment List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myAssets && myAssets.length > 0 ? (
          myAssets.map((assignment: any) => {
            const asset = assignment.asset;
            if (!asset) return null;
            const pendingTerm = myTerms?.find((t: any) => t.asset_id === asset.id && !t.aceito);
            const acceptedTerm = myTerms?.find((t: any) => t.asset_id === asset.id && t.aceito);
            
            return (
              <Card key={assignment.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Laptop className="h-4 w-4" />
                      {asset.numero_patrimonio}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {acceptedTerm && (
                        <Badge variant="default">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Termo Aceito
                        </Badge>
                      )}
                      <Badge variant="outline">{ASSET_TYPE_LABELS[asset.tipo as keyof typeof ASSET_TYPE_LABELS] || asset.tipo}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">{[asset.marca, asset.modelo].filter(Boolean).join(' ') || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {format(new Date(assignment.data_liberacao), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  {assignment.items && assignment.items.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {assignment.items.map((item: any) => (
                        <Badge key={item.id} variant="secondary" className="text-xs capitalize">
                          {item.item_tipo}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {pendingTerm && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => { setSelectedTerm(pendingTerm); setTermDialogOpen(true); setAccepted(false); }}
                    >
                      <FileCheck className="mr-2 h-4 w-4" />
                      Aceitar Termo
                    </Button>
                  )}
                  {acceptedTerm && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
                      onClick={() => { setViewedTerm(acceptedTerm); setViewTermDialogOpen(true); }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Termo
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            <Laptop className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum equipamento vinculado a você.</p>
          </div>
        )}
      </div>

      {/* Term Acceptance Dialog */}
      <Dialog open={termDialogOpen} onOpenChange={setTermDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Termo de Responsabilidade</DialogTitle>
            <DialogDescription>Leia o termo abaixo e confirme o aceite.</DialogDescription>
          </DialogHeader>
          {selectedTerm && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap border p-4 rounded-lg bg-muted/30 max-h-[400px] overflow-y-auto text-sm">
                {selectedTerm.termo_conteudo}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="accept-term"
                  checked={accepted}
                  onCheckedChange={(v) => setAccepted(!!v)}
                />
                <label htmlFor="accept-term" className="text-sm cursor-pointer">
                  Li e concordo com os termos e condições acima.
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTermDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAcceptTerm} disabled={!accepted || acceptTerm.isPending}>
              {acceptTerm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aceitar Termo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Accepted Term Dialog */}
      <Dialog open={viewTermDialogOpen} onOpenChange={setViewTermDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Termo de Responsabilidade
            </DialogTitle>
            <DialogDescription>Termo aceito - visualização somente leitura.</DialogDescription>
          </DialogHeader>
          {viewedTerm && (
            <div className="space-y-4">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap border p-4 rounded-lg bg-muted/30 max-h-[400px] overflow-y-auto text-sm">
                {viewedTerm.termo_conteudo}
              </div>
              <div className="border rounded-lg p-3 bg-muted/20 space-y-1 text-xs text-muted-foreground">
                <p><strong>Data do aceite:</strong> {viewedTerm.data_aceite ? format(new Date(viewedTerm.data_aceite), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}</p>
                <p><strong>Versão:</strong> {viewedTerm.versao || 1}</p>
                {viewedTerm.ip_aceite && <p><strong>IP:</strong> {viewedTerm.ip_aceite}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTermDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyEquipmentPage;
