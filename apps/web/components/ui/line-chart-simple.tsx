interface LineChartItem {
  label: string;
  value: number;
  formattedValue?: string;
}

interface LineChartSimpleProps {
  title: string;
  description?: string;
  data: LineChartItem[];
  legend?: string;
  headerExtra?: React.ReactNode;
  emptyMessage?: string;
}

export function LineChartSimple({
  title,
  description,
  data,
  legend,
  headerExtra,
  emptyMessage = 'No hay datos disponibles',
}: LineChartSimpleProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartH = 160;
  const chartPadTop = 16;
  const chartPadBottom = 0;
  const usableH = chartH - chartPadTop - chartPadBottom;

  const yForValue = (v: number) =>
    chartPadTop + usableH - (v / maxValue) * usableH;

  // Build SVG polyline points — evenly spaced across the width
  const buildPoints = (width: number) =>
    data
      .map((d, i) => {
        const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
        const y = yForValue(d.value);
        return `${x},${y}`;
      })
      .join(' ');

  // Gradient polygon (fill under line)
  const buildAreaPoints = (width: number) => {
    const line = data.map((d, i) => {
      const x = data.length === 1 ? width / 2 : (i / (data.length - 1)) * width;
      const y = yForValue(d.value);
      return `${x},${y}`;
    });
    return `0,${chartH} ${line.join(' ')} ${data.length === 1 ? width / 2 : width},${chartH}`;
  };

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-col space-y-1.5 pb-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
          <div className="flex items-center gap-3">
            {headerExtra}
            {legend && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground">{legend}</span>
              </div>
            )}
          </div>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="p-6">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="relative" style={{ height: chartH }}>
            {/* Dashed grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border-t border-dashed border-border h-0 w-full" />
              ))}
            </div>

            {/* SVG line chart */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible"
              preserveAspectRatio="none"
              viewBox={`0 0 400 ${chartH}`}
            >
              {/* Area fill */}
              <polygon
                points={buildAreaPoints(400)}
                className="fill-primary/10"
              />
              {/* Line */}
              <polyline
                points={buildPoints(400)}
                fill="none"
                className="stroke-primary"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {/* Dots */}
              {data.map((d, i) => {
                const x = data.length === 1 ? 200 : (i / (data.length - 1)) * 400;
                const y = yForValue(d.value);
                return (
                  <g key={d.label}>
                    <circle cx={x} cy={y} r="5" className="fill-primary stroke-card" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    {/* Tooltip on hover */}
                    <title>{d.formattedValue ?? `${d.label}: ${d.value}`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
        {/* X-axis labels */}
        {data.length > 0 && (
          <div className="flex justify-between mt-3">
            {data.map((item) => (
              <span key={item.label} className="text-xs text-muted-foreground font-medium flex-1 text-center">
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
