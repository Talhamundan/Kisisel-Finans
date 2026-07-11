import React from 'react';
import { Home, Briefcase, Target, CalendarDays, Banknote } from 'lucide-react';

const items = [
    { id: 'butcem', label: 'Ana Sayfa', icon: Home },
    { id: 'maasAnalizi', label: 'Maaş', icon: Banknote },
    { id: 'yatirimlar', label: 'Yatırım', icon: Briefcase },
    { id: 'hedefler', label: 'Envanter', icon: Target },
    { id: 'takvim', label: 'Takvim', icon: CalendarDays },
];

const MobileNav = ({ anaSekme, setAnaSekme }) => {
    return (
        <nav className="mobile-bottom-nav show-on-mobile" aria-label="Mobil navigasyon">
            {items.map(({ id, label, icon: Icon }) => {
                const isActive = anaSekme === id;

                return (
                    <button
                        key={id}
                        type="button"
                        className={`mobile-bottom-nav__item ${isActive ? 'is-active' : ''}`}
                        onClick={() => setAnaSekme(id)}
                    >
                        {React.createElement(Icon, { size: 22, strokeWidth: isActive ? 2.8 : 2.2 })}
                        <span>{label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default MobileNav;
