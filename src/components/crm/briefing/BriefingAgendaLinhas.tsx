/** Linhas curtas do briefing na grade/lista das agendas (dados vêm do useBriefingsResumo em lote). */
type Info = { resumo: string; alerta: string } | undefined;

export function BriefingAlertaInline({ info }: { info: Info }) {
  if (!info?.alerta) return null;
  return (
    <span className="truncate max-w-[45%] text-[10px] text-amber-600 dark:text-amber-400" title={info.alerta}>
      ⚠ {info.alerta}
    </span>
  );
}

export function BriefingLinhas({ info, comResumo = true }: { info: Info; comResumo?: boolean }) {
  if (!info || (!info.alerta && !(comResumo && info.resumo))) return null;
  return (
    <div className="min-w-0 space-y-px">
      {info.alerta && <div className="text-[11px] text-amber-600 dark:text-amber-400 truncate" title={info.alerta}>{info.alerta}</div>}
      {comResumo && info.resumo && <div className="text-[11px] text-muted-foreground truncate" title={info.resumo}>{info.resumo}</div>}
    </div>
  );
}
