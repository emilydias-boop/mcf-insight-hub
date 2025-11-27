import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface SdrData {
  nome: string;
  email: string;
  novoLead: number;
  r1Agendada: number;
  r1Realizada: number;
  noShow: number;
  convRate: number;
  score: number;
  trend?: "up" | "down" | "stable";
}

interface SdrPerformanceTableProps {
  sdrs: SdrData[];
}

export function SdrPerformanceTable({ sdrs }: SdrPerformanceTableProps) {
  const getTrendIcon = (trend?: "up" | "down" | "stable") => {
    if (trend === "up") return <ArrowUp className="h-4 w-4 text-success" />;
    if (trend === "down") return <ArrowDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const sortedSdrs = [...sdrs].sort((a, b) => b.score - a.score);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-base font-bold w-12">#</TableHead>
            <TableHead className="text-base font-bold min-w-[180px]">SDR</TableHead>
            <TableHead className="text-base font-bold text-center">Novo Lead</TableHead>
            <TableHead className="text-base font-bold text-center">R1 Agend</TableHead>
            <TableHead className="text-base font-bold text-center">R1 Real</TableHead>
            <TableHead className="text-base font-bold text-center">No-Show</TableHead>
            <TableHead className="text-base font-bold text-center">Conv %</TableHead>
            <TableHead className="text-base font-bold text-center">Score</TableHead>
            <TableHead className="text-base font-bold text-center">Trend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSdrs.map((sdr, index) => (
            <TableRow key={sdr.email} className="hover:bg-muted/50 border-border">
              <TableCell className="font-semibold text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-semibold text-foreground">{sdr.nome}</TableCell>
              <TableCell className="text-center font-medium">{sdr.novoLead}</TableCell>
              <TableCell className="text-center font-medium">{sdr.r1Agendada}</TableCell>
              <TableCell className="text-center font-medium">{sdr.r1Realizada}</TableCell>
              <TableCell className="text-center font-medium text-destructive">{sdr.noShow}</TableCell>
              <TableCell className="text-center font-bold text-success">{sdr.convRate}%</TableCell>
              <TableCell className="text-center font-bold text-primary text-lg">{sdr.score}</TableCell>
              <TableCell className="text-center">{getTrendIcon(sdr.trend)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
