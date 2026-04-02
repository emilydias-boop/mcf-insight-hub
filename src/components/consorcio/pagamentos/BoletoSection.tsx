import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, MessageCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ConsorcioBoleto, useSendBoletoWhatsApp, useBoletoSignedUrl } from '@/hooks/useConsorcioBoletos';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  boleto: ConsorcioBoleto;
}

export function BoletoSection({ boleto }: Props) {
  const sendWhatsApp = useSendBoletoWhatsApp();
  const { data: pdfUrl } = useBoletoSignedUrl(boleto.storage_path);

  const handleCopyLinha = () => {
    if (boleto.linha_digitavel) {
      navigator.clipboard.writeText(boleto.linha_digitavel);
      toast.success('Linha digitável copiada!');
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Boleto</span>
        <Badge variant="outline" className={
          boleto.status === 'sent' ? 'bg-green-100 text-green-800' :
          boleto.match_confidence === 'exact' ? 'bg-blue-100 text-blue-800' :
          'bg-yellow-100 text-yellow-800'
        }>
          {boleto.status === 'sent' ? 'Enviado' :
           boleto.match_confidence === 'exact' ? 'Vinculado' : 'Revisar'}
        </Badge>
      </div>

      {/* Extracted data */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        {boleto.valor_extraido && (
          <div>
            <span className="text-muted-foreground">Valor:</span>{' '}
            <span className="font-medium">{formatCurrency(boleto.valor_extraido)}</span>
          </div>
        )}
        {boleto.vencimento_extraido && (
          <div>
            <span className="text-muted-foreground">Vencimento:</span>{' '}
            <span className="font-medium">{formatDate(boleto.vencimento_extraido)}</span>
          </div>
        )}
      </div>

      {/* Linha digitável */}
      {boleto.linha_digitavel && (
        <div className="flex items-center gap-1">
          <code className="text-[10px] bg-muted p-1 rounded flex-1 truncate font-mono">
            {boleto.linha_digitavel}
          </code>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyLinha}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {pdfUrl && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(pdfUrl, '_blank')}>
            <ExternalLink className="h-3 w-3 mr-1" />
            Ver PDF
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <MessageCircle className="h-3 w-3 mr-1" />
              WhatsApp
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => sendWhatsApp.mutate({ boletoId: boleto.id, mode: 'wame' })}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir WhatsApp Web
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => sendWhatsApp.mutate({ boletoId: boleto.id, mode: 'twilio' })}>
              <Send className="h-4 w-4 mr-2" />
              Enviar via Twilio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
