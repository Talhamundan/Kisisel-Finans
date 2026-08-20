import React, { useMemo, useState } from 'react';
import { formatCurrencyPlain } from '../../utils/helpers';

const CREDIT_CARD_LIMIT_ACK_KEY = 'kisisel_finans_kk_limit_ack_v1';

const readAcknowledgedCreditCardLimitAlerts = () => {
    try {
        const rawValue = window.localStorage.getItem(CREDIT_CARD_LIMIT_ACK_KEY);
        const parsed = rawValue ? JSON.parse(rawValue) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
};

const persistAcknowledgedCreditCardLimitAlert = (key) => {
    try {
        const next = readAcknowledgedCreditCardLimitAlerts();
        next.add(key);
        window.localStorage.setItem(CREDIT_CARD_LIMIT_ACK_KEY, JSON.stringify([...next]));
    } catch {
        // Bildirim yine ekrandan kalksın; kalıcı saklama desteklenmiyorsa sessiz geç.
    }
};

const notificationAccent = (renk) => {
    if (renk === 'green') return '#48bb78';
    if (renk === 'orange') return '#ed8936';
    return '#fc8181';
};

const notificationAmountColor = (renk) => {
    if (renk === 'green') return '#48bb78';
    if (renk === 'orange') return '#ed8936';
    return '#e53e3e';
};

const notificationButtonColor = (renk) => {
    if (renk === 'green') return '#48bb78';
    if (renk === 'orange') return '#ed8936';
    return '#c53030';
};

const buttonLabel = (tip) => {
    if (tip === 'kk_limit') return 'Tamam';
    if (tip === 'maas') return 'Yatır';
    if (tip === 'alacak') return 'Ödeme Al';
    return 'Öde';
};

const Notifications = ({
    bildirimler,
    gizliMod,
    abonelikOde,
    taksitOde,
    maasYatir,
    modalAc,
    besOdemeYap
}) => {
    const [dismissedIds, setDismissedIds] = useState(() => readAcknowledgedCreditCardLimitAlerts());
    const formatPara = (tutar) => gizliMod ? "**** ₺" : formatCurrencyPlain(tutar);
    const visibleNotifications = useMemo(
        () => (bildirimler || []).filter((b) => !dismissedIds.has(b.id || b.mesaj)),
        [bildirimler, dismissedIds]
    );

    const handleNotificationAction = (b) => {
        if (b.tip === 'kk_limit') {
            const key = b.id || b.mesaj;
            persistAcknowledgedCreditCardLimitAlert(key);
            setDismissedIds((current) => {
                const next = new Set(current);
                next.add(key);
                return next;
            });
            return;
        }
        if (b.tip === 'abonelik') abonelikOde(b.data);
        if (b.tip === 'taksit') taksitOde(b.data);
        if (b.tip === 'maas') maasYatir(b.data);
        if (b.tip === 'fatura') modalAc('fatura_ode', b.data);
        if (b.tip === 'borc_hatirlatma') modalAc('borc_ode', b.data);
        if (b.tip === 'bes_odeme') besOdemeYap();
        if (b.tip === 'alacak') modalAc('tahsilat_ekle', b.data);
        if (b.tip === 'kk_hatirlatma') modalAc('kredi_karti_ode', b.data);
    };

    if (visibleNotifications.length === 0) return null;

    return (
        <div style={{ marginBottom: '8px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, color: '#c53030', display: 'flex', alignItems: 'center', gap: '5px' }}>⏳ Bekleyen İşlemler</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                {visibleNotifications.map((b, i) => {
                    const accentColor = notificationAccent(b.renk);
                    const amountColor = notificationAmountColor(b.renk);
                    const buttonColor = notificationButtonColor(b.renk);

                    return (
                        <div
                            key={i}
                            style={{
                                background: '#ffffff',
                                border: '1px solid rgba(15, 23, 42, 0.08)',
                                borderLeft: `4px solid ${accentColor}`,
                                borderRadius: '8px',
                                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
                                padding: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px',
                                minHeight: '82px',
                            }}
                        >
                            <span style={{
                                color: '#2d3748',
                                fontSize: '14px',
                                fontWeight: 600,
                                lineHeight: 1.45,
                                minWidth: 0,
                            }}>
                                {b.mesaj}
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 auto' }}>
                                <span style={{ color: amountColor, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                    {formatPara(b.tutar)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleNotificationAction(b)}
                                    style={{
                                        background: buttonColor,
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '5px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        padding: '5px 10px',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {buttonLabel(b.tip)}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Notifications;
