import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart,
} from 'recharts';

/* Chart palette — matches design-standard accents.
   NOTE: purple/violet is reserved exclusively for AI advisory UI, so it is
   deliberately absent here. `violet` key is repurposed to teal to avoid
   touching every call-site. Status colours: red=danger, amber=moderate, green=safe. */
export const C = {
  blue: '#3b7de8',
  line: '#5b8de0',
  violet: '#0d9488',   // repurposed → teal-600 (no purple in charts)
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  cyan: '#22d3ee',
  slate: '#64748b',
  teal: '#14b8a6',
  pink: '#ec4899',
};
export const ZONE_COLORS = ['#3b7de8', '#22d3ee', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#60a5fa', '#f97316', '#0ea5e9', '#84cc16', '#94a3b8'];

const axisStyle = { fontSize: 11, fill: 'var(--app-text-faint)' };
/* compact number formatter for axis ticks (12 400 → 12.4k) so the Y axis
   stays narrow and never clips the plot area */
const kfmt = (n) => {
  if (n == null) return '';
  const a = Math.abs(n);
  if (a >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (a >= 1000) return `${(n / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return `${n}`;
};
const truncate = (s, n = 18) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n - 1)}…` : s);

const tooltipStyle = {
  contentStyle: {
    background: 'var(--app-chart-tooltip-bg)',
    border: '1px solid var(--app-chart-tooltip-border)',
    borderRadius: 10, fontSize: 11.5, color: 'var(--app-text)', boxShadow: 'var(--app-shadow-md)',
  },
  labelStyle: { color: 'var(--app-text-muted)', fontWeight: 700, marginBottom: 4 },
  itemStyle: { padding: '1px 0' },
};
const legendStyle = { fontSize: 11, color: 'var(--app-text-muted)', paddingTop: 4 };

export function Grid() {
  return <CartesianGrid stroke="var(--app-chart-grid)" vertical={false} />;
}

/** Multi-series line/area trend */
export function TrendChart({ data, x, series, height = 220, type = 'line', stacked = false, yDomain, rightAxisKeys = [], xAngle = 0, unit }) {
  // recharts' plain LineChart container silently drops <Area> children (no grid/axis/series
  // render at all) — any series with area:true needs ComposedChart (or AreaChart) instead.
  const hasArea = type === 'area' || series.some((s) => s.area);
  const Chart = rightAxisKeys.length || hasArea ? ComposedChart : LineChart;
  const multi = series.length > 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: rightAxisKeys.length ? 6 : 14, bottom: xAngle ? 22 : 4, left: 4 }}>
        <Grid />
        <XAxis dataKey={x} tick={axisStyle} tickLine={false} axisLine={{ stroke: 'var(--app-chart-grid)' }}
          interval="preserveStartEnd" minTickGap={24} tickMargin={8}
          angle={xAngle ? -xAngle : 0} textAnchor={xAngle ? 'end' : 'middle'} height={xAngle ? 40 : 24} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={yDomain} width={40}
          tickFormatter={kfmt} tickMargin={4} allowDecimals={false} unit={unit} />
        {rightAxisKeys.length > 0 && <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} width={38} tickFormatter={kfmt} />}
        <Tooltip {...tooltipStyle} />
        {multi && <Legend wrapperStyle={legendStyle} iconSize={9} iconType="plainline" />}
        {series.map((s) =>
          rightAxisKeys.includes(s.key) ? (
            <Line key={s.key} isAnimationActive={false} yAxisId="right" type="monotone" dataKey={s.key} name={s.name} stroke={s.color}
              strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray={s.dash ? '5 3' : undefined} />
          ) : type === 'area' || s.area ? (
            <Area key={s.key} isAnimationActive={false} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.color}
              fillOpacity={0.16} strokeWidth={2.2} stackId={stacked ? 'a' : undefined} dot={false} activeDot={{ r: 4 }} />
          ) : (
            <Line key={s.key} isAnimationActive={false} type="monotone" dataKey={s.key} name={s.name} stroke={s.color}
              strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} strokeDasharray={s.dash ? '5 3' : undefined} />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

/** Vertical bars, optionally stacked */
export function Bars({ data, x, series, height = 220, stacked = false, layout = 'horizontal', hideLegend = false, catWidth = 132 }) {
  const vertical = layout === 'vertical';
  const multi = series.length > 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 14, bottom: 4, left: vertical ? 4 : 4 }} barCategoryGap={vertical ? '18%' : '22%'}>
        <CartesianGrid stroke="var(--app-chart-grid)" horizontal={!vertical} vertical={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={kfmt} tickMargin={4} allowDecimals={false} />
            <YAxis type="category" dataKey={x} tick={{ ...axisStyle, fontSize: 10.5 }} tickLine={false} axisLine={false}
              width={catWidth} tickFormatter={(v) => truncate(v, 20)} interval={0} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={axisStyle} tickLine={false} axisLine={{ stroke: 'var(--app-chart-grid)' }}
              interval={0} minTickGap={4} tickMargin={8} tickFormatter={(v) => truncate(v, 12)} height={24} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} tickFormatter={kfmt} tickMargin={4} allowDecimals={false} />
          </>
        )}
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--app-chart-grid)' }} />
        {!hideLegend && multi && <Legend wrapperStyle={legendStyle} iconSize={9} />}
        {series.map((s) => (
          <Bar key={s.key} isAnimationActive={false} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined}
            radius={stacked ? [0, 0, 0, 0] : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={vertical ? 22 : 46}>
            {s.cellColors && data.map((d, i) => <Cell key={i} fill={s.cellColors(d)} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut chart */
export function Donut({ data, nameKey, valueKey, height = 220, colors = ZONE_COLORS, centerLabel }) {
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Pie data={data} isAnimationActive={false} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="84%"
            paddingAngle={2} strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={d.color || colors[i % colors.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={legendStyle} iconSize={9} layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: '32%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--app-text)', lineHeight: 1 }}>{centerLabel.value ?? total}</span>
          {centerLabel.label && <span style={{ fontSize: 10, color: 'var(--app-text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{centerLabel.label}</span>}
        </div>
      )}
    </div>
  );
}

/** Radar — HPO readiness domains */
export function RadarPanel({ data, angleKey, series, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="70%" margin={{ top: 10, right: 24, bottom: 10, left: 24 }}>
        <PolarGrid stroke="var(--app-chart-grid)" />
        <PolarAngleAxis dataKey={angleKey} tick={{ fontSize: 10.5, fill: 'var(--app-text-muted)' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tickCount={5} tick={{ fontSize: 9, fill: 'var(--app-text-faint)' }} axisLine={false} />
        {series.map((s) => (
          <Radar key={s.key} isAnimationActive={false} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.2} strokeWidth={2} dot={{ r: 2.5, fill: s.color }} />
        ))}
        <Tooltip {...tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
