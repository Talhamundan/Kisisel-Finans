import React, { useMemo, useState } from 'react';
import { Hourglass } from 'lucide-react';
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

const NOTIFICATION_TONES = {
    kk_hatirlatma: {
        accent: '#d97706',
        amount: '#c75b00',
        button: '#d97706',
        background: '#fff4e6',
    },
    kk_limit: {
        accent: '#d97706',
        amount: '#c75b00',
        button: '#d97706',
        background: '#fff4e6',
    },
    abonelik: {
        accent: '#2563eb',
        amount: '#1d4ed8',
        button: '#2563eb',
        background: '#eff6ff',
    },
    taksit: {
        accent: '#7c3aed',
        amount: '#6d28d9',
        button: '#7c3aed',
        background: '#f5f3ff',
    },
    fatura: {
        accent: '#e11d48',
        amount: '#be123c',
        button: '#e11d48',
        background: '#fff1f2',
    },
    borc_hatirlatma: {
        accent: '#e11d48',
        amount: '#be123c',
        button: '#e11d48',
        background: '#fff1f2',
    },
    bes_odeme: {
        accent: '#0f766e',
        amount: '#0f766e',
        button: '#0f766e',
        background: '#f0fdfa',
    },
    maas: {
        accent: '#047857',
        amount: '#047857',
        button: '#047857',
        background: '#ecfdf5',
    },
    alacak: {
        accent: '#059669',
        amount: '#047857',
        button: '#059669',
        background: '#ecfdf5',
    },
};

const URGENCY_TONES = {
    red: {
        accent: 'var(--destructive)',
        amount: 'var(--destructive)',
        button: 'var(--destructive)',
        background: 'var(--danger-soft)',
    },
    orange: {
        accent: 'var(--warning)',
        amount: 'var(--warning)',
        button: 'var(--warning)',
        background: 'var(--warning-soft)',
    },
    green: {
        accent: 'var(--success)',
        amount: 'var(--success)',
        button: 'var(--success)',
        background: 'var(--success-soft)',
    },
};

const notificationTone = (notification) => {
    if (notification?.renk === 'red') return URGENCY_TONES.red;
    return NOTIFICATION_TONES[notification?.tip] || URGENCY_TONES[notification?.renk] || URGENCY_TONES.orange;
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
        <section className="qw-notifications-panel">
            <div className="qw-notifications-header">
                <h2><Hourglass size={16} strokeWidth={2.35} aria-hidden="true" /> Bekleyen İşlemler</h2>
            </div>
            <div className="qw-notifications-grid">
                {visibleNotifications.map((b, i) => {
                    const tone = notificationTone(b);

                    return (
                        <div
                            key={i}
                            className="qw-notification-card"
                            style={{
                                '--notification-accent': tone.accent,
                                '--notification-amount': tone.amount,
                                '--notification-button': tone.button,
                                '--notification-bg': tone.background,
                            }}
                        >
                            <span className="qw-notification-message">
                                {b.mesaj}
                            </span>

                            <div className="qw-notification-actions">
                                <span>
                                    {formatPara(b.tutar)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleNotificationAction(b)}
                                >
                                    {buttonLabel(b.tip)}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default Notifications;
