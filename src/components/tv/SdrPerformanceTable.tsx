import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SdrData {
  nome: string;
  email: string;
  novoLead: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  convRate: number;
  score: number;
}

interface SdrPerformanceTableProps {
  sdrs: SdrData[];
}

export function SdrPerformanceTable({ sdrs }: SdrPerformanceTableProps) {
  const sortedSdrs = [...sdrs].sort((a, b) => b.score - a.score);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-xs font-bold w-8 p-2">#</TableHead>
            <TableHead className="text-xs font-bold min-w-[120px] p-2">SDR</TableHead>
            <TableHead className="text-xs font-bold text-center p-2">Novo Lead</TableHead>
            <TableHead className="text-xs font-bold text-center p-2">R1 Agend</TableHead>
            <TableHead className="text-xs font-bold text-center p-2">R1 Real</TableHead>
            <TableHead className="text-xs font-bold text-center p-2">No-Show</TableHead>
            <TableHead className="text-xs font-bold text-center p-2">Conv %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSdrs.map((sdr, index) => (
            <TableRow key={sdr.email} className="hover:bg-muted/50 border-border">
              <TableCell className="font-semibold text-muted-foreground text-xs p-2">{index + 1}</TableCell>
              <TableCell className="font-semibold text-foreground text-xs p-2">{sdr.nome}</TableCell>
              <TableCell className="text-center font-medium text-xs p-2">{sdr.novoLead}</TableCell>
              <TableCell className="text-center font-medium text-xs p-2">{sdr.r1Agendada}</TableCell>
              <TableCell className="text-center font-medium text-xs p-2">{sdr.r1Realizada}</TableCell>
              <TableCell className="text-center font-medium text-destructive text-xs p-2">{sdr.noShow}</TableCell>
              <TableCell className="text-center font-bold text-success text-xs p-2">{sdr.convRate}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
