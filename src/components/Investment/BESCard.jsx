import React, { useState } from 'react';
import { cardStyle, formatCurrencyPlain, inputStyle } from '../../utils/helpers';
import HighQualityModal from '../Shared/HighQualityModal';
import { isDateInPeriod } from '../../utils/period';
import PremiumDonutChart from '../Shared/PremiumDonutChart';

const BESCard = ({
    besVerisi,
    toplamBesYatirimi,
    hesaplar,
    besOdemeYap,
    besOdemeIsle,
    besGuncelle,
    islemEkle,
    modalAc,
    aktifYatirimAy,
    selectedPeriod,
    yatirimIslemleri,
    gizliMod
}) => {

    // Privacy Helper
    const formatPara = (tutar) => gizliMod ? "**** ₺" : formatCurrencyPlain(tutar);

    // Safety check mostly for initial load
    const veri = besVerisi || {};
    const guncelTutar = veri.guncelTutar || 0;

    // --- STATE FOR MODALS ---
    const [modalState, setModalState] = useState({ type: null });

    // Form States
    // 1. Durum Güncelle
    const [formGuncelTutar, setFormGuncelTutar] = useState("");
    const [formGuncelDevlet, setFormGuncelDevlet] = useState("");

    // 2. Fon Düzenle
    const [formFonlar, setFormFonlar] = useState([]);

    // 3. Ayarlar
    const [formOdemeGunu, setFormOdemeGunu] = useState("");
    const [formDurum, setFormDurum] = useState("aktif");
    const [formVarsayilanTutar, setFormVarsayilanTutar] = useState("");
    const [formVarsayilanHesap, setFormVarsayilanHesap] = useState("");

    // 4. Ödeme Ekle
    const [formOdemeTutar, setFormOdemeTutar] = useState("");
    const [formOdemeHesapId, setFormOdemeHesapId] = useState("");
    const [formOdemeTarih, setFormOdemeTarih] = useState("");

    // Calculcations
    const kesintiler = veri.kesintiler || [];
    const toplamKesinti = kesintiler.reduce((acc, k) => acc + (parseFloat(k.tutar) || 0), 0);
    const devletKatkisi = (veri.guncelDevletKatkisi !== undefined && veri.guncelDevletKatkisi !== null)
        ? veri.guncelDevletKatkisi
        : (toplamBesYatirimi * 0.30);
    const netAnaPara = toplamBesYatirimi - toplamKesinti;
    const netGetiri = guncelTutar - netAnaPara;

    let seciliAyYatirilan = 0;
    let seciliAyKesinti = 0;
    const ayFiltresiVar = Boolean(selectedPeriod);

    if (ayFiltresiVar) {
        if (yatirimIslemleri) {
            seciliAyYatirilan = yatirimIslemleri
                .filter(islem => islem.kategori === 'BES' && isDateInPeriod(islem.tarih, selectedPeriod))
                .reduce((acc, curr) => acc + (parseFloat(curr.tutar) || 0), 0);
        }
        seciliAyKesinti = kesintiler
            .filter(k => isDateInPeriod(k.tarih, selectedPeriod))
            .reduce((acc, k) => acc + (parseFloat(k.tutar) || 0), 0);
    }
    const seciliAyNetYatirim = seciliAyYatirilan - seciliAyKesinti;

    const fonDagilimi = veri.fonlar && veri.fonlar.length > 0 ? veri.fonlar : [];
    const fonDagilimiToplam = fonDagilimi.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
    const fonDagilimiVar = fonDagilimiToplam > 0;

    // --- HANDLERS ---
    const closeModal = () => setModalState({ type: null });

    const openDurumGuncelle = () => {
        setFormGuncelTutar(guncelTutar);
        setFormGuncelDevlet(devletKatkisi);
        setModalState({ type: 'durum_guncelle' });
    };

    const handleDurumSubmit = (e) => {
        e.preventDefault();
        besGuncelle({
            ...veri,
            guncelTutar: parseFloat(formGuncelTutar),
            guncelDevletKatkisi: formGuncelDevlet ? parseFloat(formGuncelDevlet) : null
        });
        closeModal();
    };

    const openFonDuzenle = () => {
        let current = fonDagilimi.length > 0 ? [...fonDagilimi] : [{ name: '', value: '' }];
        while (current.length < 4) current.push({ name: '', value: '' });
        setFormFonlar(current);
        setModalState({ type: 'fon_duzenle' });
    };

    const handleFonChange = (index, field, value) => {
        const newFonlar = [...formFonlar];
        newFonlar[index] = { ...newFonlar[index], [field]: value };
        setFormFonlar(newFonlar);
    };

    const handleFonSubmit = (e) => {
        e.preventDefault();
        const results = [];
        let total = 0;
        formFonlar.forEach(f => {
            const val = parseFloat(f.value);
            if (f.name && !isNaN(val) && val > 0) {
                results.push({ name: f.name.toUpperCase(), value: val });
                total += val;
            }
        });

        if (results.length > 0 && Math.abs(total - 100) > 1) {
            alert(`Toplam oran % 100 olmalı!(Şu an: % ${total})`);
            return;
        }
        besGuncelle({ ...veri, fonlar: results });
        closeModal();
    };

    const openAyarlar = () => {
        setFormOdemeGunu(veri.odemeGunu || 15);
        setFormDurum(veri.durum || 'aktif');
        setFormVarsayilanTutar(veri.varsayilanTutar || '');
        setFormVarsayilanHesap(veri.varsayilanHesapId || '');
        setModalState({ type: 'ayarlar' });
    };

    const handleAyarlarSubmit = (e) => {
        e.preventDefault();
        besGuncelle({
            ...veri,
            odemeGunu: parseInt(formOdemeGunu),
            durum: formDurum,
            varsayilanTutar: formVarsayilanTutar ? parseFloat(formVarsayilanTutar) : null,
            varsayilanHesapId: formVarsayilanHesap || null
        });
        closeModal();
    };

    const openOdemeEkle = () => {
        if (!hesaplar || hesaplar.length === 0) {
            alert('Kayıtlı hesap bulunamadı!');
            return;
        }
        const simdikiZaman = new Date();
        const varsayilanTarih = new Date(simdikiZaman.getTime() - (simdikiZaman.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setFormOdemeTutar(veri.varsayilanTutar || "");
        setFormOdemeHesapId(veri.varsayilanHesapId || (hesaplar[0]?.id));
        setFormOdemeTarih(varsayilanTarih);
        setModalState({ type: 'odeme_ekle' });
    };

    const handleOdemeSubmit = async (e) => {
        e.preventDefault();
        let success = true;
        if (besOdemeIsle) {
            success = await besOdemeIsle(islemEkle, {
                hesapId: formOdemeHesapId,
                tutar: formOdemeTutar,
                aciklama: 'BES Aylık Ödeme',
                tarih: formOdemeTarih
            });
        } else {
            success = await islemEkle(null, {
                hesapId: formOdemeHesapId,
                tutar: formOdemeTutar,
                aciklama: 'BES Aylık Ödeme',
                kategori: 'BES',
                islemTipi: 'gider',
                tarih: formOdemeTarih
            });
        }
        if (success !== false) closeModal();
    };


    return (
        <div className="responsive-card bes-card" style={{ ...cardStyle, marginBottom: '30px', background: '#fff', position: 'relative' }}>

            {/* HEADER & SETTINGS ICON */}
            <div className="bes-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <h4 style={{ margin: 0, color: '#805ad5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ☂️ Bireysel Emeklilik (BES) Takip
                    {veri.durum === 'durduruldu' && <span style={{ fontSize: '12px', background: '#feb2b2', color: '#9b2c2c', padding: '2px 6px', borderRadius: '4px' }}> DURAKLATILDI </span>}
                </h4>
                <div onClick={openAyarlar} style={{ cursor: 'pointer', fontSize: '20px', color: '#a0aec0' }} title="Ayarlar">⚙️</div>
            </div>

            <div className="bes-layout" style={{ display: 'grid', gridTemplateColumns: fonDagilimiVar ? '1.2fr 1fr 1fr' : '1.2fr 1fr', gap: '30px', alignItems: 'center' }}>

                {/* SOL: Özet Rakamlar */}
                <div className="bes-summary-col" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <div style={{ fontSize: '13px', color: '#718096' }}>Toplam Anlık Birikim</div>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: '#2d3748' }}>{formatPara(guncelTutar)}</div>
                    </div>
                    {/* Üst Satır İstatistikler */}
                    <div className="bes-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: '#a0aec0' }}>Cebimden Çıkan</div>
                            <div style={{ fontWeight: 'bold', color: '#4a5568', fontSize: '13px' }}>{formatPara(toplamBesYatirimi)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#a0aec0' }}>Toplam Kesinti</div>
                            <div style={{ fontWeight: 'bold', color: '#dc3545', fontSize: '13px' }}>{formatPara(toplamKesinti)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#a0aec0' }}>Devlet Katkısı</div>
                            <div style={{ fontWeight: 'bold', color: '#3182ce', fontSize: '13px' }}>{formatPara(devletKatkisi)}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: '#a0aec0' }}>Net Getiri (Fon)</div>
                            <div style={{ fontWeight: 'bold', color: netGetiri > 0 ? '#16a36a' : netGetiri < 0 ? '#e25555' : '#94a3b8', fontSize: '13px' }}>
                                {netGetiri > 0 ? '+' : ''}{formatPara(netGetiri)}
                            </div>
                        </div>
                    </div>

                    {/* Alt Kısım: Dönem Detayı */}
                    <div style={{ paddingTop: '10px', borderTop: '1px solid #edf2f7' }}>
                        {ayFiltresiVar ? (
                            <div className="bes-monthly-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ fontWeight: '600', color: '#718096' }}>Dönem:</span>
                                <div className="bes-monthly-values" style={{ display: 'flex', gap: '15px' }}>
                                    <span style={{ color: '#16a36a' }}>Yatırılan: <b>{formatPara(seciliAyYatirilan)}</b></span>
                                    <span style={{ color: '#e25555' }}>Kesinti: <b>{formatPara(seciliAyKesinti)}</b></span>
                                    <span style={{ color: seciliAyNetYatirim > 0 ? '#16a36a' : seciliAyNetYatirim < 0 ? '#e25555' : '#94a3b8', fontWeight: 'bold' }}>
                                        Net: {formatPara(seciliAyNetYatirim)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '12px', color: '#a0aec0', fontStyle: 'italic' }}>
                                Ay detaylarını görmek için yukarıdan tarih filtresi seçiniz.
                            </div>
                        )}
                    </div>
                </div>

                {fonDagilimiVar && (
                    <div className="bes-fon-col" style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>

                        <div style={{ fontSize: '12px', color: '#718096', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            Fon Dağılımı
                            <span onClick={openFonDuzenle} style={{ cursor: 'pointer', fontSize: '14px' }} title="Fonları Düzenle">✏️</span>
                        </div>

                        <PremiumDonutChart
                            data={fonDagilimi}
                            centerValue="%100"
                            centerLabel="Fon"
                            formatValue={(value) => `%${value}`}
                            height={132}
                            innerRadius={38}
                            outerRadius={54}
                        />
                    </div>
                )}

                {/* SAĞ: Aksiyonlar */}
                <div className="bes-actions" style={{ display: 'flex', flexDirection: 'column', gap: '15px', justifyContent: 'center' }}>
                    <button
                        onClick={() => besOdemeYap ? besOdemeYap(veri, islemEkle, openOdemeEkle) : openOdemeEkle()}
                        style={{
                            padding: '12px', background: '#805ad5', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>+</span> Aylık Ödeme
                    </button>

                    <button
                        onClick={() => modalAc('bes_kesinti_ekle', veri)}
                        style={{
                            padding: '12px', background: '#fff5f5', color: '#c53030', border: '1px solid #fc8181', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        ⚠️ Kesinti Gir
                    </button>

                    <button
                        onClick={openDurumGuncelle}
                        style={{
                            padding: '8px', background: '#f3e8ff', color: '#553c9a', border: '1px solid #d6bcfa', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px'
                        }}
                    >
                        🔄 Durum Güncelle
                    </button>

                    <div style={{ fontSize: '10px', color: '#cbd5e0', textAlign: 'center', marginTop: '5px' }}>
                        *Net Getiri = (Anlık Birikim - (Cebimden Çıkan - Kesinti))
                    </div>
                </div>

            </div>

            {/* --- MODALS --- */}

            {/* 1. DURUM GÜNCELLE */}
            <HighQualityModal isOpen={modalState.type === 'durum_guncelle'} onClose={closeModal} title="BES Durum Güncelle" icon="🔄">
                <form onSubmit={handleDurumSubmit}>
                    <label style={{ fontSize: '13px', color: '#4a5568', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Güncel BES Birikimi (Fon Dahil)</label>
                    <input type="number" value={formGuncelTutar} onChange={e => setFormGuncelTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />

                    <label style={{ fontSize: '13px', color: '#3182ce', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Güncel Devlet Katkısı</label>
                    <input type="number" value={formGuncelDevlet} onChange={e => setFormGuncelDevlet(e.target.value)} placeholder="Boş = Otomatik (%30)" style={{ ...inputStyle, marginBottom: '5px' }} />
                    <div style={{ fontSize: '11px', color: '#a0aec0', marginBottom: '20px' }}>*Boş bırakırsanız sistem otomatik (%30) hesaplar.</div>

                    <button type="submit" className="modal-success-btn">GÜNCELLE</button>
                </form>
            </HighQualityModal>

            {/* 2. FON DAĞILIMI */}
            <HighQualityModal isOpen={modalState.type === 'fon_duzenle'} onClose={closeModal} title="Fon Dağılımı" icon="📊">
                <form onSubmit={handleFonSubmit}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>Fon Kodunu ve Yüzdesini giriniz (Toplam 100 olmalı)</div>
                    {formFonlar.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <input
                                value={f.name}
                                onChange={e => handleFonChange(i, 'name', e.target.value)}
                                placeholder="Fon Kodu (Örn: GMF)"
                                style={{ ...inputStyle, flex: 2 }}
                            />
                            <input
                                type="number"
                                value={f.value}
                                onChange={e => handleFonChange(i, 'value', e.target.value)}
                                placeholder="%"
                                style={{ ...inputStyle, flex: 1 }}
                            />
                        </div>
                    ))}
                    <button type="button" onClick={() => setFormFonlar([...formFonlar, { name: '', value: '' }])} style={{ fontSize: '12px', color: '#3182ce', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '15px' }}>+ Fon Ekle</button>
                    <button type="submit" className="modal-primary-btn">KAYDET</button>
                </form>
            </HighQualityModal>

            {/* 3. AYARLAR */}
            <HighQualityModal isOpen={modalState.type === 'ayarlar'} onClose={closeModal} title="BES Ayarları" icon="⚙️">
                <form onSubmit={handleAyarlarSubmit}>
                    <label style={{ fontSize: '13px', color: '#4a5568', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Ödeme Günü</label>
                    <input type="number" value={formOdemeGunu} onChange={e => setFormOdemeGunu(e.target.value)} min="1" max="31" style={{ ...inputStyle, marginBottom: '15px' }} />

                    <label style={{ fontSize: '13px', color: '#4a5568', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Durum</label>
                    <select value={formDurum} onChange={e => setFormDurum(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }}>
                        <option value="aktif">Aktif (Devam Ediyor)</option>
                        <option value="durduruldu">Durduruldu / Ara Verildi</option>
                    </select>

                    <div style={{ margin: '10px 0', padding: '15px', background: '#f8fafc', borderRadius: '10px' }}>
                        <label style={{ color: '#805ad5', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>⚡️ Tek Tıkla Ödeme Ayarları</label>

                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '3px' }}>Varsayılan Tutar</label>
                        <input type="number" value={formVarsayilanTutar} onChange={e => setFormVarsayilanTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

                        <label style={{ fontSize: '12px', display: 'block', marginBottom: '3px' }}>Varsayılan Hesap</label>
                        <select value={formVarsayilanHesap} onChange={e => setFormVarsayilanHesap(e.target.value)} style={{ ...inputStyle }}>
                            <option value="">Seçiniz...</option>
                            {hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}
                        </select>
                    </div>

                    <button type="submit" className="modal-primary-btn">KAYDET</button>
                </form>
            </HighQualityModal>

            {/* 4. ÖDEME EKLE */}
            <HighQualityModal isOpen={modalState.type === 'odeme_ekle'} onClose={closeModal} title="Aylık Ödeme Ekle" icon="💸">
                <form onSubmit={handleOdemeSubmit}>
                    <label style={{ fontSize: '13px', color: '#4a5568', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Tutar</label>
                    <input type="number" value={formOdemeTutar} onChange={e => setFormOdemeTutar(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required />

                    <label style={{ fontSize: '13px', color: '#4a5568', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Hangi Hesaptan?</label>
                    <select value={formOdemeHesapId} onChange={e => setFormOdemeHesapId(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} required>
                        <option value="">Seçiniz...</option>
                        {hesaplar.map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({formatPara(h.guncelBakiye)})</option>)}
                    </select>

                    <label style={{ fontSize: '13px', color: '#4a5568', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Tarih</label>
                    <input type="datetime-local" value={formOdemeTarih} onChange={e => setFormOdemeTarih(e.target.value)} style={{ ...inputStyle, marginBottom: '20px' }} required />

                    <button type="submit" className="modal-success-btn">ONAYLA</button>
                </form>
            </HighQualityModal>

        </div>
    );
};

export default BESCard;
