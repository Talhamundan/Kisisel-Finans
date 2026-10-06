import React, { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertTriangle,
    ArrowUpRight,
    ListChecks,
    ReceiptText,
    Search,
    TrendingDown,
} from 'lucide-react';
import { formatCurrencyPlain, tarihFormatla } from '../../utils/helpers';
import {
    COMPARISON_MODES,
    SPENDING_PRESETS,
    buildSpendingInsights,
    buildSpendingSummary,
    compareSummaries,
    formatRangeLabel,
    getComparisonRange,
    getSpendingRange,
    isOngoingRange,
} from '../../utils/spendingAnalysis';
import { ChartTooltip, EmptyState, IconTile, PremiumCard, SectionHeader, StatCard, StatusBadge } from '../Shared/PremiumUI';

const parseAmount = (value) => parseFloat(value) || 0;
const formatMoney = (value, hidden = false) => hidden ? '****' : formatCurrencyPlain(value);
const formatPercent = (value) => value === null || !Number.isFinite(value)
    ? 'Yeni'
    : `%${Math.abs(value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
const toDateInputValue = (date) => date ? date.toISOString().slice(0, 10) : '';
const todayInputValue = () => new Date().toISOString().slice(0, 10);
const getSixMonthTrendRange = (range) => {
    const end = range?.end || new Date();
    const trendEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
        start: new Date(end.getFullYear(), end.getMonth() - 5, 1, 0, 0, 0, 0),
        end: trendEnd,
    };
};
const formatAxisMoney = (value) => {
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mn TL`;
    if (Math.abs(value) >= 1000) return `${Math.round(value / 1000).toLocaleString('tr-TR')} bin TL`;
    return `${Math.round(value).toLocaleString('tr-TR')} TL`;
};

const DeltaPill = ({ diff, percent }) => {
    const isIncrease = diff > 0;
    const isNeutral = Math.abs(diff) < 0.01;
    return (
        <span className={`spending-delta ${isNeutral ? 'is-neutral' : isIncrease ? 'is-danger' : 'is-success'}`}>
            {isNeutral ? 'Değişmedi' : `${isIncrease ? '+' : '-'}${formatMoney(Math.abs(diff))} · ${formatPercent(percent)}`}
        </span>
    );
};

const TransactionMiniList = ({ rows = [], hidden, limit = 5 }) => (
    <div className="spending-mini-list">
        {rows.slice(0, limit).map((transaction) => (
            <div key={transaction.id || `${transaction.tarih}-${transaction.tutar}-${transaction.aciklama}`}>
                <span>
                    <strong>{transaction.aciklama || transaction.kategori || 'Harcama'}</strong>
                    <small>{transaction.kategori || 'Kategori yok'} · {tarihFormatla(transaction.tarih)}</small>
                </span>
                <b>{formatMoney(transaction.tutar, hidden)}</b>
            </div>
        ))}
        {rows.length === 0 && <small className="spending-muted">Detay hareket yok.</small>}
    </div>
);

