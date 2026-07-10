import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Sector } from 'recharts';
import { formatCurrencyPlain } from '../../utils/helpers';
import { DONUT_PALETTE } from './chartPalettes';

const chartText = {
    fill: '#0f172a',
    fontFamily: 'inherit',
};

const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, opacity } = props;

    return (
        <Sector
            cx={cx}
            cy={cy}
            innerRadius={innerRadius}
            outerRadius={outerRadius + 3}
            startAngle={startAngle}
            endAngle={endAngle}
            fill={fill}
            opacity={opacity}
            cornerRadius={8}
        />
    );
};

const DonutTooltip = ({ active, payload, formatValue }) => {
    if (!active || !payload?.length) return null;
    const item = payload.find((entry) => !entry?.payload?.isRemainder);
    if (!item) return null;
    const data = item.payload;

    return (
        <div style={{
            background: '#ffffff',
            border: '1px solid rgba(148, 163, 184, 0.28)',
            borderRadius: 12,
            padding: '10px 12px',
            minWidth: 132,
        }}>
            <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                {data.name}
            </div>
            <div style={{ color: '#0f172a', fontSize: 15, fontWeight: 900, lineHeight: 1.1 }}>
                {formatValue(data.value)}
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 800, marginTop: 4 }}>
                %{data.yuzde}
            </div>
        </div>
    );
};

const getCenterValueSize = (value) => {
    const length = String(value || '').length;
    if (length > 18) return 13;
    if (length > 14) return 15;
    return 17;
};

const PremiumDonutChart = ({
    data = [],
    title,
    centerValue,
    centerLabel,
    formatValue = formatCurrencyPlain,
    valueSuffix = '',
    height = 220,
    innerRadius = 66,
    outerRadius = 88,
    palette = DONUT_PALETTE,
}) => {
    const [activeIndex, setActiveIndex] = React.useState(null);

    const visibleData = React.useMemo(() => {
        const cleanData = (data || [])
            .map((item, index) => ({
                ...item,
                value: Math.max(0, parseFloat(item.value) || 0),
                color: item.color || palette[index % palette.length],
            }))
            .filter((item) => item.value > 0);

        const total = cleanData.reduce((sum, item) => sum + item.value, 0);
        if (total <= 0) return [];

        return cleanData.map((item) => ({
            ...item,
            yuzde: Math.round((item.value / total) * 100),
        }));
    }, [data, palette]);

    const hasData = visibleData.length > 0;
    const displayValue = centerValue ?? formatValue(visibleData.reduce((sum, item) => sum + item.value, 0));
    const centerValueSize = getCenterValueSize(displayValue);

    if (!hasData) return null;

    return (
        <div style={{ width: '100%' }}>
            {title && (
                <div style={{ color: '#334155', fontSize: 12, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>
                    {title}
                </div>
            )}
            <div style={{ width: '100%', height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={visibleData}
                            cx="50%"
                            cy="50%"
                            innerRadius={innerRadius}
                            outerRadius={outerRadius}
                            startAngle={90}
                            endAngle={-270}
                            paddingAngle={visibleData.length === 1 ? 0 : 3}
                            cornerRadius={visibleData.length === 1 ? 0 : 8}
                            dataKey="value"
                            activeIndex={activeIndex}
                            activeShape={renderActiveShape}
                            animationDuration={650}
                            animationEasing="ease-out"
                            onMouseEnter={(_, index) => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(null)}
                        >
                            {visibleData.map((entry, index) => (
                                <Cell
                                    key={`${entry.name}-${index}`}
                                    fill={entry.color}
                                    stroke="#ffffff"
                                    strokeWidth={3}
                                    opacity={
                                        activeIndex === null || activeIndex === index
                                            ? 1
                                            : 0.42
                                    }
                                    style={{ transition: 'opacity 180ms ease' }}
                                />
                            ))}
                        </Pie>
                        <text
                            x="50%"
                            y={centerLabel ? '47%' : '50%'}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            style={{ ...chartText, fontSize: centerValueSize, fontWeight: 900 }}
                        >
                            {displayValue}{valueSuffix}
                        </text>
                        {centerLabel && (
                            <text
                                x="50%"
                                y="57%"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{ fill: '#94a3b8', fontSize: 10.5, fontWeight: 800, letterSpacing: 0 }}
                            >
                                {centerLabel}
                            </text>
                        )}
                        <Tooltip content={<DonutTooltip formatValue={formatValue} />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PremiumDonutChart;
