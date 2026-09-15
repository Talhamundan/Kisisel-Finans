import React from 'react';
import {
    Bell,
    Banknote,
    CalendarDays,
    ClipboardList,
    Eye,
    EyeOff,
    Home,
    Landmark,
    LogOut,
    Moon,
    Settings,
    Sun,
    Target,
    UserRound,
    WalletCards,
} from 'lucide-react';
import { MONTH_NAMES } from '../../utils/period';
import { titleCaseTr } from '../../utils/helpers';
import AppLogo from '../Shared/AppLogo';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Separator } from '../ui/separator';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarProvider,
    SidebarTrigger,
} from '../ui/sidebar';

const navItems = [
    { id: 'butcem', label: 'Dashboard', icon: Home },
    { id: 'maasAnalizi', label: 'Maaş Analizi', icon: Banknote },
    { id: 'yatirimlar', label: 'Yatırımlar', icon: WalletCards },
    { id: 'finansmanlar', label: 'Finansmanlar', icon: Landmark },
    { id: 'tanimlamalar', label: 'Tanımlamalar', icon: ClipboardList },
    { id: 'hedefler', label: 'Varlıklar', icon: Target },
    { id: 'takvim', label: 'Takvim', icon: CalendarDays },
];

const pageMeta = {
    butcem: ['Dashboard', 'Finansal durumuna genel bakış'],
    maasAnalizi: ['Maaş Analizi', 'Maaş dönemindeki gelir, harcama ve kalan tutarı incele'],
    yatirimlar: ['Yatırımlar', 'Portföy ve varlık performansı'],
    hedefler: ['Varlıklar', 'Envanter ve birikim planları'],
    takvim: ['Finans Takvimi', 'Yaklaşan hareketlerini izle'],
    finansmanlar: ['Finansmanlar', 'Kredi ve nakit avans takibi'],
    tanimlamalar: ['Tanımlamalar', 'Sabit gider, fatura ve taksit takip alanı'],
    ayarlar: ['Ayarlar', 'Tanımlar, kategoriler ve veri yönetimi'],
};

const Header = ({
    anaSekme,
    setAnaSekme,
    gizliMod,
    setGizliMod,
    user,
    cikisYap,
    selectedPeriod,
    setSelectedPeriod,
    availablePeriods,
    showPeriodFilter = true,
    theme = 'light',
    onThemeToggle
}) => {
    const years = availablePeriods?.years?.length ? availablePeriods.years : [selectedPeriod.year];
    const availableMonths = availablePeriods?.monthsByYear?.[selectedPeriod.year] || [];
    const [title, description] = pageMeta[anaSekme] || pageMeta.butcem;
    const displayTitle = titleCaseTr(title);
    const displayDescription = titleCaseTr(description);
    const userName = user?.displayName?.split(' ')[0] || 'Profil';
    const initial = userName?.[0]?.toLocaleUpperCase('tr-TR') || 'P';

    return (
        <SidebarProvider>
            <Sidebar className="qw-sidebar hide-on-mobile" aria-label="Ana navigasyon">
                <SidebarHeader className="qw-brand">
                    <AppLogo size="md" showText />
                </SidebarHeader>

                <SidebarContent>
                    <SidebarMenu className="qw-sidebar-nav">
                        {navItems.map(({ id, label, icon: Icon }) => (
                            <SidebarMenuButton
                                key={id}
                                isActive={anaSekme === id}
                                onClick={() => setAnaSekme(id)}
                                title={label}
                            >
                                {React.createElement(Icon, { size: 19, strokeWidth: 2.25 })}
                                <span>{label}</span>
                            </SidebarMenuButton>
                        ))}
                    </SidebarMenu>
                </SidebarContent>

                <SidebarFooter className="qw-sidebar-bottom">
                    <Separator />
                    <SidebarMenuButton isActive={anaSekme === 'ayarlar'} onClick={() => setAnaSekme('ayarlar')} title="Ayarlar">
                        <Settings size={19} strokeWidth={2.25} />
                        <span>Ayarlar</span>
                    </SidebarMenuButton>
                    <SidebarMenuButton onClick={cikisYap} title="Çıkış Yap">
                        <LogOut size={19} strokeWidth={2.25} />
                        <span>Çıkış Yap</span>
                    </SidebarMenuButton>
                </SidebarFooter>
            </Sidebar>

            <header className="qw-topbar app-header">
                <div className="qw-topbar-left">
                    <SidebarTrigger className="hide-on-mobile" />
                    <div className="qw-topbar-title">
                        <h1>{displayTitle}</h1>
                        <p>{displayDescription}</p>
                    </div>
                </div>

                <div className="qw-topbar-actions">
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

                    <Button type="button" variant="outline" size="icon" className="qw-icon-button" aria-label="Bildirimler">
                        <Bell size={18} strokeWidth={2.25} />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="qw-icon-button"
                        aria-label={gizliMod ? 'Tutarları göster' : 'Tutarları gizle'}
                        onClick={() => setGizliMod(!gizliMod)}
                    >
                        {gizliMod ? <EyeOff size={18} strokeWidth={2.25} /> : <Eye size={18} strokeWidth={2.25} />}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="qw-icon-button"
                        aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
                        onClick={onThemeToggle}
                    >
                        {theme === 'dark'
                            ? <Sun size={18} strokeWidth={2.25} />
                            : <Moon size={18} strokeWidth={2.25} />}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <button type="button" className="qw-profile-pill">
                                <Avatar className="qw-avatar">
                                    <AvatarFallback>{initial}</AvatarFallback>
                                </Avatar>
                                <span className="hide-on-mobile">{userName}</span>
                                <UserRound className="hide-on-mobile" size={16} strokeWidth={2.25} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setAnaSekme('ayarlar')}>
                                <Settings size={16} strokeWidth={2.25} />
                                Ayarlar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={cikisYap}>
                                <LogOut size={16} strokeWidth={2.25} />
                                Çıkış Yap
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
        </SidebarProvider>
    );
};

export default Header;