const SpendingAnalysisDashboard = ({
    islemler = [],
    hesaplar = [],
    borclar = [],
    gizliMod = false,
}) => {
    const [preset, setPreset] = useState('thisMonth');
    const [comparisonMode, setComparisonMode] = useState('previousEquivalent');
    const [customRange, setCustomRange] = useState({ start: todayInputValue(), end: todayInputValue() });
    const [customComparisonRange, setCustomComparisonRange] = useState({ start: '', end: '' });
    const [selectedInsight, setSelectedInsight] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showAllLargest, setShowAllLargest] = useState(false);

    const range = useMemo(() => getSpendingRange(preset, customRange), [customRange, preset]);
    const comparisonRange = useMemo(() => getComparisonRange(range, comparisonMode, customComparisonRange), [comparisonMode, customComparisonRange, range]);
    const summary = useMemo(() => buildSpendingSummary({ transactions: islemler, accounts: hesaplar, range }), [hesaplar, islemler, range]);
    const trendRange = useMemo(() => getSixMonthTrendRange(range), [range]);
    const trendSummary = useMemo(() => buildSpendingSummary({ transactions: islemler, accounts: hesaplar, range: trendRange }), [hesaplar, islemler, trendRange]);
    const comparison = useMemo(() => buildSpendingSummary({ transactions: islemler, accounts: hesaplar, range: comparisonRange }), [comparisonRange, hesaplar, islemler]);
    const comparisonRows = useMemo(() => compareSummaries(summary, comparison), [comparison, summary]);
    const insights = useMemo(() => buildSpendingInsights({ current: summary, comparison, comparisonRows }), [comparison, comparisonRows, summary]);
    const selectedCategoryRow = selectedCategory
        ? comparisonRows.find((row) => row.name === selectedCategory)
        : null;
    const selectedInsightData = selectedInsight
        ? insights.find((item) => item.id === selectedInsight)
        : null;
    const palette = ['#6d5dfc', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#14b8a6', '#8b5cf6', '#64748b'];
    const debtBalance = (borclar || [])
        .filter((debt) => (debt.type || 'VERECEK') !== 'ALACAK')
        .filter((debt) => debt.durum !== 'completed' && debt.status !== 'completed')
        .reduce((sum, debt) => sum + parseAmount(debt.kalanTutar ?? debt.tutar ?? debt.toplamTutar), 0);
    const visibleLargest = showAllLargest ? summary.largestTransactions : summary.largestTransactions.slice(0, 5);
    const reportBullets = [
        summary.categoryRows[0] ? `En yüksek harcama ${summary.categoryRows[0].name}: ${formatMoney(summary.categoryRows[0].total, gizliMod)}.` : '',
        comparisonRows.find((row) => Math.abs(row.diff) > 0)
            ? `${comparisonRows[0].name} farkı ${comparisonRows[0].diff > 0 ? '+' : '-'}${formatMoney(Math.abs(comparisonRows[0].diff), gizliMod)}.`
            : '',
        summary.totalDebtCashOut > 0 ? `Borç ve kart ödemeleri nakit akışından ${formatMoney(summary.totalDebtCashOut, gizliMod)} çıkardı.` : '',
        summary.unplannedTotal > 0 ? `Plansız harcama toplamı ${formatMoney(summary.unplannedTotal, gizliMod)}.` : '',
    ].filter(Boolean).slice(0, 4);

    return (
        <div className="spending-analysis-page">
            <PremiumCard className="spending-control-card" hover={false}>
                <div className="spending-control-main">
                    <label>
                        <span>Dönem</span>
                        <select value={preset} onChange={(event) => setPreset(event.target.value)}>
                            {SPENDING_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                    {preset === 'custom' && (
                        <div className="spending-date-pair">
                            <input type="date" value={customRange.start} onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))} />
                            <input type="date" value={customRange.end} onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))} />
                        </div>
                    )}
                    <label>
                        <span>Karşılaştır</span>
                        <select value={comparisonMode} onChange={(event) => setComparisonMode(event.target.value)}>
                            {COMPARISON_MODES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                    </label>
                    {comparisonMode === 'custom' && (
                        <div className="spending-date-pair">
                            <input type="date" value={customComparisonRange.start} onChange={(event) => setCustomComparisonRange((current) => ({ ...current, start: event.target.value }))} />
                            <input type="date" value={customComparisonRange.end} onChange={(event) => setCustomComparisonRange((current) => ({ ...current, end: event.target.value }))} />
                        </div>
                    )}
                </div>
                <div className="spending-period-note">
                    <StatusBadge tone={isOngoingRange(range) ? 'warning' : 'neutral'}>
                        {isOngoingRange(range) ? 'Devam eden dönem' : 'Tamamlanan dönem'}
                    </StatusBadge>
                    <span>{formatRangeLabel(range)}</span>
                    <small>Karşılaştırma: {formatRangeLabel(comparisonRange)}</small>
                    <details className="spending-rules-popover">
                        <summary>Hesaplama</summary>
                        <p>Kart alışverişleri harcamadır; kart/kredi/borç ödemeleri ayrı nakit çıkışıdır. Transfer ve yatırım alımları harcama toplamına eklenmez.</p>
                    </details>
                </div>
            </PremiumCard>

            <div className="spending-overview-grid">
                <div className="spending-primary-stats">
                    <StatCard title="Toplam Harcama" value={formatMoney(summary.totalSpending, gizliMod)} description={`${summary.spending.length} hareket`} icon={ReceiptText} tone="danger" />
                    <StatCard title="Planlı" value={formatMoney(summary.plannedTotal, gizliMod)} icon={ListChecks} tone="info" />
                    <StatCard title="Plansız" value={formatMoney(summary.unplannedTotal, gizliMod)} icon={AlertTriangle} tone="warning" />
                </div>
                <PremiumCard className="spending-report-summary-card" hover={false}>
                    <span>
                        <strong>Aylık Rapor</strong>
                        <small>{formatRangeLabel(range)}</small>
                    </span>
                    <ul>
                        {(reportBullets.length > 0 ? reportBullets : ['Bu dönem için rapor oluşturacak harcama verisi yok.']).slice(0, 4).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                </PremiumCard>
            </div>

            <PremiumCard className="spending-insights-card">
                <SectionHeader
                    title="Otomatik İçgörüler"
                    description="Öncelikli değişimler"
                />
                <div className="spending-insight-list spending-insight-list--compact">
                    {insights.map((insight) => (
                        <button type="button" key={insight.id} onClick={() => setSelectedInsight(insight.id)}>
                            <IconTile icon={insight.tone === 'success' ? TrendingDown : insight.tone === 'danger' ? ArrowUpRight : AlertTriangle} tone={insight.tone} />
                            <span>
                                <strong>{insight.title}</strong>
                                <small>{insight.detail}</small>
                            </span>
                        </button>
                    ))}
                </div>
                {selectedInsightData && (
                    <div className="spending-detail-panel">
                        <SectionHeader title={selectedInsightData.title} />
                        <TransactionMiniList rows={selectedInsightData.rows} hidden={gizliMod} limit={5} />
                    </div>
                )}
            </PremiumCard>

            <div className="spending-main-grid spending-main-grid--top">
                <PremiumCard className="spending-chart-card">
                    <SectionHeader title="Aylık Eğilim" description="Seçili ay için çevresindeki son 6 ay gösterilir." />
                    <div className="spending-chart-legend">
                        <span><i className="is-spending" /> Harcama</span>
                        <span><i className="is-cashout" /> Borç nakit çıkışı</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={trendSummary.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.18)" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis tickFormatter={(value) => gizliMod ? '****' : formatAxisMoney(value)} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={70} />
                            <Tooltip
                                content={({ active, payload, label }) => active && payload?.length ? (
                                    <ChartTooltip
                                        label={label}
                                        rows={payload.map((item) => ({
                                            label: item.name,
                                            value: formatMoney(item.value, gizliMod),
                                            tone: item.dataKey === 'spending' ? 'danger' : item.dataKey === 'cashOut' ? 'purple' : 'success',
                                        }))}
                                    />
                                ) : null}
                            />
                            <Bar name="Harcama" dataKey="spending" radius={[8, 8, 0, 0]} fill="#ef4444" />
                            <Bar name="Borç nakit çıkışı" dataKey="cashOut" radius={[8, 8, 0, 0]} fill="#8b5cf6" />
                        </BarChart>
                    </ResponsiveContainer>
                </PremiumCard>

                <PremiumCard>
                    <SectionHeader title="Kategori Dağılımı" />
                    <div className="spending-category-list">
                        {summary.categoryRows.map((row, index) => {
                            const percent = summary.totalSpending > 0 ? (row.total / summary.totalSpending) * 100 : 0;
                            return (
                                <button type="button" key={row.name} onClick={() => setSelectedCategory(row.name)}>
                                    <i style={{ background: palette[index % palette.length] }} />
                                    <span>
                                        <strong>{row.name}</strong>
                                        <small>{row.count} işlem · %{Math.round(percent)}</small>
                                        <em><b style={{ width: `${Math.min(100, percent)}%`, background: palette[index % palette.length] }} /></em>
                                    </span>
                                    <b>{formatMoney(row.total, gizliMod)}</b>
                                </button>
                            );
                        })}
                        {summary.categoryRows.length === 0 && <EmptyState title="Harcama yok" description="Bu dönemde analiz edilecek gider bulunmuyor." icon={Search} />}
                    </div>
                </PremiumCard>
            </div>

            <div className="spending-main-grid spending-main-grid--narrow">
                <PremiumCard>
                    <SectionHeader
                        title="En Büyük Harcamalar"
                        description="İlk 5 işlem"
                        action={summary.largestTransactions.length > 5 ? (
                            <button type="button" className="spending-text-button" onClick={() => setShowAllLargest((value) => !value)}>
                                {showAllLargest ? 'İlk 5' : 'Tümünü göster'}
                            </button>
                        ) : null}
                    />
                    <TransactionMiniList rows={visibleLargest} hidden={gizliMod} limit={showAllLargest ? 20 : 5} />
                </PremiumCard>

                <PremiumCard className="spending-secondary-summary">
                    <span><em>Borç Nakit Çıkışı</em><b>{formatMoney(summary.totalDebtCashOut, gizliMod)}</b></span>
                    <span><em>Net Nakit Akışı</em><b className={summary.netCashFlow >= 0 ? 'is-success' : 'is-danger'}>{formatMoney(summary.netCashFlow, gizliMod)}</b></span>
                    <span><em>Dönem Sonu Borç</em><b>{formatMoney(debtBalance, gizliMod)}</b></span>
                </PremiumCard>
            </div>

            <PremiumCard>
                <SectionHeader title="Esnek Karşılaştırma" description="En anlamlı değişimler üstte." />
                <div className="spending-comparison-table">
                    <div className="spending-comparison-head">
                        <span>Kategori</span>
                        <span>Seçili Dönem</span>
                        <span>Karşılaştırma</span>
                        <span>Fark</span>
                    </div>
                    {comparisonRows.slice(0, 10).map((row) => (
                        <button type="button" key={row.name} onClick={() => setSelectedCategory(row.name)}>
                            <span>
                                <strong>{row.name}</strong>
                                <small>{row.count} / {row.previousCount} işlem</small>
                            </span>
                            <b>{formatMoney(row.current, gizliMod)}</b>
                            <em>{formatMoney(row.previous, gizliMod)}</em>
                            <DeltaPill diff={row.diff} percent={row.percent} />
                        </button>
                    ))}
                </div>
                {selectedCategoryRow && (
                    <div className="spending-detail-panel">
                        <SectionHeader
                            title={`${selectedCategoryRow.name} İşlemleri`}
                            description={`${formatMoney(selectedCategoryRow.current, gizliMod)} seçili dönem`}
                        />
                        <TransactionMiniList rows={selectedCategoryRow.transactions} hidden={gizliMod} limit={10} />
                    </div>
                )}
            </PremiumCard>
        </div>
    );
};

export default SpendingAnalysisDashboard;
