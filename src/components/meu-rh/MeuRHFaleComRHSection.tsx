import { useState } from "react";
import { MessageSquarePlus, ChevronDown, ChevronUp, ExternalLink, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyTickets, TICKET_STATUS_LABELS, TICKET_TIPO_LABELS } from "@/hooks/useRhTickets";
import { NovoTicketModal } from "./NovoTicketModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Employee } from "@/types/hr";

interface Props {
  employee: Employee;
}

export function MeuRHFaleComRHSection({ employee }: Props) {
  const { data: tickets, isLoading } = useMyTickets(employee.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Fale com o RH</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" />
            Nova Solicitação
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!tickets?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-full bg-muted mb-4">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Nenhuma solicitação ainda</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-sm">
                Abra uma ocorrência, solicitação ou sugestão para o RH por aqui.
              </p>
              <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
                Criar primeira solicitação
              </Button>
            </div>
          ) : (
            tickets.map((ticket) => {
              const statusConfig = TICKET_STATUS_LABELS[ticket.status];
              const tipoConfig = TICKET_TIPO_LABELS[ticket.tipo];
              const isOpen = expandedId === ticket.id;

              return (
                <Collapsible key={ticket.id} open={isOpen} onOpenChange={() => setExpandedId(isOpen ? null : ticket.id)}>
                  <div className="border rounded-lg p-3">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-start justify-between gap-2 text-left">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`${statusConfig.color} text-white text-[10px]`}>
                              {statusConfig.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {tipoConfig.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{ticket.assunto}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Aberto em {format(new Date(ticket.data_abertura), "dd/MM/yyyy", { locale: ptBR })}
                            {ticket.data_encerramento && (
                              <> · Encerrado em {format(new Date(ticket.data_encerramento), "dd/MM/yyyy", { locale: ptBR })}</>
                            )}
                          </p>
                        </div>
                        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-3 pt-3 border-t space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                        <p className="text-sm whitespace-pre-wrap">{ticket.descricao}</p>
                      </div>

                      {ticket.anexo_url && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Anexo</p>
                          <a
                            href={ticket.anexo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Ver anexo <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}

                      {ticket.resposta_rh && (
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Resposta do RH</p>
                          <p className="text-sm whitespace-pre-wrap">{ticket.resposta_rh}</p>
                        </div>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>

      <NovoTicketModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        employeeId={employee.id}
      />
    </>
  );
}
