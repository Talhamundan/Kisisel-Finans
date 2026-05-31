import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, PieChart, Pie, Cell } from 'recharts';
import { Info, X } from 'lucide-react';
import { cardStyle, inputStyle, formatCurrencyPlain, tarihFormatla, tarihSadeceGunAyYil, toDateSafe, COLORS, sortTurkishText } from '../../utils/helpers';

const BudgetDashboard = ({
    aktifAy,
    toplamGelir,
    bugunGider,
    toplamGider,
    gunlukVeri,
    gunlukOrtalama,
    kategoriVerisi,
    gizliMod,
    aylikLimit,
    onLimitChange,
    harcananLimit,
    limitYuzdesi,
    limitRenk,
    maaslar,
    hesaplar,
    modalAc,
    normalSil,
    filtrelenmisIslemler,
    tumIslemler,
    sadeceCuzdanNakiti,
    genelToplamYatirimGucu,
    netVarlik,
    tanimliFaturalar,
    bekleyenFaturalar,
    taksitler,
    taksitOde,
    toplamKalanTaksitBorcu,
    abonelikler,
    abonelikOde,
    toplamSabitGider,
    kategoriListesi,
    formTab, setFormTab,
    islemEkle,
    transferYap,
    taksitEkle,
    faturaGir,
    secilenHesapId, setSecilenHesapId,
    islemTipi, setIslemTipi,
    kategori, setKategori,
    islemAciklama, setIslemAciklama,
    islemTutar, setIslemTutar,
    islemTarihi, setIslemTarihi,
    transferKaynakId, setTransferKaynakId,
    transferHedefId, setTransferHedefId,
    transferTutar, setTransferTutar,
    transferUcreti, setTransferUcreti,
    transferTarihi, setTransferTarihi,
    taksitBaslik, setTaksitBaslik,
    taksitHesapId, setTaksitHesapId,
    taksitToplamTutar, setTaksitToplamTutar,
    taksitSayisi, setTaksitSayisi,
    taksitKategori, setTaksitKategori,
    taksitAlisTarihi, setTaksitAlisTarihi,
    secilenTanimId, setSecilenTanimId,
    faturaGirisTutar, setFaturaGirisTutar,
    faturaGirisTarih, setFaturaGirisTarih,
    faturaGirisAciklama, setFaturaGirisAciklama,
    mevcutAylar,
    setAktifAy,
    aramaMetni, setAramaMetni,
    filtreKategori, setFiltreKategori,
    borclar,
    toplamKalanBorc,
    borcOrderGuncelle,
    excelIndir,
    excelYukle,
    islemSil
}) => {

    const formatPara = (tutar) => gizliMod ? "**** ₺" : formatCurrencyPlain(tutar);
    const siraliKategoriListesi = sortTurkishText(kategoriListesi || []);

    const [localLimit, setLocalLimit] = useState(aylikLimit);
    const [hoveredKategori, setHoveredKategori] = useState(null);
    const [hareketHesabi, setHareketHesabi] = useState(null);
    const [hareketBilgi, setHareketBilgi] = useState(null);
    useEffect(() => {
        setLocalLimit(aylikLimit);
    }, [aylikLimit]);

    const siraliBorclar = [...(borclar || [])]
        .sort((a, b) => {
            const orderFark = (a.orderIndex || 0) - (b.orderIndex || 0);
            if (orderFark !== 0) return orderFark;
            const aTime = a.eklenmeTarihi?.seconds || 0;
            const bTime = b.eklenmeTarihi?.seconds || 0;
            return bTime - aTime;
        });

    const toplamKategoriGideri = (kategoriVerisi || []).reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0);
    const pieData = [...(kategoriVerisi || [])]
        .filter(item => (parseFloat(item.value) || 0) > 0)
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({
            ...item,
            color: COLORS[index % COLORS.length],
            yuzde: toplamKategoriGideri > 0 ? Math.round((item.value / toplamKategoriGideri) * 100) : 0
        }));
    const merkezAyMetni = aktifAy === "Tümü" ? "Tüm Dönem" : aktifAy;

    const taksitTarihAraligi = (taksit) => {
        const baslangic = toDateSafe(taksit.alisTarihi) || toDateSafe(taksit.olusturmaTarihi);
        const taksitSayisi = parseInt(taksit.taksitSayisi);
        if (!baslangic || !Number.isFinite(taksitSayisi) || taksitSayisi <= 0) return "";

        const bitis = new Date(baslangic);
        bitis.setMonth(bitis.getMonth() + taksitSayisi - 1);
        return `${tarihSadeceGunAyYil(baslangic)} - ${tarihSadeceGunAyYil(bitis)}`;
    };

    const hesapHareketleri = hareketHesabi
        ? (tumIslemler || []).filter(i => (
            i.hesapId === hareketHesabi.id ||
            i.kaynakId === hareketHesabi.id ||
            i.hedefId === hareketHesabi.id
        )).map(i => {
            let etki = 0;
            let tipEtiketi = i.islemTipi || "";
            if (i.islemTipi === 'transfer') {
                etki = i.kaynakId === hareketHesabi.id ? -(parseFloat(i.tutar) || 0) : (parseFloat(i.tutar) || 0);
                tipEtiketi = i.kaynakId === hareketHesabi.id ? 'Transfer Çıkış' : 'Transfer Giriş';
            } else if (i.islemTipi === 'gelir' || i.islemTipi === 'yatirim_satis' || i.islemTipi === 'cari_iade') {
                etki = parseFloat(i.tutar) || 0;
                if (i.islemTipi === 'gelir') tipEtiketi = 'Gelir';
                if (i.islemTipi === 'yatirim_satis') tipEtiketi = 'Yatırım Satış';
                if (i.islemTipi === 'cari_iade') tipEtiketi = 'İade';
            } else {
                etki = -(parseFloat(i.tutar) || 0);
                tipEtiketi = i.islemTipi === 'yatirim_alis' ? 'Yatırım Alış' : 'Gider';
            }
            return { ...i, hesapEtki: etki, tipEtiketi };
        }).sort((a, b) => (toDateSafe(b.tarih)?.getTime() || 0) - (toDateSafe(a.tarih)?.getTime() || 0))
        : [];

    const hareketToplami = hesapHareketleri.reduce((sum, i) => sum + i.hesapEtki, 0);
    const hesapTipiMetni = (hesap) => {
        if (hesap?.hesapTipi === 'krediKarti') return 'kredi kartınız';
        if (hesap?.hesapTipi === 'yatirim') return 'yatırım hesabınız';
        return 'vadesiz TL hesabınız';
    };
    const hareketDetayMetni = (hareket) => {
        const tarih = tarihSadeceGunAyYil(hareket.tarih);
        const tutar = formatPara(Math.abs(parseFloat(hareket.hesapEtki) || 0));
        const bakiye = formatPara(hareket.islemSonrasiBakiye);
        const hesapMetni = hesapTipiMetni(hareketHesabi);

        if (hareket.islemTipi === 'transfer') {
            const kaynak = hesaplar.find(h => h.id === hareket.kaynakId)?.hesapAdi || 'kaynak hesap';
            const hedef = hesaplar.find(h => h.id === hareket.hedefId)?.hesapAdi || 'hedef hesap';
            const yon = hareket.kaynakId === hareketHesabi.id
                ? `${hedef} hesabına`
                : `${kaynak} hesabından`;
            const eylem = hareket.kaynakId === hareketHesabi.id ? 'para transferi yapıldı' : 'para transferi geldi';
            return `${tarih} tarihinde ${hesapMetni} ${yon} ${tutar} tutarında ${eylem}. İşlem sonrası hesap bakiyeniz: ${bakiye}`;
        }

        if (hareket.hesapEtki >= 0) {
            return `${tarih} tarihinde ${hesapMetni} ${hareket.aciklama || 'işlem'} sonucunda ${tutar} giriş oldu. İşlem sonrası hesap bakiyeniz: ${bakiye}`;
        }

        return `${tarih} tarihinde ${hesapMetni} ${hareket.aciklama || 'işlem'} için ${tutar} tutarında ödeme yapıldı. İşlem sonrası hesap bakiyeniz: ${bakiye}`;
    };
    const hesapHareketleriBakiyeli = hesapHareketleri.reduce((acc, hareket) => {
        const islemSonrasiBakiye = acc.bakiye;
        const hesapEtki = parseFloat(hareket.hesapEtki) || 0;
        return {
            bakiye: acc.bakiye - hesapEtki,
            hareketler: [...acc.hareketler, { ...hareket, islemSonrasiBakiye }]
        };
    }, { bakiye: parseFloat(hareketHesabi?.guncelBakiye) || 0, hareketler: [] }).hareketler;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}> {/* Ana Container gap düzeltildi */}
            {hareketHesabi && (
                <div
                    onClick={() => {
                        setHareketHesabi(null);
                        setHareketBilgi(null);
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(15, 23, 42, 0.38)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: 'min(1180px, 96vw)',
                            maxHeight: '82vh',
                            overflow: 'hidden',
                            background: '#ffffff',
                            borderRadius: '16px',
                            boxShadow: '0 25px 70px rgba(15, 23, 42, 0.28)',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{hareketHesabi.hesapAdi}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                                    {hesapHareketleri.length} hareket • Net etki: <b style={{ color: hareketToplami >= 0 ? '#16a34a' : '#dc2626' }}>{formatPara(hareketToplami)}</b>
                                </div>
                            </div>
                            <button aria-label="Kapat" onClick={() => {
                                setHareketHesabi(null);
                                setHareketBilgi(null);
                            }} style={{ border: 'none', background: 'transparent', color: '#0f172a', width: '42px', height: '42px', cursor: 'pointer', display: 'grid', placeItems: 'center', flex: '0 0 auto', padding: 0 }}>
                                <X size={22} strokeWidth={3} />
                            </button>
                        </div>

                        <div style={{ overflow: 'auto' }}>
                            {hesapHareketleri.length === 0 ? (
                                <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Bu hesap için hareket bulunamadı.</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#334155', minWidth: '980px', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <th style={{ padding: '12px 18px', width: '150px' }}>Tarih</th>
                                            <th style={{ padding: '12px 18px', width: '145px' }}>Tip</th>
                                            <th style={{ padding: '12px 18px', width: '130px' }}>Kategori</th>
                                            <th style={{ padding: '11px 14px' }}>Açıklama</th>
                                            <th style={{ padding: '12px 18px', width: '135px', textAlign: 'right' }}>Hareket</th>
                                            <th style={{ padding: '12px 18px', width: '135px', textAlign: 'right' }}>Bakiye</th>
                                            <th style={{ padding: '12px 14px', width: '76px', textAlign: 'center' }}>Detay</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hesapHareketleriBakiyeli.map(i => (
                                            <tr key={i.id} onClick={() => modalAc('duzenle_islem', i)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                                                <td style={{ padding: '13px 18px', whiteSpace: 'nowrap', color: '#64748b' }}>{tarihFormatla(i.tarih)}</td>
                                                <td style={{ padding: '13px 18px', fontWeight: 700, whiteSpace: 'nowrap' }}>{i.tipEtiketi}</td>
                                                <td style={{ padding: '13px 18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.kategori || '-'}</td>
                                                <td style={{ padding: '13px 18px', lineHeight: 1.35 }}>{i.aciklama || '-'}</td>
                                                <td style={{ padding: '13px 18px', textAlign: 'right', fontWeight: 800, color: i.hesapEtki >= 0 ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                                                    {i.hesapEtki >= 0 ? '+' : ''}{formatPara(i.hesapEtki)}
                                                </td>
                                                <td style={{ padding: '13px 18px', textAlign: 'right', whiteSpace: 'nowrap', color: '#0f172a', fontWeight: 700 }}>
                                                    {formatPara(i.islemSonrasiBakiye)}
                                                </td>
                                                <td style={{ padding: '13px 14px', textAlign: 'center' }}>
                                                    <button
                                                        type="button"
                                                        aria-label="İşlem detayı"
                                                        title="İşlem sonrası bakiye detayı"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHareketBilgi(hareketDetayMetni(i));
                                                        }}
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            border: 'none',
                                                            background: 'transparent',
                                                            color: '#334155',
                                                            cursor: 'pointer',
                                                            display: 'inline-grid',
                                                            placeItems: 'center',
                                                            verticalAlign: 'middle',
                                                            padding: 0
                                                        }}
                                                    >
                                                        <Info size={18} strokeWidth={2.4} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                    {hareketBilgi && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: 'fixed',
                                zIndex: 1010,
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 'min(560px, calc(100vw - 42px))',
                                background: '#ffffff',
                                borderRadius: '16px',
                                boxShadow: '0 22px 70px rgba(15, 23, 42, 0.32)',
                                overflow: 'hidden',
                                border: '1px solid #e2e8f0'
                            }}
                        >
                            <div style={{ display: 'flex', gap: '18px', padding: '28px 30px', alignItems: 'flex-start' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '999px', background: '#84cc16', color: '#ffffff', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                                    <Info size={24} strokeWidth={2.6} />
                                </div>
                                <div style={{ color: '#4b5563', fontSize: '18px', lineHeight: 1.45 }}>{hareketBilgi}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHareketBilgi(null)}
                                style={{
                                    width: '100%',
                                    border: 'none',
                                    borderTop: '1px solid #e5e7eb',
                                    background: '#ffffff',
                                    color: '#0ea5e9',
                                    padding: '18px',
                                    cursor: 'pointer',
                                    fontSize: '20px',
                                    fontWeight: 800
                                }}
                            >
                                Tamam
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 1. ve 2. SATIR BİRLEŞİK GRID (Yedek.js ile birebir aynı yapı) */}
            <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px' }}>

                {/* 1. SATIR: KARTLAR */}
                <div className="responsive-card" style={{ ...cardStyle, borderLeft: '5px solid #48bb78' }}>
                    <div className="card-title-sm responsive-title">GELİR ({aktifAy})</div>
                    <div className="kpi-amount responsive-amount">{formatPara(toplamGelir)}</div>
                </div>
                <div className="responsive-card" style={{ ...cardStyle, borderLeft: '5px solid #F59E0B' }}>
                    <div className="card-title-sm responsive-title">BUGÜN HARCANAN</div>
                    <div className="kpi-amount responsive-amount">{formatPara(bugunGider)}</div>
                </div>
                <div className="responsive-card" style={{ ...cardStyle, borderLeft: '5px solid #f56565' }}>
                    <div className="card-title-sm responsive-title">GİDER ({aktifAy})</div>
                    <div className="kpi-amount-sm responsive-amount">{formatPara(toplamGider)}</div>
                </div>

                {/* 2. SATIR: GRAFİK (2 Sütun) ve PASTA (1 Sütun) */}
                <div style={{ ...cardStyle, gridColumn: 'span 2', minHeight: '300px' }}>
                    <div className="card-title" style={{ marginBottom: '16px' }}>Günlük Harcama Trendi ({aktifAy})</div>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={gunlukVeri || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(val) => `${val} ₺`} />
                            <Bar dataKey="value" fill="#8884d8" radius={[5, 5, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    {aktifAy !== "Tümü" && (
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '13px', color: '#718096', fontStyle: 'italic' }}>
                            ✨ Bu ay günlük ortalama harcamanız: <span style={{ fontWeight: 'bold', color: '#2d3748' }}>{formatPara(gunlukOrtalama)}</span>
                        </div>
                    )}
                </div>

                <div className="responsive-card" style={{ ...cardStyle, gridColumn: 'span 1', paddingTop: '18px' }}>
                    <ResponsiveContainer width="100%" height={270}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="45%"
                                innerRadius={58}
                                outerRadius={90}
                                startAngle={90}
                                endAngle={-270}
                                paddingAngle={4}
                                cornerRadius={9}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#f9fafb" strokeWidth={5} />
                                ))}
                            </Pie>
                            <text x="50%" y="43%" textAnchor="middle" fill="#64748b" style={{ fontSize: 11, fontWeight: 700 }}>
                                Toplam Gider
                            </text>
                            <text x="50%" y="52.5%" textAnchor="middle" fill="#0f172a" style={{ fontSize: 18, fontWeight: 800 }}>
                                {formatPara(toplamKategoriGideri)}
                            </text>
                            <text x="50%" y="60.5%" textAnchor="middle" fill="#94a3b8" style={{ fontSize: 11, fontWeight: 700 }}>
                                {merkezAyMetni}
                            </text>
                            <Tooltip
                                formatter={(value, name) => [formatPara(value), name]}
                                contentStyle={{
                                    borderRadius: 12,
                                    border: 'none',
                                    boxShadow: '0 10px 25px rgba(15,23,42,0.15)',
                                    fontSize: 12
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {pieData.length === 0 ? (
                        <div style={{ marginTop: '4px', color: '#94a3b8', fontSize: '11px', textAlign: 'center' }}>
                            Bu ay için kategori verisi yok.
                        </div>
                    ) : (
                        <div style={{ marginTop: '-10px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                            {pieData.map((item, index) => (
                                <div
                                    key={`${item.name}-${index}`}
                                    onMouseEnter={() => setHoveredKategori(`${item.name}-${index}`)}
                                    onMouseLeave={() => setHoveredKategori(null)}
                                    onFocus={() => setHoveredKategori(`${item.name}-${index}`)}
                                    onBlur={() => setHoveredKategori(null)}
                                    tabIndex={0}
                                    style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1px solid #cbd5e1', borderRadius: '999px', padding: '6px 11px', background: '#ffffff', cursor: 'default', outline: 'none' }}
                                >
                                    {hoveredKategori === `${item.name}-${index}` && (
                                        <span style={{
                                            position: 'absolute',
                                            left: '50%',
                                            bottom: 'calc(100% + 8px)',
                                            transform: 'translateX(-50%)',
                                            zIndex: 20,
                                            whiteSpace: 'nowrap',
                                            background: '#f8fafc',
                                            color: '#334155',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '8px',
                                            padding: '6px 10px',
                                            boxShadow: '0 8px 20px rgba(15,23,42,0.16)',
                                            fontSize: '12px',
                                            fontWeight: 700
                                        }}>
                                            {item.name}: {formatPara(item.value)}
                                        </span>
                                    )}
                                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                    <span style={{ color: '#334155', fontSize: '9px', fontWeight: 700 }}>{item.name}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '9px', fontWeight: 700 }}>%{item.yuzde}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- ALT BÖLÜM (FORMLAR VE LİSTE) --- */}
            <div id="cuzdanlar-section" className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '25px' }}>

                {/* SOL SÜTUN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    {/* LİMİT */}
                    <div className="responsive-card" style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div className="card-title">Aylık Bütçe Limiti</div>
                            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}><input type="number" value={localLimit} onChange={(e) => setLocalLimit(e.target.value)} onBlur={(e) => onLimitChange(parseInt(e.target.value) || 0)} style={{ width: '70px', border: '1px solid #ddd', borderRadius: '5px', padding: '2px', background: 'white', color: '#333' }} /></div>
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '5px', fontWeight: 'bold' }}><span style={{ color: limitRenk }}>Harcanan: {formatPara(harcananLimit)}</span><span>{Math.round(limitYuzdesi)}%</span></div>
                            <div style={{ width: '100%', height: '15px', background: '#edf2f7', borderRadius: '10px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}><div style={{ width: `${Math.min(limitYuzdesi, 100)}%`, height: '100%', background: limitRenk, transition: 'width 0.5s', borderRadius: '10px' }}></div></div>
                            {harcananLimit > aylikLimit && (
                                <div style={{ fontSize: '11px', color: '#a0aec0', textAlign: 'left', marginTop: '5px' }}>
                                    Bütçe %{Math.round(((harcananLimit - aylikLimit) / aylikLimit) * 100)} aşıldı
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MAAŞ MODÜLÜ */}
                    <div className="responsive-card" style={{ ...cardStyle, height: 'fit-content' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div className="card-title">Maaşlar & Gelirler</div>
                            <button onClick={() => modalAc('maas_ekle')} className="btn-ui btn-ui-success">
                                + Gelir Ekle
                            </button>
                        </div>
                        <div>
                            {(maaslar || []).map(m => {
                                const hesap = hesaplar.find(h => h.id === m.hesapId);
                                return (
                                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                                        <div><div style={{ fontWeight: 'bold' }}>{m.ad}</div><div style={{ fontSize: '11px', color: '#999' }}>Her ayın {m.gun}. günü • {hesap?.hesapAdi}</div></div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ color: 'green', fontWeight: 'bold' }}>{formatPara(m.tutar)}</span>
                                            <span onClick={(e) => { e.stopPropagation(); modalAc('duzenle_maas', m); }} style={{ cursor: 'pointer', fontSize: '12px', marginLeft: '5px' }}>✏️</span>
                                            <span onClick={(e) => { e.stopPropagation(); normalSil("maaslar", m.id); }} style={{ cursor: 'pointer', color: 'red', fontSize: '12px' }}>🗑️</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {maaslar.length === 0 && <div style={{ fontSize: '12px', color: '#aaa', padding: '10px', textAlign: 'center' }}>Düzenli gelir eklemek için + butonuna basın.</div>}
                    </div>

                    {/* HESAPLAR */}
                    <div className="responsive-card" style={{ ...cardStyle, height: 'fit-content' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                            <div className="card-title">Hesaplar</div>
                            <button onClick={() => modalAc('hesap_ekle')} className="btn-ui btn-ui-primary">
                                + Hesap Ekle
                            </button>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            {(hesaplar || []).map(h => {
                                let toplamBakiye = parseFloat(h.guncelBakiye);
                                if (isNaN(toplamBakiye)) toplamBakiye = 0;
                                let aylikFark = 0;
                                filtrelenmisIslemler.forEach(i => {
                                    if (i.hesapId === h.id) {
                                        if (i.islemTipi === 'gelir') aylikFark += i.tutar;
                                        if (i.islemTipi === 'gider') aylikFark -= i.tutar;
                                    }
                                    if (i.islemTipi === 'transfer') {
                                        if (i.kaynakId === h.id) aylikFark -= i.tutar;
                                        if (i.hedefId === h.id) aylikFark += i.tutar;
                                    }
                                });

                                return (
                                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                                        <div>
                                            <b>{h.hesapAdi}</b> <small style={{ color: '#aaa' }}>({h.hesapTipi})</small>
                                            {h.hesapTipi === 'yatirim' && <span style={{ fontSize: '10px', marginLeft: '5px' }}>📈</span>}
                                            <span onClick={() => setHareketHesabi(h)} title="Hesap hareketleri" style={{ fontSize: '11px', cursor: 'pointer', marginLeft: '5px', color: '#475569' }}>📜</span>
                                            <span onClick={() => modalAc('duzenle_hesap', h)} style={{ fontSize: '10px', cursor: 'pointer', marginLeft: '5px', color: 'blue' }}>✏️</span>
                                            {aktifAy !== "Tümü" && <div style={{ fontSize: '10px', color: '#aaa' }}>Bu ay: {aylikFark > 0 ? '+' : ''}{formatPara(aylikFark)}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                            <span style={{ color: toplamBakiye < 0 ? 'red' : 'green', fontWeight: '600', fontSize: '15px' }}>{formatPara(toplamBakiye)}</span>
                                            {h.hesapTipi === 'krediKarti' && toplamBakiye < 0 && <button onClick={() => modalAc('kredi_karti_ode', h)} style={{ background: '#805ad5', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', marginLeft: '5px' }}>Borç Öde</button>}
                                            <span onClick={() => normalSil("hesaplar", h.id)} style={{ cursor: 'pointer', color: 'red', fontSize: '12px' }}>🗑️</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee', textAlign: 'right', fontSize: '14px' }}>
                            <div style={{ color: '#666' }}>Nakit Varlık: <b>{formatPara(sadeceCuzdanNakiti)}</b></div>
                            <div style={{ color: '#666' }}>Yatırım: <b>{formatPara(genelToplamYatirimGucu)}</b></div>
                            <div style={{ color: '#2d3748', fontSize: '16px', marginTop: '5px' }}>NET VARLIK: <b style={{ color: netVarlik >= 0 ? 'green' : 'red' }}>{formatPara(netVarlik)}</b></div>
                        </div>
                    </div>

                    {/* TAKSİTLER */}
                    <div className="responsive-card" style={cardStyle}>
                        <div className="card-title" style={{ marginBottom: '12px' }}>Taksitler</div>
                        {taksitler.length === 0 ? <p style={{ fontSize: '13px', color: '#aaa' }}>Aktif taksit borcu yok.</p> :
                            <div style={{ marginBottom: '15px' }}>
                                {(taksitler || []).map(t => {
                                    const yuzde = (t.odenmisTaksit / t.taksitSayisi) * 100;
                                    return (
                                        <div key={t.id} style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <div><b>{t.baslik}</b><div style={{ fontSize: '10px', color: '#999' }}>{t.kategori}</div></div>
                                                <span style={{ fontWeight: 'bold' }}>{formatPara(t.toplamTutar - (t.aylikTutar * t.odenmisTaksit))} <small style={{ color: '#999' }}>Kaldı</small></span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#666', marginBottom: '5px' }}>
                                                <span>{t.odenmisTaksit}/{t.taksitSayisi} Ödendi</span>
                                                <span>Aylık: {formatPara(t.aylikTutar)}</span>
                                            </div>
                                            {taksitTarihAraligi(t) && (
                                                <div style={{ fontSize: '11px', color: '#8da0bd', marginBottom: '8px' }}>
                                                    {taksitTarihAraligi(t)}
                                                </div>
                                            )}
                                            <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', marginBottom: '10px' }}><div style={{ width: `${yuzde}%`, height: '100%', background: '#805ad5', borderRadius: '4px', transition: 'width 0.5s' }}></div></div>
                                            <div style={{ textAlign: 'right' }}>
                                                <button onClick={() => taksitOde(t)} style={{ background: '#805ad5', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Bu Ayı İşle ({formatPara(t.aylikTutar)})</button>
                                                <span onClick={() => modalAc('duzenle_taksit', t)} style={{ cursor: 'pointer', marginLeft: '10px' }}>✏️</span>
                                                <span onClick={() => normalSil("taksitler", t.id)} style={{ cursor: 'pointer', marginLeft: '10px' }}>🗑️</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        }
                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#718096' }}>Kalan Toplam Borç: <b style={{ color: '#e53e3e' }}>{formatPara(toplamKalanTaksitBorcu)}</b></span>
                        </div>
                    </div>

                    {/* FATURALAR (YENİ MODÜL) */}
                    <div className="responsive-card" style={{ ...cardStyle, height: 'fit-content' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div className="card-title">Faturalar</div>
                            <button onClick={() => modalAc('fatura_tanim_ekle')} className="btn-ui btn-ui-neutral">
                                + Fatura Tanımla
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* Faturalar */}
                            {(tanimliFaturalar || []).map(tanim => {
                                const bekleyenler = bekleyenFaturalar
                                    .filter(f => f.tanimId === tanim.id)
                                    .sort((a, b) => new Date(a.sonOdemeTarihi) - new Date(b.sonOdemeTarihi));
                                return (
                                    <div key={tanim.id} style={{ marginBottom: '10px', border: '1px solid #eee', borderRadius: '10px', overflow: 'hidden', position: 'relative', zIndex: 10 }}>
                                        <div style={{ padding: '10px', background: '#f7fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#2d3748' }}>{tanim.baslik}</div>
                                                <div style={{ fontSize: '10px', color: '#718096' }}>
                                                    {tanim.kurum} {tanim.aboneNo ? `• ${tanim.aboneNo}` : ''}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <span onClick={() => modalAc('duzenle_fatura_tanim', tanim)} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</span>
                                                <span onClick={() => normalSil("fatura_tanimlari", tanim.id)} style={{ cursor: 'pointer', fontSize: '12px', color: '#e53e3e' }}>🗑️</span>
                                            </div>
                                        </div>
                                        {bekleyenler.length > 0 ? (
                                            bekleyenler.map(bekleyen => (
                                                <div key={bekleyen.id} style={{ padding: '8px', background: '#fff5f5', borderTop: '1px solid #feb2b2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div><div style={{ fontWeight: 'bold', color: '#c53030', fontSize: '13px' }}>{formatPara(bekleyen.tutar)}</div><div style={{ fontSize: '10px', color: '#c53030' }}>Son: {tarihSadeceGunAyYil(bekleyen.sonOdemeTarihi)}</div></div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                        <span onClick={() => modalAc('duzenle_bekleyen_fatura', bekleyen)} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</span>
                                                        <span onClick={() => normalSil("bekleyen_faturalar", bekleyen.id)} style={{ cursor: 'pointer', fontSize: '12px', color: '#e53e3e', marginRight: '5px' }}>🗑️</span>
                                                        <button onClick={() => modalAc('fatura_ode', bekleyen)} style={{ background: '#c53030', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>ÖDE</button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (<div style={{ padding: '5px', fontSize: '10px', color: '#ccc', textAlign: 'center' }}>Bekleyen yok</div>)}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* ABONELİKLER */}
                    <div className="responsive-card" style={{ ...cardStyle, height: 'fit-content' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div className="card-title">Sabit Giderler</div>
                            <button onClick={() => modalAc('abonelik_ekle')} className="btn-ui btn-ui-primary">
                                + Gider Ekle
                            </button>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            {(abonelikler || []).map(abo => {
                                const hesap = hesaplar.find(h => h.id === abo.hesapId);
                                return (
                                    <div key={abo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '14px' }}>
                                        <div><div style={{ fontWeight: 'bold' }}>{abo.ad}</div><div style={{ fontSize: '11px', color: '#999' }}>{abo.gun}. gün • {abo.kategori} • {hesap?.hesapAdi}</div></div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ fontWeight: 'bold', color: '#e53e3e' }}>{formatPara(abo.tutar)}</div>
                                            <button onClick={() => abonelikOde(abo)} style={{ background: '#e2e8f0', color: '#333', fontWeight: 'bold', border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '5px', fontSize: '12px' }}>Öde</button>
                                            <span onClick={() => modalAc('duzenle_abonelik', abo)} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</span>
                                            <span onClick={() => normalSil("abonelikler", abo.id)} style={{ cursor: 'pointer', fontSize: '12px' }}>🗑️</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee', textAlign: 'right', fontSize: '13px' }}>
                            <span style={{ color: '#718096' }}>Aylık Sabit Gider: <b style={{ color: '#e53e3e' }}>{formatPara(toplamSabitGider)}</b></span>
                        </div>
                    </div>

                    {/* BORÇLAR (YENİ MODÜL) */}
                    <div className="responsive-card" style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div className="card-title">Borçlar</div>
                            <button onClick={() => modalAc('borc_tanimla')} className="btn-ui btn-ui-danger">
                                + Borç Tanımla
                            </button>
                        </div>
                        {(!borclar || borclar.length === 0) ? <p style={{ fontSize: '13px', color: '#aaa' }}>Aktif borç kaydı yok.</p> :
                            <div style={{ marginBottom: '15px' }}>
                                {siraliBorclar.map((b, index, array) => {
                                    const toplamTutar = parseFloat(b.toplamTutar) || 0;
                                    const kalanTutar = parseFloat(b.kalanTutar) || 0;
                                    const yuzde = toplamTutar > 0 ? ((toplamTutar - kalanTutar) / toplamTutar) * 100 : 0;

                                    const move = async (dir) => {
                                        const currentPos = index;
                                        const targetPos = index + dir;
                                        if (targetPos < 0 || targetPos >= array.length || !borcOrderGuncelle) return;

                                        const normalizePromises = array
                                            .map((item, itemIndex) => {
                                                const mevcutSira = Number.isFinite(Number(item.orderIndex)) ? Number(item.orderIndex) : itemIndex;
                                                if (mevcutSira === itemIndex) return null;
                                                return borcOrderGuncelle(item.id, { orderIndex: itemIndex });
                                            })
                                            .filter(Boolean);

                                        if (normalizePromises.length > 0) {
                                            await Promise.all(normalizePromises);
                                        }

                                        const targetItem = array[targetPos];
                                        await borcOrderGuncelle(b.id, { orderIndex: targetPos });
                                        await borcOrderGuncelle(targetItem.id, { orderIndex: currentPos });
                                    };

                                    return (
                                        <div key={b.id} style={{ padding: '10px', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <button type="button" onClick={() => move(-1)} disabled={index === 0} style={{ border: 'none', background: 'transparent', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, fontSize: '10px', padding: 0 }}>▲</button>
                                                            <button type="button" onClick={() => move(1)} disabled={index === array.length - 1} style={{ border: 'none', background: 'transparent', cursor: index === array.length - 1 ? 'default' : 'pointer', opacity: index === array.length - 1 ? 0.3 : 1, fontSize: '10px', padding: 0 }}>▼</button>
                                                        </div>
                                                        <b>{b.ad}</b>
                                                    </div>
                                                </div>
                                                <span style={{ fontWeight: 'bold' }}>{formatPara(b.kalanTutar)} <small style={{ color: '#999' }}>Kaldı</small></span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#666', marginBottom: '5px' }}>
                                                <span>{formatPara(b.toplamTutar - b.kalanTutar)} Ödendi</span>
                                                <span>Toplam: {formatPara(b.toplamTutar)}</span>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', marginBottom: '10px' }}>
                                                <div style={{ width: `${Math.min(100, Math.max(0, yuzde))}%`, height: '100%', background: '#e53e3e', borderRadius: '4px', transition: 'width 0.5s' }}></div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    {b.sonOdemeTarihi && <span style={{ fontSize: '11px', color: '#e53e3e' }}>Son Ödeme: {tarihSadeceGunAyYil(new Date(b.sonOdemeTarihi))}</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <button onClick={() => modalAc('borc_ode', b)} style={{ background: '#e53e3e', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Ödeme Yap</button>
                                                    <span onClick={() => modalAc('duzenle_borc', b)} style={{ cursor: 'pointer', fontSize: '12px' }}>✏️</span>
                                                    <span onClick={() => normalSil("borclar", b.id)} style={{ cursor: 'pointer', fontSize: '12px' }}>🗑️</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        }
                        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#718096' }}>Kalan Toplam Borç: <b style={{ color: '#e53e3e' }}>{formatPara(toplamKalanBorc)}</b></span>
                        </div>
                    </div>
                </div>

                {/* --- SAĞ SÜTUN (İKİ AYRI KART) --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                    {/* 1. KART: VERİ GİRİŞ FORMLARI */}
                    <div className="responsive-card" style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setFormTab("islem")}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: formTab === "islem" ? '#ed8936' : '#edf2f7',
                                        color: formTab === "islem" ? '#ffffff' : '#4a5568',
                                        fontWeight: 600,
                                        fontSize: '11px'
                                    }}
                                >
                                    İşlem
                                </button>
                                <button
                                    onClick={() => setFormTab("transfer")}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: formTab === "transfer" ? '#3182ce' : '#edf2f7',
                                        color: formTab === "transfer" ? '#ffffff' : '#4a5568',
                                        fontWeight: 600,
                                        fontSize: '11px'
                                    }}
                                >
                                    Transfer
                                </button>
                                <button
                                    onClick={() => setFormTab("taksit")}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: formTab === "taksit" ? '#805ad5' : '#edf2f7',
                                        color: formTab === "taksit" ? '#ffffff' : '#4a5568',
                                        fontWeight: 600,
                                        fontSize: '11px'
                                    }}
                                >
                                    Taksit
                                </button>
                                <button
                                    onClick={() => setFormTab("fatura")}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: formTab === "fatura" ? '#c53030' : '#edf2f7',
                                        color: formTab === "fatura" ? '#ffffff' : '#4a5568',
                                        fontWeight: 600,
                                        fontSize: '11px'
                                    }}
                                >
                                    Fatura
                                </button>
                            </div>
                        </div>

                        {formTab === "islem" && (
                            <form onSubmit={islemEkle} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <select value={secilenHesapId} onChange={e => setSecilenHesapId(e.target.value)} style={{ flex: 1, ...inputStyle, backgroundColor: '#f7fafc' }}><option value="">Hangi Hesaptan?</option>{(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({h.guncelBakiye}₺)</option>)}</select>
                                    <select value={islemTipi} onChange={e => setIslemTipi(e.target.value)} style={{ flex: 1, ...inputStyle }}><option value="gider">🔴 Gider</option><option value="gelir">🟢 Gelir</option></select>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <select value={kategori || (siraliKategoriListesi && siraliKategoriListesi[0])} onChange={e => setKategori(e.target.value)} style={{ flex: 1, ...inputStyle }}>{siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}</select>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input placeholder="Açıklama" value={islemAciklama} onChange={e => setIslemAciklama(e.target.value)} style={{ flex: 1, ...inputStyle }} />
                                    <input type="number" placeholder="Tutar (₺)" value={islemTutar} onChange={e => setIslemTutar(e.target.value)} style={{ flex: 1, ...inputStyle }} />
                                </div>
                                <input type="datetime-local" value={islemTarihi} onChange={e => setIslemTarihi(e.target.value)} style={{ ...inputStyle }} />
                                <button type="submit" style={{ padding: '15px', background: '#ed8936', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>KAYDET</button>
                            </form>
                        )}

                        {formTab === "transfer" && (
                            <form onSubmit={transferYap} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: '#ebf8ff', padding: '20px', borderRadius: '10px' }}>
                                <div><label style={{ fontSize: '12px', color: '#2b6cb0' }}>Nereden?</label><select value={transferKaynakId} onChange={e => setTransferKaynakId(e.target.value)} style={{ ...inputStyle }}><option value="">Seçiniz...</option>{(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({h.guncelBakiye}₺)</option>)}</select></div>
                                <div><label style={{ fontSize: '12px', color: '#2b6cb0' }}>Nereye?</label><select value={transferHedefId} onChange={e => setTransferHedefId(e.target.value)} style={{ ...inputStyle }}><option value="">Seçiniz...</option>{(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi} ({h.guncelBakiye}₺)</option>)}</select></div>

                                {/* 2. SATIR: İŞLEM TUTARI ve TRANSFER ÜCRETİ (YAN YANA) */}
                                <input type="number" placeholder="İşlem Tutarı (₺)" value={transferTutar} onChange={e => setTransferTutar(e.target.value)} style={{ ...inputStyle }} />
                                <input type="number" placeholder="Ücret (Opsiyonel)" value={transferUcreti} onChange={e => setTransferUcreti(e.target.value)} style={{ ...inputStyle }} />

                                <input type="datetime-local" value={transferTarihi} onChange={e => setTransferTarihi(e.target.value)} style={{ gridColumn: 'span 2', ...inputStyle }} />
                                <button type="submit" style={{ gridColumn: 'span 2', padding: '15px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>TRANSFER YAP / BORÇ ÖDE</button>
                            </form>
                        )}

                        {formTab === "taksit" && (
                            <form onSubmit={taksitEkle} className="taksit-grid">
                                <div style={{ gridColumn: '1 / -1' }}><h4 style={{ margin: '0 0 10px 0', color: '#6b46c1' }}>📦 Yeni Taksit Planı Oluştur</h4></div>

                                {/* 1. SATIR: Hangi Karttan? (Sol) - Ne Aldın? (Sağ) */}
                                <select value={taksitHesapId} onChange={e => setTaksitHesapId(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required>
                                    <option value="">Hangi Karttan?</option>
                                    {(hesaplar || []).map(h => <option key={h.id} value={h.id}>{h.hesapAdi}</option>)}
                                </select>
                                <input placeholder="Ne aldın?" value={taksitBaslik} onChange={e => setTaksitBaslik(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required />

                                {/* 2. SATIR: Toplam Borç (Sol) - Kaç Taksit? (Sağ) */}
                                <input type="number" placeholder="Toplam Borç (₺)" value={taksitToplamTutar} onChange={e => setTaksitToplamTutar(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required />
                                <input type="number" placeholder="Kaç Taksit?" value={taksitSayisi} onChange={e => setTaksitSayisi(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} required />

                                {/* 3. SATIR: Kategori (Sol) - Tarih (Sağ) */}
                                <select value={taksitKategori || (kategoriListesi && kategoriListesi[0])} onChange={e => setTaksitKategori(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }}>
                                    {siraliKategoriListesi.map(k => <option key={k} value={k}>{k}</option>)}
                                </select>
                                <input type="date" placeholder="Tarih" value={taksitAlisTarihi} onChange={e => setTaksitAlisTarihi(e.target.value)} style={{ ...inputStyle, border: '1px solid #d6bcfa' }} />

                                {/* BİLGİ KUTUSU ve BUTON */}
                                <div style={{ gridColumn: '1 / -1', fontSize: '14px', color: '#553c9a', fontWeight: 'bold', padding: '10px', background: 'white', borderRadius: '8px' }}>ℹ️ Aylık: {taksitToplamTutar && taksitSayisi ? formatPara(taksitToplamTutar / taksitSayisi) : '0,00 ₺'}</div>
                                <button type="submit" style={{ gridColumn: '1 / -1', padding: '15px', background: '#805ad5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>KAYDET</button>
                            </form>
                        )}

                        {formTab === "fatura" && (
                            <div style={{ background: '#fff5f5', padding: '20px', borderRadius: '10px' }}>
                                <h4 style={{ margin: '0 0 15px 0', color: '#c53030' }}>🧾 Dönemsel Fatura Tutarı Gir</h4>
                                {tanimliFaturalar.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#c53030', padding: '10px', fontSize: '13px' }}>
                                        ⚠️ Önce sol taraftaki panelden bir fatura/abone tanımı eklemelisiniz.
                                    </div>
                                ) : (
                                    <form onSubmit={faturaGir} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <select value={secilenTanimId} onChange={e => setSecilenTanimId(e.target.value)} style={{ ...inputStyle, border: '1px solid #feb2b2' }} required>
                                                <option value="">Hangi Fatura?</option>
                                                {(tanimliFaturalar || []).map(t => <option key={t.id} value={t.id}>{t.baslik} ({t.kurum})</option>)}
                                            </select>
                                        </div>
                                        <input type="number" placeholder="Tutar (₺)" value={faturaGirisTutar} onChange={e => setFaturaGirisTutar(e.target.value)} style={{ ...inputStyle, border: '1px solid #feb2b2' }} required />
                                        <input type="date" value={faturaGirisTarih} onChange={e => setFaturaGirisTarih(e.target.value)} style={{ ...inputStyle, border: '1px solid #feb2b2' }} required />
                                        <input placeholder="Açıklama (Opsiyonel)" value={faturaGirisAciklama} onChange={e => setFaturaGirisAciklama(e.target.value)} style={{ gridColumn: 'span 2', ...inputStyle, border: '1px solid #feb2b2' }} />
                                        <button type="submit" style={{ gridColumn: 'span 2', padding: '15px', background: '#c53030', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>KAYDET</button>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 2. KART: GEÇMİŞ LİSTESİ VE TABLO */}
                    <div className="responsive-card" style={{ ...cardStyle, overflowX: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '5px' }}>
                            <h4 style={{ marginTop: 0, color: '#2c3e50', margin: 0 }}>📜 Harcama Geçmişi</h4>
                            <div className="no-scrollbar" style={{ display: 'flex', gap: '5px', alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                                {(mevcutAylar || []).map(ay => (
                                    <button key={ay} onClick={() => setAktifAy(ay)} style={{ flexShrink: 0, padding: '5px 10px', fontSize: '12px', borderRadius: '15px', border: 'none', cursor: 'pointer', background: aktifAy === ay ? '#2c3e50' : '#edf2f7', color: aktifAy === ay ? 'white' : '#4a5568', fontWeight: 'bold' }}>{ay}</button>
                                ))}
                            </div>
                        </div>

                        {/* YENİ FİLTRE ALANI */}
                        <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid #edf2f7' }}>
                            <div style={{ flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 10px' }}>
                                <span style={{ fontSize: '16px' }}>🔍</span>
                                <input type="text" placeholder="Harcama, market, tutar ara..." value={aramaMetni} onChange={(e) => setAramaMetni(e.target.value)} style={{ border: 'none', outline: 'none', padding: '10px', width: '100%', fontSize: '13px', background: 'transparent', color: '#333' }} />
                                {aramaMetni && <span onClick={() => setAramaMetni("")} style={{ cursor: 'pointer', color: '#aaa', fontWeight: 'bold' }}>X</span>}
                            </div>
                            <select value={filtreKategori} onChange={e => setFiltreKategori(e.target.value)} style={{ flex: 1, minWidth: '120px', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '13px', backgroundColor: '#ffffff', color: '#333' }}><option value="Tümü">Tüm Kategoriler</option>{sortTurkishText([...siraliKategoriListesi, "Transfer"]).map(k => <option key={k} value={k}>{k}</option>)}</select>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button onClick={excelIndir} style={{ background: '#276749', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>📥 XLS</button>
                                <label style={{ background: '#2b6cb0', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>📤 Yükle <input type="file" accept=".xlsx,.xls,.csv" onChange={excelYukle} style={{ display: 'none' }} /></label>
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', color: '#333', minWidth: '500px' }}>
                                <thead><tr style={{ textAlign: 'left', color: '#718096', borderBottom: '2px solid #e2e8f0' }}><th style={{ padding: '10px' }}>Tarih</th><th style={{ padding: '10px' }}>Hesap</th><th style={{ padding: '10px' }}>Kategori</th><th style={{ padding: '10px' }}>Açıklama</th><th style={{ padding: '10px' }}>Tutar</th><th></th><th></th></tr></thead>
                                <tbody>
                                    {(filtrelenmisIslemler || []).map(i => {
                                        const hesap = hesaplar.find(h => h.id === i.hesapId);
                                        let hesapAdi = hesap?.hesapAdi || "Bilinmeyen";
                                        let renk = 'black';
                                        if (i.islemTipi === 'transfer') {
                                            const kaynak = hesaplar.find(h => h.id === i.kaynakId)?.hesapAdi;
                                            const hedef = hesaplar.find(h => h.id === i.hedefId)?.hesapAdi;
                                            hesapAdi = `${kaynak} ➝ ${hedef}`;
                                            renk = '#3182ce';
                                        } else if (i.islemTipi === 'gelir' || i.islemTipi === 'yatirim_satis') {
                                            renk = 'green';
                                        } else {
                                            renk = '#e53e3e';
                                        }
                                        return (
                                            <tr key={i.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                                                <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', color: '#718096', cursor: 'pointer' }}>{tarihFormatla(i.tarih)}</td>
                                                <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>{hesapAdi}</td>
                                                <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', cursor: 'pointer' }}>
                                                    {i.kategori}
                                                </td>
                                                <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', cursor: 'pointer' }}>{i.aciklama}</td>
                                                <td onClick={() => modalAc('duzenle_islem', i)} style={{ padding: '10px', fontWeight: 'bold', color: renk, cursor: 'pointer' }}>{formatPara(i.tutar)}</td>
                                                <td><span onClick={() => modalAc('duzenle_islem', i)} style={{ cursor: 'pointer' }}>✏️</span></td>
                                                <td><span onClick={() => islemSil(i.id)} style={{ cursor: 'pointer' }}>🗑️</span></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #f0f0f0', textAlign: 'right', color: '#2d3748', fontSize: '16px', fontWeight: 'bold' }}>
                            Net Nakit Akışı ({aktifAy}): <span style={{ color: (toplamGelir - toplamGider) >= 0 ? 'green' : '#e53e3e' }}>{formatPara(toplamGelir - toplamGider)}</span>
                        </div>

                        <footer style={{ textAlign: 'center', marginTop: '30px', padding: '10px', color: '#a0aec0', fontSize: '12px' }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>MUNDAN BİLİŞİM</p>
                        </footer>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BudgetDashboard;
