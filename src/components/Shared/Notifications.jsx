import React from 'react';
import { cardStyle, formatCurrencyPlain } from '../../utils/helpers';

const Notifications = ({
    bildirimler,
    gizliMod,
    abonelikOde,
    taksitOde,
    maasYatir,
    modalAc,
    besOdemeYap
}) => {

    const formatPara = (tutar) => gizliMod ? "**** ₺" : formatCurrencyPlain(tutar);

    if (bildirimler.length === 0) return null;

    return (
        <div style={{ marginBottom: '30px', background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '10px', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, color: '#c53030', display: 'flex', alignItems: 'center', gap: '5px' }}>⚠️ Bekleyen İşlemler</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                {bildirimler.map((b, i) => (
                    <div key={i} style={{ ...cardStyle, padding: '10px', borderRadius: '8px', borderLeft: `4px solid ${b.renk === 'green' ? '#48bb78' : b.renk === 'orange' ? '#ed8936' : '#fc8181'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748' }}>{b.mesaj}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontWeight: 'bold', color: b.renk === 'green' ? '#48bb78' : b.renk === 'orange' ? '#ed8936' : '#e53e3e' }}>{formatPara(b.tutar)}</span>
                            {b.tip !== 'kk_hatirlatma' && <button onClick={() => {
                                if (b.tip === 'abonelik') abonelikOde(b.data);
                                if (b.tip === 'taksit') taksitOde(b.data);
                                if (b.tip === 'maas') maasYatir(b.data);
                                if (b.tip === 'fatura') modalAc('fatura_ode', b.data);
                                if (b.tip === 'borc_hatirlatma') modalAc('borc_ode', b.data);
                                if (b.tip === 'bes_odeme') besOdemeYap();
                                if (b.tip === 'alacak') modalAc('tahsilat_ekle', b.data);
                            }} style={{ background: (b.renk === 'green' || b.tip === 'alacak') ? '#48bb78' : '#c53030', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>{b.tip === 'maas' ? 'Yatır' : b.tip === 'alacak' ? 'Ödeme Al' : 'Öde'}</button>}
                            {b.tip === 'kk_hatirlatma' && <button onClick={() => modalAc('kredi_karti_ode', b.data)} style={{ background: '#ed8936', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px' }}>Öde</button>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Notifications;
