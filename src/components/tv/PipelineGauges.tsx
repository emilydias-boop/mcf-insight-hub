import { GaugeSemicircle } from "./GaugeSemicircle";
import { PIPELINE_STAGES } from "@/constants/team";

interface PipelineGaugesProps {
  funnelDataA: { etapa: string; leads: number; meta: number }[];
  funnelDataB: { etapa: string; leads: number; meta: number }[];
}

export function PipelineGauges({ funnelDataA, funnelDataB }: PipelineGaugesProps) {
  const stageOrder = [
    PIPELINE_STAGES.NOVO_LEAD,
    PIPELINE_STAGES.R1_AGENDADA,
    PIPELINE_STAGES.R1_REALIZADA,
    PIPELINE_STAGES.NO_SHOW,
    PIPELINE_STAGES.CONTRATO_PAGO,
  ];

  const getStageData = (funnelData: any[], stageName: string) => {
    const stage = funnelData.find((s) => s.etapa === stageName);
    return {
      valor: stage?.leads || 0,
      meta: stage?.meta || 0,
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">Lead A</h3>
        <div className="grid grid-cols-5 gap-4">
          {stageOrder.map((stage) => {
            const data = getStageData(funnelDataA, stage);
            return (
              <GaugeSemicircle
                key={`A-${stage}`}
                titulo={stage}
                valor={data.valor}
                meta={data.meta}
                leadType="A"
              />
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">Lead B</h3>
        <div className="grid grid-cols-5 gap-4">
          {stageOrder.map((stage) => {
            const data = getStageData(funnelDataB, stage);
            return (
              <GaugeSemicircle
                key={`B-${stage}`}
                titulo={stage}
                valor={data.valor}
                meta={data.meta}
                leadType="B"
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
