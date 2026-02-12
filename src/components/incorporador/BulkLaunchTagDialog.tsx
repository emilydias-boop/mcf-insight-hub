import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Rocket, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkLaunchTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BulkLaunchTagDialog({ open, onOpenChange, onSuccess }: BulkLaunchTagDialogProps) {
  const [emailList, setEmailList] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ updated: number; notFound: string[] } | null>(null);

  const handleSubmit = async () => {
    const emails = emailList
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && e.includes('@'));

    if (emails.length === 0) {
      toast.error('Nenhum email válido encontrado');
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      // Update all transactions matching these emails to sale_origin = 'launch'
      const { data, error } = await supabase
        .from('hubla_transactions')
        .update({ sale_origin: 'launch' })
        .in('customer_email', emails)
        .is('sale_origin', null)
        .select('customer_email');

      if (error) throw error;

      const updatedEmails = new Set((data || []).map((t: any) => t.customer_email?.toLowerCase()));
      const notFound = emails.filter(e => !updatedEmails.has(e));

      setResult({ updated: data?.length || 0, notFound });
      toast.success(`${data?.length || 0} transações marcadas como Lançamento`);
      onSuccess?.();
    } catch (error) {
      console.error('Error bulk tagging:', error);
      toast.error('Erro ao marcar transações');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setEmailList('');
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-amber-500" />
            Marcar Transações como Lançamento
          </DialogTitle>
          <DialogDescription>
            Cole a lista de emails dos leads do lançamento. Todas as transações desses emails serão categorizadas como "Lançamento".
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{result.updated} transações atualizadas</span>
            </div>
            {result.notFound.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Emails sem transações encontradas ({result.notFound.length}):
                </p>
                <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto bg-muted p-2 rounded">
                  {result.notFound.join(', ')}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Lista de Emails</Label>
              <Textarea
                placeholder="email1@exemplo.com&#10;email2@exemplo.com&#10;email3@exemplo.com"
                value={emailList}
                onChange={(e) => setEmailList(e.target.value)}
                rows={8}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separe por quebra de linha, vírgula ou ponto e vírgula
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isProcessing || !emailList.trim()}>
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processando...' : 'Marcar como Lançamento'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
