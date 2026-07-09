import './FinanceEventCard.css';

const FinanceEventCard = ({
    badge,
    title,
    amount,
    amountTone = 'neutral',
    accentColor = '#6366f1',
    metaLabel,
    metaValue,
    action,
}) => {
    return (
        <div className="finance-event-card" style={{ '--event-accent': accentColor }}>
            <div className="finance-event-card__top">
                <p className="finance-event-card__title">{title}</p>
                {amount && (
                    <span className={`finance-event-card__amount finance-event-card__amount--${amountTone}`}>
                        {amount}
                    </span>
                )}
            </div>

            {badge && <span className="finance-event-card__badge">{badge}</span>}

            {(metaLabel || metaValue || action) && (
                <div className="finance-event-card__footer">
                    {(metaLabel || metaValue) && (
                        <div className="finance-event-card__meta">
                            {metaLabel && <span className="finance-event-card__meta-label">{metaLabel}</span>}
                            {metaValue && <span className="finance-event-card__meta-value">{metaValue}</span>}
                        </div>
                    )}
                    {action && <div className="finance-event-card__action">{action}</div>}
                </div>
            )}
        </div>
    );
};

export default FinanceEventCard;
