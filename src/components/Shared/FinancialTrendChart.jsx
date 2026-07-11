import React from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { LineChart } from 'lucide-react';
import { ChartTooltip, EmptyState, PremiumCard, SectionHeader } from './PremiumUI';

const compactCurrency = (value) => `${new Intl.NumberFormat('tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 1,
}).format(value)} ₺`;

const defaultFormatter = (value) => new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
}).format(value || 0);

const TrendTooltip = ({ active, payload, labelFormatter, valueFormatter = defaultFormatter, rows }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload || {};

    return (
        <ChartTooltip
            label={labelFormatter ? labelFormatter(item) : item.tooltipLabel}
            rows={rows(item, valueFormatter)}
        />
    );
};

const FinancialTrendChart = ({
    title,
    subtitle,
    data = [],
    series = [],
    summary,
    valueFormatter = defaultFormatter,
    yTickFormatter = compactCurrency,
    tooltipRows,
    tooltipLabel,
    emptyTitle,
    emptyDescription,
    emptyIcon = LineChart,
    className = '',
    areaClassName = 'qw-chart-area',
    headerControl,
}) => {
    const visibleSeries = series.filter((item) => item?.key);
    const hasData = data.some((item) => visibleSeries.some((serie) => Math.abs(Number(item[serie.key]) || 0) > 0));
    const hasNegativeValues = data.some((item) => visibleSeries.some((serie) => (Number(item[serie.key]) || 0) < 0));

    const tooltipRowBuilder = tooltipRows || ((item, formatter) => visibleSeries.map((serie) => ({
        label: serie.label,
        value: formatter(item[serie.key] || 0),
        tone: typeof serie.tone === 'function' ? serie.tone(item[serie.key] || 0, item) : serie.tone,
    })));

    return (
        <PremiumCard className={className}>
            <SectionHeader
                title={title}
                description={subtitle}
                action={(
                    <div className="qw-chart-header-action">
                        {headerControl}
                        <div className="qw-chart-legend">
                            {visibleSeries.map((serie) => (
                                <span
                                    key={serie.key}
                                    className={typeof serie.tone === 'string' ? `is-${serie.tone}` : ''}
                                    style={{ '--legend-color': serie.color }}
                                >
                                    {serie.legendLabel || serie.label}
                                </span>
                            ))}
                            {summary && (
                                <span
                                    className={summary.tone ? `is-${summary.tone}` : ''}
                                    style={{ '--legend-color': summary.color }}
                                >
                                    {summary.label} {summary.value}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            />
            {hasData ? (
                <div className={areaClassName}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                {visibleSeries.map((serie) => (
                                    <linearGradient key={serie.key} id={`${serie.key}Gradient`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={serie.color} stopOpacity={serie.fillOpacity ?? 0.16} />
                                        <stop offset="100%" stopColor={serie.color} stopOpacity={serie.fillOpacityEnd ?? 0.015} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid vertical={false} stroke="rgba(17, 24, 39, 0.06)" />
                            {hasNegativeValues && <ReferenceLine y={0} stroke="rgba(17, 24, 39, 0.18)" strokeWidth={1.2} />}
                            <XAxis dataKey="name" tick={{ fill: '#98a2b3', fontSize: 12 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: '#98a2b3', fontSize: 12 }} tickLine={false} axisLine={false} width={58} tickFormatter={yTickFormatter} />
                            <Tooltip content={<TrendTooltip rows={tooltipRowBuilder} valueFormatter={valueFormatter} labelFormatter={tooltipLabel} />} />
                            {visibleSeries.map((serie) => (
                                <Area
                                    key={serie.key}
                                    type="monotone"
                                    dataKey={serie.key}
                                    stroke={serie.color}
                                    strokeWidth={serie.strokeWidth ?? 2.1}
                                    strokeDasharray={serie.dashed ? '5 5' : undefined}
                                    fill={`url(#${serie.key}Gradient)`}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />
            )}
        </PremiumCard>
    );
};

export default FinancialTrendChart;
