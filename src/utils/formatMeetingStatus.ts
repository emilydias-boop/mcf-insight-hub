const statusMap: Record<string, string> = {
  invited: "Agendado",
  scheduled: "Agendado",
  completed: "Realizada",
  no_show: "No-show",
  contract_paid: "Contrato Pago",
  rescheduled: "Reagendado",
  cancelled: "Cancelado",
};

export function formatMeetingStatus(status: string | null | undefined): string {
  if (!status) return "N/A";
  return statusMap[status.toLowerCase()] || status;
}
