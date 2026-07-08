import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
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

const axisStyle = { fontSize: 10, fill: 'var(--app-text-faint)' };
const tooltipStyle = {
  contentStyle: {
    background: 'var(--app-chart-tooltip-bg)',
    border: '1px solid var(--app-chart-tooltip-border)',
    borderRadius: 10, fontSize: 11, color: 'var(--app-text)',
  },
  labelStyle: { color: 'var(--app-text-muted)', fontWeight: 600 },
  itemStyle: { padding: 0 },
};
const legendStyle = { fontSize: 11, color: 'var(--app-text-muted)' };

export function Grid() {
  return <CartesianGrid stroke="var(--app-chart-grid)" vertical={false} />;
}

/** Multi-series line/area trend */
export function TrendChart({ data, x, series, height = 220, type = 'line', stacked = false, yDomain, rightAxisKeys = [] }) {
  const Chart = rightAxisKeys.length ? ComposedChart : type === 'area' ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
        <Grid />
        <XAxis dataKey={x} tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} domain={yDomain} width={54} />
        {rightAxisKeys.length > 0 && <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} width={50} />}
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={legendStyle} iconSize={9} />
        {series.map((s) =>
          rightAxisKeys.includes(s.key) ? (
            <Line key={s.key} yAxisId="right" type="monotone" dataKey={s.key} name={s.name} stroke={s.color}
              strokeWidth={2} dot={false} strokeDasharray={s.dash ? '5 3' : undefined} />
          ) : type === 'area' || s.area ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={s.color}
              fillOpacity={0.14} strokeWidth={2} stackId={stacked ? 'a' : undefined} dot={false} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color}
              strokeWidth={2} dot={false} strokeDasharray={s.dash ? '5 3' : undefined} />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

/** Vertical bars, optionally stacked */
export function Bars({ data, x, series, height = 220, stacked = false, layout = 'horizontal', hideLegend = false }) {
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 6, right: 8, bottom: 0, left: vertical ? 30 : -14 }}>
        <Grid />
        {vertical ? (
          <>
            <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey={x} tick={{ ...axisStyle, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={54} />
          </>
        )}
        <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {!hideLegend && series.length > 1 && <Legend wrapperStyle={legendStyle} iconSize={9} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={stacked ? 'a' : undefined}
            radius={stacked ? [0, 0, 0, 0] : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={26}>
            {s.cellColors && data.map((d, i) => <Cell key={i} fill={s.cellColors(d)} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut chart */
export function Donut({ data, nameKey, valueKey, height = 220, colors = ZONE_COLORS }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="55%" outerRadius="82%"
          paddingAngle={2} strokeWidth={0}>
          {data.map((d, i) => <Cell key={i} fill={d.color || colors[i % colors.length]} />)}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={legendStyle} iconSize={9} layout="vertical" align="right" verticalAlign="middle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Radar — HPO readiness domains */
export function RadarPanel({ data, angleKey, series, height = 240 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--app-chart-grid)" />
        <PolarAngleAxis dataKey={angleKey} tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--app-text-faint)' }} axisLine={false} />
        {series.map((s) => (
          <Radar key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.18} strokeWidth={2} />
        ))}
        <Tooltip {...tooltipStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
