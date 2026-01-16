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
        <ResponsiveContainer width="100%" height={55} className="sm:!h-[75px]">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius="55%"
              outerRadius="85%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Valor/Meta centralizado no arco */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ top: '25%' }}>
          <span className="text-xs sm:text-base font-bold" style={{ color }}>
            {valor} / {meta}
          </span>
        </div>
      </div>
      {/* Porcentagem abaixo com fonte maior */}
      <div className="text-base sm:text-xl font-bold -mt-1" style={{ color }}>
        {percentual.toFixed(0)}%
      </div>
    </div>
  );
}
