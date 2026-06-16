import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
import { Phone, PhoneOff, PhoneMissed, Voicemail, PhoneCall, CheckCircle2, FileText, ArrowRightLeft, MessageCircle, Users, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSdrActivityMetrics } from "@/hooks/useSdrActivityMetrics";
import { useCallClassificationThresholds, DEFAULT_THRESHOLDS } from "@/hooks/useCallClassificationThresholds";
import { SdrLeadCallsDialog } from "./SdrLeadCallsDialog";
 
interface SdrActivityMetricsTableProps {
  startDate: Date;
  endDate: Date;
  originId?: string;
  squad?: string;
}

function HeaderWithTooltip({ icon, label, tooltip }: { icon: React.ReactNode; label: string; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-center gap-1 cursor-help">
          {icon}
          <span>{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function SdrActivityMetricsTable({ startDate, endDate, originId, squad }: SdrActivityMetricsTableProps) {
  const { data: metrics, isLoading, error } = useSdrActivityMetrics(startDate, endDate, originId, squad);
  const { data: thresholds } = useCallClassificationThresholds(squad || 'default');
  const [selected, setSelected] = useState<{ userId: string | null; name: string } | null>(null);
 
   if (error) {
     return (
       <Card>
         <CardContent className="py-6">
           <p className="text-sm text-destructive">Erro ao carregar métricas de atividades</p>
         </CardContent>
       </Card>
     );
   }
 
  const t = thresholds || DEFAULT_THRESHOLDS;
  const T = { ringDropMax: t.ring_drop_max, voicemailMax: t.voicemail_max, effectiveMax: t.effective_max };

   return (
   <TooltipProvider delayDuration={150}>
     <Card>
       <CardHeader className="pb-3">
         <CardTitle className="text-lg flex items-center gap-2">
           <Phone className="h-5 w-5" />
           Atividades por SDR
         </CardTitle>
         <CardDescription>
          Ligações classificadas por duração: ring drop (≤{T.ringDropMax}s), caixa postal ({T.ringDropMax + 1}–{T.voicemailMax}s), efetiva ({T.voicemailMax + 1}–{T.effectiveMax}s), qualificada (&gt;{T.effectiveMax}s).
         </CardDescription>
       </CardHeader>
       <CardContent>
         {isLoading ? (
           <div className="space-y-2">
             {[1, 2, 3, 4, 5].map((i) => (
               <Skeleton key={i} className="h-10 w-full" />
             ))}
           </div>
         ) : metrics && metrics.length > 0 ? (
           <div className="overflow-x-auto">
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead className="whitespace-nowrap">SDR</TableHead>
                   <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<Phone className="h-3.5 w-3.5" />} label="Total" tooltip="Total de ligações outbound disparadas no período." />
                   </TableHead>
                   <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<PhoneMissed className="h-3.5 w-3.5 text-muted-foreground" />} label="Não atend." tooltip="Status no-answer / failed / busy / initiated, ou duração 0s. Ninguém atendeu." />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<PhoneOff className="h-3.5 w-3.5 text-amber-600" />} label="Ring drop" tooltip={`Atendeu e desligou em até ${T.ringDropMax}s — provavelmente rejeitou ou cortou.`} />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<Voicemail className="h-3.5 w-3.5 text-amber-700" />} label="Caixa postal" tooltip={`Duração entre ${T.ringDropMax + 1}s e ${T.voicemailMax}s — provavelmente bateu na caixa postal (heurística).`} />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<PhoneCall className="h-3.5 w-3.5 text-blue-600" />} label="Efetivas" tooltip={`Conversa curta: entre ${T.voicemailMax + 1}s e ${T.effectiveMax}s.`} />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-600" />} label="Qualificadas" tooltip={`Conversa real de prospecção: acima de ${T.effectiveMax}s.`} />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<span className="text-xs">%</span>} label="Conexão" tooltip="Taxa de conexão = (ring drop + caixa postal + efetivas + qualificadas) / total." />
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">
                    <HeaderWithTooltip icon={<span className="text-xs">%</span>} label="Qualif." tooltip="Taxa de qualificação = qualificadas / total. Indicador de prospecção produtiva." />
                   </TableHead>
                   <TableHead className="text-center whitespace-nowrap">
                     <div className="flex items-center justify-center gap-1">
                       <FileText className="h-3.5 w-3.5" />
                       Notas
                     </div>
                   </TableHead>
                   <TableHead className="text-center whitespace-nowrap">
                     <div className="flex items-center justify-center gap-1">
                       <ArrowRightLeft className="h-3.5 w-3.5" />
                       Movimentos
                     </div>
                   </TableHead>
                   <TableHead className="text-center whitespace-nowrap">
                     <div className="flex items-center justify-center gap-1">
                       <MessageCircle className="h-3.5 w-3.5" />
                       WhatsApp
                     </div>
                   </TableHead>
                   <TableHead className="text-center whitespace-nowrap">
                     <div className="flex items-center justify-center gap-1">
                       <Users className="h-3.5 w-3.5" />
                       Leads
                     </div>
                   </TableHead>
                   <TableHead className="text-center whitespace-nowrap">Lig/Lead</TableHead>
                    <TableHead className="text-center whitespace-nowrap">Detalhes</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {metrics.map((sdr) => (
                   <TableRow key={sdr.sdrEmail}>
                     <TableCell className="font-medium whitespace-nowrap">{sdr.sdrName}</TableCell>
                     <TableCell className="text-center">{sdr.totalCalls}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{sdr.notAnsweredCalls}</TableCell>
                    <TableCell className="text-center text-amber-600">{sdr.ringDropCalls}</TableCell>
                    <TableCell className="text-center text-amber-700">{sdr.voicemailCalls}</TableCell>
                    <TableCell className="text-center text-blue-600 font-medium">{sdr.effectiveCalls}</TableCell>
                    <TableCell className="text-center text-green-600 font-semibold">{sdr.qualifiedCalls}</TableCell>
                    <TableCell className="text-center">{sdr.connectionRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-center font-medium">{sdr.qualificationRate.toFixed(1)}%</TableCell>
                     <TableCell className="text-center">{sdr.notesAdded}</TableCell>
                     <TableCell className="text-center">{sdr.stageChanges}</TableCell>
                     <TableCell className="text-center">{sdr.whatsappSent}</TableCell>
                     <TableCell className="text-center font-medium">{sdr.uniqueLeadsWorked}</TableCell>
                     <TableCell className="text-center text-muted-foreground">{sdr.avgCallsPerLead}</TableCell>
                      <TableCell className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!sdr.sdrUserId || sdr.totalCalls === 0}
                              onClick={() => setSelected({ userId: sdr.sdrUserId, name: sdr.sdrName })}
                            >
                              <ListTree className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ver ligações agrupadas por lead e exportar CSV</TooltipContent>
                        </Tooltip>
                      </TableCell>
                   </TableRow>
                 ))}
                 
                 {/* Linha de totais */}
                {(() => {
                  const total = metrics.reduce((s, m) => s + m.totalCalls, 0);
                  const ans = metrics.reduce((s, m) => s + m.answeredCalls, 0);
                  const qual = metrics.reduce((s, m) => s + m.qualifiedCalls, 0);
                  return (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-center">{total}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{metrics.reduce((s, m) => s + m.notAnsweredCalls, 0)}</TableCell>
                      <TableCell className="text-center text-amber-600">{metrics.reduce((s, m) => s + m.ringDropCalls, 0)}</TableCell>
                      <TableCell className="text-center text-amber-700">{metrics.reduce((s, m) => s + m.voicemailCalls, 0)}</TableCell>
                      <TableCell className="text-center text-blue-600">{metrics.reduce((s, m) => s + m.effectiveCalls, 0)}</TableCell>
                      <TableCell className="text-center text-green-600">{qual}</TableCell>
                      <TableCell className="text-center">{total > 0 ? ((ans / total) * 100).toFixed(1) : '0.0'}%</TableCell>
                      <TableCell className="text-center">{total > 0 ? ((qual / total) * 100).toFixed(1) : '0.0'}%</TableCell>
                      <TableCell className="text-center">{metrics.reduce((s, m) => s + m.notesAdded, 0)}</TableCell>
                      <TableCell className="text-center">{metrics.reduce((s, m) => s + m.stageChanges, 0)}</TableCell>
                      <TableCell className="text-center">{metrics.reduce((s, m) => s + m.whatsappSent, 0)}</TableCell>
                      <TableCell className="text-center">{metrics.reduce((s, m) => s + m.uniqueLeadsWorked, 0)}</TableCell>
                      <TableCell className="text-center text-muted-foreground">-</TableCell>
                       <TableCell />
                    </TableRow>
                  );
                })()}
               </TableBody>
             </Table>
           </div>
         ) : (
           <p className="text-sm text-muted-foreground py-4 text-center">
             Nenhuma atividade encontrada no período selecionado
           </p>
         )}
       </CardContent>
     </Card>
      <SdrLeadCallsDialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        sdrUserId={selected?.userId ?? null}
        sdrName={selected?.name ?? ''}
        startDate={startDate}
        endDate={endDate}
        squad={squad}
      />
   </TooltipProvider>
   );
 }