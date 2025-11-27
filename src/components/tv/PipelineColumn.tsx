import { GaugeSemicircle } from "./GaugeSemicircle";
import { PIPELINE_STAGES } from "@/constants/team";

interface PipelineColumnProps {
  funnelData: { etapa: string; leads: number; meta: number }[];
  leadType: "A" | "B";
}

export function PipelineColumn({ funnelData, leadType }: PipelineColumnProps) {
  const stageOrder = [
    PIPELINE_STAGES.NOVO_LEAD,
    PIPELINE_STAGES.R1_AGENDADA,
    PIPELINE_STAGES.R1_REALIZADA,
    PIPELINE_STAGES.NO_SHOW,
    PIPELINE_STAGES.CONTRATO_PAGO,
  ];

  const getStageData = (stageName: string) => {
    const stage = funnelData.find((s) => s.etapa === stageName);
    return {
      valor: stage?.leads || 0,
      meta: stage?.meta || 0,
    };
  };

  return (
    <div className="flex flex-col justify-between h-full">
      {stageOrder.map((stage) => {
        const data = getStageData(stage);
        return (
          <GaugeSemicircle
            key={`${leadType}-${stage}`}
            titulo={stage}
            valor={data.valor}
            meta={data.meta}
            leadType={leadType}
          />
        );
      })}
    </div>
  );
}
