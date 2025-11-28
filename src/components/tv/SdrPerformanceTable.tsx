import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SdrData {
  nome: string;
  email: string;
  novoLead: number;
  r1Agendada: number;
  convRate: number;
  noShow: number;
  r1Realizada: number;
  intermediacao: number;
  score: number;
}

interface SdrPerformanceTableProps {
  sdrs: SdrData[];
  dealsWithoutCloser?: number;
}

export function SdrPerformanceTable({ sdrs, dealsWithoutCloser = 0 }: SdrPerformanceTableProps) {
  const sortedSdrs = [...sdrs].sort((a, b) => b.score - a.score);

  // Calcular totais
  const totals = sortedSdrs.reduce(
    (acc, sdr) => ({
      novoLead: acc.novoLead + sdr.novoLead,
      r1Agendada: acc.r1Agendada + sdr.r1Agendada,
      noShow: acc.noShow + sdr.noShow,
      r1Realizada: acc.r1Realizada + sdr.r1Realizada,
      intermediacao: acc.intermediacao + sdr.intermediacao,
    }),
    { novoLead: 0, r1Agendada: 0, noShow: 0, r1Realizada: 0, intermediacao: 0 }
  );

  const totalConvRate = totals.novoLead > 0 
    ? Math.round((totals.r1Agendada / totals.novoLead) * 100) 
    : 0;

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {dealsWithoutCloser > 0 && (
        <div className="mb-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded flex items-center gap-2 text-xs shrink-0">
          <span className="text-destructive">⚠️</span>
          <span className="text-destructive font-semibold">{dealsWithoutCloser} deals sem closer atribuído</span>
        </div>
      )}
      <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-xs font-bold w-8 p-2">#</TableHead>
              <TableHead className="text-xs font-bold min-w-[100px] p-2">SDR</TableHead>
              <TableHead className="text-xs font-bold text-center p-2">Novo Lead</TableHead>
              <TableHead className="text-xs font-bold text-center p-2">R1 Agend</TableHead>
              <TableHead className="text-xs font-bold text-center p-2">Conv %</TableHead>
              <TableHead className="text-xs font-bold text-center p-2">No-Show</TableHead>
              <TableHead className="text-xs font-bold text-center p-2">R1 Real</TableHead>
              <TableHead className="text-xs font-bold text-center p-2">Interm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSdrs.map((sdr, index) => (
              <TableRow key={sdr.email} className="hover:bg-muted/50 border-border">
                <TableCell className="font-semibold text-muted-foreground text-xs p-2">{index + 1}</TableCell>
                <TableCell className="font-semibold text-foreground text-xs p-2">{sdr.nome}</TableCell>
                <TableCell className="text-center font-medium text-xs p-2">{sdr.novoLead}</TableCell>
                <TableCell className="text-center font-medium text-xs p-2">{sdr.r1Agendada}</TableCell>
                <TableCell className="text-center font-bold text-primary text-xs p-2">{sdr.convRate}%</TableCell>
                <TableCell className="text-center font-medium text-destructive text-xs p-2">{sdr.noShow}</TableCell>
                <TableCell className="text-center font-medium text-xs p-2">{sdr.r1Realizada}</TableCell>
                <TableCell className="text-center font-bold text-success text-xs p-2">{sdr.intermediacao}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-primary/10 font-bold border-t-2 border-primary">
              <TableCell className="p-2"></TableCell>
              <TableCell className="text-primary font-bold text-xs p-2">TOTAL</TableCell>
              <TableCell className="text-center font-bold text-xs p-2">{totals.novoLead}</TableCell>
              <TableCell className="text-center font-bold text-xs p-2">{totals.r1Agendada}</TableCell>
              <TableCell className="text-center font-bold text-primary text-xs p-2">{totalConvRate}%</TableCell>
              <TableCell className="text-center font-bold text-destructive text-xs p-2">{totals.noShow}</TableCell>
              <TableCell className="text-center font-bold text-xs p-2">{totals.r1Realizada}</TableCell>
              <TableCell className="text-center font-bold text-success text-xs p-2">{totals.intermediacao}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
