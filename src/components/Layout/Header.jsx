import React from 'react';
import {
    Bell,
    Banknote,
    CalendarDays,
    Eye,
    EyeOff,
    Home,
    KeyRound,
    LogOut,
    Moon,
    Search,
    Settings,
    Target,
    UserRound,
    WalletCards,
} from 'lucide-react';
import { MONTH_NAMES } from '../../utils/period';
import AppLogo from '../Shared/AppLogo';

const navItems = [
    { id: 'butcem', label: 'Bütçem', icon: Home },
    { id: 'maasAnalizi', label: 'Maaş Analizi', icon: Banknote },
    { id: 'yatirimlar', label: 'Yatırımlar', icon: WalletCards },
    { id: 'hedefler', label: 'Hedefler', icon: Target },
    { id: 'takvim', label: 'Takvim', icon: CalendarDays },
];

const pageMeta = {
    butcem: ['Bütçem', 'Finansal durumuna genel bakış'],
    maasAnalizi: ['Maaş Analizi', 'Maaş dönemindeki gelir, harcama ve kalan tutarı incele'],
    yatirimlar: ['Yatırımlar', 'Portföy ve varlık performansı'],
    hedefler: ['Hedefler', 'Envanter ve birikim planları'],
    takvim: ['Finans Takvimi', 'Yaklaşan hareketlerini izle'],
};

const Header = ({
    anaSekme,
    setAnaSekme,
    gizliMod,
    setGizliMod,
    user,
    setAktifModal,
    koddanCikis,
    cikisYap,
    selectedPeriod,
    setSelectedPeriod,
    availablePeriods,
    showPeriodFilter = true
}) => {
    const years = availablePeriods?.years?.length ? availablePeriods.years : [selectedPeriod.year];
    const availableMonths = availablePeriods?.monthsByYear?.[selectedPeriod.year] || [];
    const [title, description] = pageMeta[anaSekme] || pageMeta.butcem;
    const userName = user?.displayName?.split(' ')[0] || 'Profil';
    const initial = userName?.[0]?.toLocaleUpperCase('tr-TR') || 'P';

    return (
        <>
            <aside className="qw-sidebar hide-on-mobile" aria-label="Ana navigasyon">
                <div className="qw-brand">
                    <AppLogo size="md" showText />
                </div>

                <nav className="qw-sidebar-nav">
                    {navItems.map(({ id, label, icon }) => (
                        <button
                            key={id}
                            type="button"
                            className={`qw-nav-item ${anaSekme === id ? 'is-active' : ''}`}
                            onClick={() => setAnaSekme(id)}
                        >
                            {React.createElement(icon, { size: 19, strokeWidth: 2.25 })}
                            <span>{label}</span>
                        </button>
                    ))}
                </nav>

                <div className="qw-sidebar-bottom">
                    <button type="button" className="qw-nav-item" onClick={() => setAktifModal('ayarlar_yonetim')}>
                        <Settings size={19} strokeWidth={2.25} />
                        <span>Ayarlar</span>
                    </button>
                    <button type="button" className="qw-nav-item" onClick={koddanCikis}>
                        <KeyRound size={19} strokeWidth={2.25} />
                        <span>Alan Kodu</span>
                    </button>
                    <button type="button" className="qw-nav-item" onClick={cikisYap}>
                        <LogOut size={19} strokeWidth={2.25} />
                        <span>Çıkış Yap</span>
                    </button>
                </div>
            </aside>

            <header className="qw-topbar app-header">
                <div className="qw-topbar-title">
                    <h1>{title}</h1>
                    <p>{description}</p>
                </div>

                <div className="qw-topbar-actions">
                    <label className="qw-global-search hide-on-mobile">
                        <Search size={17} strokeWidth={2.25} />
                        <input type="search" placeholder="Global arama" aria-label="Global arama" />
                    </label>

                    {showPeriodFilter && (
                        <div className="period-filter qw-period-filter" aria-label="Dönem filtresi">
                            <select
                                className="period-filter__select period-filter__select--month"
                                value={selectedPeriod.month}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setSelectedPeriod((prev) => ({ ...prev, month: value === 'all' ? 'all' : Number(value) }));
                                }}
                                aria-label="Ay seç"
                            >
                                <option value="all">Tümü</option>
                                {availableMonths.map((month) => (
                                    <option key={month} value={month}>{MONTH_NAMES[month - 1]}</option>
                                ))}
                            </select>
                            <select
                                className="period-filter__select period-filter__select--year"
                                value={selectedPeriod.year}
                                onChange={(event) => {
                                    const year = Number(event.target.value);
                                    const months = availablePeriods?.monthsByYear?.[year] || [];
                                    setSelectedPeriod((prev) => ({
                                        year,
                                        month: prev.month === 'all' || months.includes(prev.month) ? prev.month : (months[0] || 'all'),
                                    }));
                                }}
                                aria-label="Yıl seç"
                            >
                                {years.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button type="button" className="qw-icon-button" aria-label="Bildirimler">
                        <Bell size={18} strokeWidth={2.25} />
                    </button>
                    <button
                        type="button"
                        className="qw-icon-button"
                        aria-label={gizliMod ? 'Tutarları göster' : 'Tutarları gizle'}
                        onClick={() => setGizliMod(!gizliMod)}
                    >
                        {gizliMod ? <EyeOff size={18} strokeWidth={2.25} /> : <Eye size={18} strokeWidth={2.25} />}
                    </button>
                    <button type="button" className="qw-icon-button" aria-label="Tema">
                        <Moon size={18} strokeWidth={2.25} />
                    </button>
                    <button type="button" className="qw-profile-pill" onClick={() => setAktifModal('ayarlar_yonetim')}>
                        <span className="qw-avatar">{initial}</span>
                        <span className="hide-on-mobile">{userName}</span>
                        <UserRound className="hide-on-mobile" size={16} strokeWidth={2.25} />
                    </button>
                </div>
            </header>
        </>
    );
};

export default Header;
