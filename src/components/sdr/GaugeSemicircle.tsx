import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface GaugeSemicircleProps {
  titulo: string;
  valor: number;
  meta: number;
  leadType?: "A" | "B";
}

export function GaugeSemicircle({ titulo, valor, meta, leadType }: GaugeSemicircleProps) {
  const percentual = meta > 0 ? Math.min((valor / meta) * 100, 100) : 0;
  
  const getColor = (percent: number) => {
    if (percent <= 35) return "#ef4444"; // red-500
    if (percent <= 75) return "#eab308"; // yellow-500
    return "#22c55e"; // green-500
  };

  const color = getColor(percentual);

  const data = [
    { name: "Atingido", value: percentual },
    { name: "Restante", value: 100 - percentual },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 sm:gap-1 p-1.5 sm:p-2 bg-card rounded border border-border flex-1 min-h-0">
      <div className="text-[10px] sm:text-xs font-medium text-center text-muted-foreground line-clamp-2 w-full px-1 min-h-[2em]">
        {titulo}
      </div>
      <div className="relative w-full">
        <ResponsiveContainer width="100%" height={50} className="sm:!h-[70px]">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius="50%"
              outerRadius="90%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Valor/Meta abaixo do arco */}
      <div className="text-[10px] sm:text-sm font-bold -mt-2" style={{ color }}>
        {valor} / {meta}
      </div>
      {/* Porcentagem abaixo */}
      <div className="text-sm sm:text-lg font-bold" style={{ color }}>
        {percentual.toFixed(0)}%
      </div>
    </div>
  );
}
