import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CloserLead } from "@/hooks/useCloserDetailData";
import { CheckCircle, DollarSign, Search, Download, X } from "lucide-react";
import * as XLSX from "xlsx";

interface CloserLeadsTableProps {
  leads: CloserLead[];
  isLoading: boolean;
  showR1Sdr?: boolean;
}

const statusLabel = (s: string) => {
  switch (s) {
    case 'contract_paid': return 'Contrato Pago';
    case 'completed': return 'Realizada';
    case 'no_show': return 'No-Show';
    case 'scheduled': return 'Agendada';
    case 'rescheduled': return 'Reagendada';
    case 'cancelled': return 'Cancelada';
    default: return s;
  }
};

export function CloserLeadsTable({ leads, isLoading, showR1Sdr = false }: CloserLeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sdrFilter, setSdrFilter] = useState("all");

  // Get unique statuses
  const statuses = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => {
      const displayStatus = l.contract_paid_at ? 'contract_paid' : l.status;
      set.add(displayStatus);
    });
    return Array.from(set).sort();
  }, [leads]);

  // Get unique SDR names
  const sdrNames = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => {
      if (showR1Sdr) {
        if (l.r1_sdr_name) set.add(l.r1_sdr_name);
        if (l.booked_by_name) set.add(l.booked_by_name);
      } else {
        if (l.booked_by_name) set.add(l.booked_by_name);
      }
    });
    return Array.from(set).sort();
  }, [leads, showR1Sdr]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      const displayStatus = l.contract_paid_at ? 'contract_paid' : l.status;
      counts[displayStatus] = (counts[displayStatus] || 0) + 1;
    });
    return counts;
  }, [leads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(l =>
        l.contact_name?.toLowerCase().includes(q) ||
        l.contact_email?.toLowerCase().includes(q) ||
        l.contact_phone?.includes(q)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(l => {
        const displayStatus = l.contract_paid_at ? 'contract_paid' : l.status;
        return displayStatus === statusFilter;
      });
    }

    if (sdrFilter !== "all") {
      filtered = filtered.filter(l =>
        l.booked_by_name === sdrFilter || l.r1_sdr_name === sdrFilter
      );
    }

    return filtered;
  }, [leads, search, statusFilter, sdrFilter]);

  const handleExport = () => {
    const data = filteredLeads.map(l => ({
      "Data": format(new Date(l.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      "Nome": l.contact_name,
      "Telefone": l.contact_phone || "",
      "Email": l.contact_email || "",
      "Status": statusLabel(l.contract_paid_at ? 'contract_paid' : l.status),
      "SDR": l.booked_by_name || "",
      "Origem": l.origin_name || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Meus Leads");
    XLSX.writeFile(wb, `meus-leads-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSdrFilter("all");
  };

  const hasActiveFilters = search || statusFilter !== "all" || sdrFilter !== "all";

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const getStatusBadge = (status: string, contractPaidAt?: string | null) => {
    const displayStatus = contractPaidAt ? 'contract_paid' : status;
    
    switch (displayStatus) {
      case 'contract_paid':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Contrato Pago
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Realizada
          </Badge>
        );
      case 'no_show':
        return (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1">
            No-Show
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1">
            Agendada
          </Badge>
        );
      case 'rescheduled':
        return (
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30 flex items-center gap-1">
            Reagendada
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Status counters */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={statusFilter === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setStatusFilter("all")}
        >
          Todos ({leads.length})
        </Badge>
        {statuses.map(s => (
          <Badge
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setStatusFilter(s)}
          >
            {statusLabel(s)} ({statusCounts[s] || 0})
          </Badge>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, email, telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {statuses.map(s => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sdrNames.length > 0 && (
          <Select value={sdrFilter} onValueChange={setSdrFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="SDR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos SDRs</SelectItem>
              {sdrNames.map(n => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredLeads.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      {filteredLeads.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <p>Nenhum lead encontrado{hasActiveFilters ? " com os filtros selecionados" : " no período"}.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-muted-foreground">Data</TableHead>
                  <TableHead className="text-muted-foreground">Lead</TableHead>
                  <TableHead className="text-muted-foreground">Telefone</TableHead>
                  <TableHead className="text-muted-foreground">{showR1Sdr ? 'SDR (R1)' : 'SDR'}</TableHead>
                  {showR1Sdr && <TableHead className="text-muted-foreground">Agendado por</TableHead>}
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.attendee_id} className="hover:bg-muted/30">
                    <TableCell className="font-medium whitespace-nowrap">
                      {format(new Date(lead.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{lead.contact_name}</div>
                        {lead.contact_email && (
                          <div className="text-xs text-muted-foreground">{lead.contact_email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.contact_phone || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {showR1Sdr ? (lead.r1_sdr_name || '-') : (lead.booked_by_name || '-')}
                    </TableCell>
                    {showR1Sdr && (
                      <TableCell className="text-muted-foreground">
                        {lead.booked_by_name || '-'}
                      </TableCell>
                    )}
                    <TableCell className="flex items-center gap-1">
                      {getStatusBadge(lead.status, lead.contract_paid_at)}
                    {lead.is_followup && (
                        <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px] px-1.5">
                          Follow-up
                        </Badge>
                      )}
                      {lead.is_manual && (
                        <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px] px-1.5">
                          Manual
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.origin_name ? (
                        <Badge variant="outline" className="text-xs">
                          {lead.origin_name}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
