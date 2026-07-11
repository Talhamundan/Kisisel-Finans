import React from 'react';
import { Home, Briefcase, Target, CalendarDays, Banknote } from 'lucide-react';

const MobileNav = ({ anaSekme, setAnaSekme }) => {
    return (
        <div className="show-on-mobile" style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '70px',
            backgroundColor: '#ffffff',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '8px 16px 18px 16px',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
        }}>
            <button
                onClick={() => setAnaSekme('butcem')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color: anaSekme === 'butcem' ? '#805ad5' : '#a0aec0',
                    padding: 0,
                    flex: 1
                }}
            >
                <Home size={22} strokeWidth={anaSekme === 'butcem' ? 3 : 2} />
                <span style={{ fontSize: 10, fontWeight: anaSekme === 'butcem' ? 'bold' : 'normal' }}>Ana Sayfa</span>
            </button>

            <button
                onClick={() => setAnaSekme('maasAnalizi')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color: anaSekme === 'maasAnalizi' ? '#805ad5' : '#a0aec0',
                    padding: 0,
                    flex: 1
                }}
            >
                <Banknote size={22} strokeWidth={anaSekme === 'maasAnalizi' ? 3 : 2} />
                <span style={{ fontSize: 10, fontWeight: anaSekme === 'maasAnalizi' ? 'bold' : 'normal' }}>Maaş</span>
            </button>

            <button
                onClick={() => setAnaSekme('yatirimlar')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color: anaSekme === 'yatirimlar' ? '#805ad5' : '#a0aec0',
                    padding: 0,
                    flex: 1
                }}
            >
                <Briefcase size={22} strokeWidth={anaSekme === 'yatirimlar' ? 3 : 2} />
                <span style={{ fontSize: 10, fontWeight: anaSekme === 'yatirimlar' ? 'bold' : 'normal' }}>Yatırım</span>
            </button>

            <button
                onClick={() => setAnaSekme('hedefler')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color: anaSekme === 'hedefler' ? '#805ad5' : '#a0aec0',
                    padding: 0,
                    flex: 1
                }}
            >
                <Target size={22} strokeWidth={anaSekme === 'hedefler' ? 3 : 2} />
                <span style={{ fontSize: 10, fontWeight: anaSekme === 'hedefler' ? 'bold' : 'normal' }}>Envanter</span>
            </button>

            <button
                onClick={() => setAnaSekme('takvim')}
                style={{
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    color: anaSekme === 'takvim' ? '#805ad5' : '#a0aec0',
                    padding: 0,
                    flex: 1
                }}
            >
                <CalendarDays size={22} strokeWidth={anaSekme === 'takvim' ? 3 : 2} />
                <span style={{ fontSize: 10, fontWeight: anaSekme === 'takvim' ? 'bold' : 'normal' }}>Takvim</span>
            </button>
        </div>
    );
};

export default MobileNav;
