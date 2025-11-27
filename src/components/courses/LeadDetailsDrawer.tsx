import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Mail, Phone, User, Building2, Target } from "lucide-react";
import { useCourseCRM } from "@/hooks/useCourseCRM";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface LeadDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  sale: {
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    product_name: string;
    product_price: number;
    sale_status: string;
    sale_date: string;
  } | null;
}

export function LeadDetailsDrawer({ open, onClose, sale }: LeadDetailsDrawerProps) {
  const navigate = useNavigate();
  const { data: crmData, isLoading } = useCourseCRM(sale?.customer_email || null);

  if (!sale) return null;

  const handleNavigateToCRM = () => {
    if (crmData?.deal_id) {
      navigate(`/crm/negocios?deal=${crmData.deal_id}`);
    } else if (crmData?.contact_id) {
      navigate(`/crm/contatos?contact=${crmData.contact_id}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Lead</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Customer Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{sale.customer_name || 'Nome não informado'}</span>
            </div>
            
            {sale.customer_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{sale.customer_email}</span>
              </div>
            )}
            
            {sale.customer_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{sale.customer_phone}</span>
              </div>
            )}
          </div>

          {/* Course Purchase Info */}
          <div className="border-t pt-4 space-y-2">
            <h3 className="font-semibold text-sm">Compra do Curso</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Curso:</span>
                <span className="font-medium">{sale.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-medium">{formatCurrency(sale.product_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data:</span>
                <span>{format(new Date(sale.sale_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={sale.sale_status === 'refunded' ? 'destructive' : 'default'}>
                  {sale.sale_status === 'refunded' ? 'Reembolsado' : 'Pago'}
                </Badge>
              </div>
            </div>
          </div>

          {/* CRM Status */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Status no CRM
            </h3>
            
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : crmData ? (
              <div className="space-y-2 text-sm">
                {crmData.origin_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Origem:</span>
                    <span className="font-medium">{crmData.origin_name}</span>
                  </div>
                )}
                
                {crmData.stage_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Etapa Atual:</span>
                    <Badge 
                      style={{ 
                        backgroundColor: crmData.stage_color ? `${crmData.stage_color}20` : undefined,
                        color: crmData.stage_color || undefined,
                        borderColor: crmData.stage_color || undefined
                      }}
                      className="border"
                    >
                      {crmData.stage_name}
                    </Badge>
                  </div>
                )}

                {crmData.deal_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Negócio:</span>
                    <span className="font-medium">{crmData.deal_name}</span>
                  </div>
                )}

                <Button 
                  onClick={handleNavigateToCRM}
                  className="w-full mt-4"
                  variant="outline"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver no CRM
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Lead não encontrado no CRM
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
