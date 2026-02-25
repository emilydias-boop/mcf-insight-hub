 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Phone, PhoneIncoming, FileText, ArrowRightLeft, MessageCircle, Users } from "lucide-react";
 import { useSdrActivityMetrics, SdrActivityMetrics } from "@/hooks/useSdrActivityMetrics";
 
interface SdrActivityMetricsTableProps {
  startDate: Date;
  endDate: Date;
  originId?: string;
  squad?: string;
}

export function SdrActivityMetricsTable({ startDate, endDate, originId, squad }: SdrActivityMetricsTableProps) {
  const { data: metrics, isLoading, error } = useSdrActivityMetrics(startDate, endDate, originId, squad);
 
   if (error) {
     return (
       <Card>
         <CardContent className="py-6">
           <p className="text-sm text-destructive">Erro ao carregar métricas de atividades</p>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <CardTitle className="text-lg flex items-center gap-2">
           <Phone className="h-5 w-5" />
           Atividades por SDR
         </CardTitle>
         <CardDescription>
           Resumo de ligações, notas e movimentações no período selecionado
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
                     <div className="flex items-center justify-center gap-1">
                       <Phone className="h-3.5 w-3.5" />
                       Ligações
                     </div>
                   </TableHead>
                   <TableHead className="text-center whitespace-nowrap">
                     <div className="flex items-center justify-center gap-1">
                       <PhoneIncoming className="h-3.5 w-3.5" />
                       Atendidas
                     </div>
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
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {metrics.map((sdr) => (
                   <TableRow key={sdr.sdrEmail}>
                     <TableCell className="font-medium whitespace-nowrap">{sdr.sdrName}</TableCell>
                     <TableCell className="text-center">{sdr.totalCalls}</TableCell>
                     <TableCell className="text-center">
                       <span className={sdr.answeredCalls > 0 ? "text-green-600 font-medium" : ""}>
                         {sdr.answeredCalls}
                       </span>
                     </TableCell>
                     <TableCell className="text-center">{sdr.notesAdded}</TableCell>
                     <TableCell className="text-center">{sdr.stageChanges}</TableCell>
                     <TableCell className="text-center">{sdr.whatsappSent}</TableCell>
                     <TableCell className="text-center font-medium">{sdr.uniqueLeadsWorked}</TableCell>
                     <TableCell className="text-center text-muted-foreground">{sdr.avgCallsPerLead}</TableCell>
                   </TableRow>
                 ))}
                 
                 {/* Linha de totais */}
                 <TableRow className="bg-muted/50 font-semibold">
                   <TableCell>Total</TableCell>
                   <TableCell className="text-center">
                     {metrics.reduce((sum, m) => sum + m.totalCalls, 0)}
                   </TableCell>
                   <TableCell className="text-center text-green-600">
                     {metrics.reduce((sum, m) => sum + m.answeredCalls, 0)}
                   </TableCell>
                   <TableCell className="text-center">
                     {metrics.reduce((sum, m) => sum + m.notesAdded, 0)}
                   </TableCell>
                   <TableCell className="text-center">
                     {metrics.reduce((sum, m) => sum + m.stageChanges, 0)}
                   </TableCell>
                   <TableCell className="text-center">
                     {metrics.reduce((sum, m) => sum + m.whatsappSent, 0)}
                   </TableCell>
                   <TableCell className="text-center">
                     {metrics.reduce((sum, m) => sum + m.uniqueLeadsWorked, 0)}
                   </TableCell>
                   <TableCell className="text-center text-muted-foreground">-</TableCell>
                 </TableRow>
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
   );
 }