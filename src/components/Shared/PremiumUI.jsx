import React from 'react';
import { Search, Inbox } from 'lucide-react';

export const PremiumCard = ({
    children,
    className = '',
    tone = '',
    hover = true,
    as: component = 'section',
    ...props
}) => React.createElement(
    component,
    {
        className: `qw-card ${hover ? 'qw-card--hover' : ''} ${tone ? `qw-card--${tone}` : ''} ${className}`.trim(),
        ...props,
    },
    children
);

export const SectionHeader = ({ eyebrow, title, description, action }) => (
    <div className="qw-section-header">
        <div>
            {eyebrow && <span className="qw-eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
            {description && <p>{description}</p>}
        </div>
        {action && <div className="qw-section-action">{action}</div>}
    </div>
);

export const IconTile = ({ icon: Icon, tone = 'neutral', className = '' }) => (
    <span className={`qw-icon-tile qw-icon-tile--${tone} ${className}`.trim()}>
        {Icon && <Icon size={20} strokeWidth={2.25} />}
    </span>
);

export const StatusBadge = ({ children, tone = 'neutral', className = '' }) => (
    <span className={`qw-badge qw-badge--${tone} ${className}`.trim()}>
        {children}
    </span>
);

export const MetricChangeBadge = ({ children, tone = 'neutral' }) => (
    <StatusBadge tone={tone}>{children}</StatusBadge>
);

export const StatCard = ({
    title,
    value,
    description,
    icon,
    tone = 'neutral',
    badge,
    children,
}) => (
    <PremiumCard className="qw-stat-card">
        <div className="qw-stat-card__top">
            <IconTile icon={icon} tone={tone} />
            {badge && <MetricChangeBadge tone={tone}>{badge}</MetricChangeBadge>}
        </div>
        <div className="qw-stat-card__body">
            <p>{title}</p>
            <strong>{value}</strong>
            {description && <span>{description}</span>}
        </div>
        {children && <div className="qw-stat-card__visual">{children}</div>}
    </PremiumCard>
);

export const ChartTooltip = ({ label, rows = [] }) => (
    <div className="qw-chart-tooltip">
        {label && <div className="qw-chart-tooltip__label">{label}</div>}
        {rows.map((row) => (
            <div className="qw-chart-tooltip__row" key={`${row.label}-${row.value}`}>
                <span>{row.label}</span>
                <strong className={row.tone ? `is-${row.tone}` : ''}>{row.value}</strong>
            </div>
        ))}
    </div>
);

export const EmptyState = ({ title = 'Veri bulunamadı', description, icon: Icon = Inbox }) => (
    <div className="qw-empty-state">
        <IconTile icon={Icon} tone="neutral" />
        <strong>{title}</strong>
        {description && <span>{description}</span>}
    </div>
);

export const TransactionRow = ({
    icon,
    tone = 'neutral',
    title,
    meta,
    amount,
    amountTone,
    onClick,
    actions,
}) => (
    <div className="qw-transaction-row" onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
        <IconTile icon={icon} tone={tone} />
        <div className="qw-row-main">
            <strong>{title}</strong>
            <span>{meta}</span>
        </div>
        <div className="qw-row-side">
            <strong className={amountTone ? `is-${amountTone}` : ''}>{amount}</strong>
            {actions && <div className="qw-row-actions">{actions}</div>}
        </div>
    </div>
);

export const UpcomingPaymentRow = ({
    icon,
    tone = 'warning',
    title,
    meta,
    amount,
    badge,
    onClick,
}) => (
    <button type="button" className="qw-payment-row" onClick={onClick}>
        <IconTile icon={icon} tone={tone} />
        <span className="qw-row-main">
            <strong>{title}</strong>
            <span>{meta}</span>
        </span>
        <span className="qw-row-side">
            {badge && <StatusBadge tone={tone}>{badge}</StatusBadge>}
            <strong>{amount}</strong>
        </span>
    </button>
);

export const DashboardToolbar = ({
    searchValue,
    onSearchChange,
    categoryValue,
    onCategoryChange,
    categories = [],
    actions,
}) => (
    <div className="qw-dashboard-toolbar">
        <label className="qw-search-field">
            <Search size={17} strokeWidth={2.3} />
            <input
                type="text"
                placeholder="İşlem, kategori veya tutar ara"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
            />
        </label>
        <select value={categoryValue} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="Tümü">Tüm kategoriler</option>
            {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
            ))}
        </select>
        {actions && <div className="qw-toolbar-actions">{actions}</div>}
    </div>
);
