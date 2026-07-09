import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, increment, getDoc, query, where, getDocs, setDoc, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { formatCurrencyPlain, formatMoneyInputValue } from '../utils/helpers';

export const useBudgetActions = (user, alanKodu, hesaplar, kategoriListesi, tanimliFaturalar) => {
    // --- FORM STATES ---
    // Hesap
    const [hesapAdi, setHesapAdi] = useState("");
    const [hesapTipi, setHesapTipi] = useState("nakit");
    const [baslangicBakiye, setBaslangicBakiye] = useState("");
    const [hesapKesimGunu, setHesapKesimGunu] = useState("");

    // İşlem (Gelir/Gider/Transfer)
    const [secilenHesapId, setSecilenHesapId] = useState("");
    const [islemTutar, setIslemTutar] = useState("");
    const [islemAciklama, setIslemAciklama] = useState("");
    const [islemTipi, setIslemTipi] = useState("gider");
    const [kategori, setKategori] = useState("");
    const [islemTarihi, setIslemTarihi] = useState("");
    // NEW: Unit Price & Quantity for editing
    const [islemAdet, setIslemAdet] = useState("");
    const [islemBirimFiyat, setIslemBirimFiyat] = useState("");

    // Transfer Ex
    const [transferKaynakId, setTransferKaynakId] = useState("");
    const [transferHedefId, setTransferHedefId] = useState("");
    const [transferTutar, setTransferTutar] = useState("");
    const [transferUcreti, setTransferUcreti] = useState(""); // NEW: Transfer Fee
    const [transferTarihi, setTransferTarihi] = useState("");

    // Abonelik
    const [aboAd, setAboAd] = useState("");
    const [aboTutar, setAboTutar] = useState("");
    const [aboGun, setAboGun] = useState("");
    const [aboHesapId, setAboHesapId] = useState("");
    const [aboKategori, setAboKategori] = useState("Fatura");

    // Taksit
    const [taksitBaslik, setTaksitBaslik] = useState("");
    const [taksitToplamTutar, setTaksitToplamTutar] = useState("");
    const [taksitSayisi, setTaksitSayisi] = useState("");
    const [taksitHesapId, setTaksitHesapId] = useState("");
    const [taksitKategori, setTaksitKategori] = useState("");
    const [taksitAlisTarihi, setTaksitAlisTarihi] = useState("");

    // Maaş
    const [maasAd, setMaasAd] = useState("");
    const [maasTutar, setMaasTutar] = useState("");
    const [maasGun, setMaasGun] = useState("");
    const [maasHesapId, setMaasHesapId] = useState("");

    // Borç
    const [borcAd, setBorcAd] = useState("");
    const [borcTutar, setBorcTutar] = useState("");
    const [borcKalanTutar, setBorcKalanTutar] = useState("");
    const [borcTarih, setBorcTarih] = useState("");
    const [borcKategori, setBorcKategori] = useState(kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : "");

    // Cari / şirket alacakları
    const [cariBaslik, setCariBaslik] = useState("");
    const [cariTutar, setCariTutar] = useState("");
    const [cariHesapId, setCariHesapId] = useState("");
    const [cariKategori, setCariKategori] = useState("Şirket Harcaması");
    const [cariTarih, setCariTarih] = useState("");
    const [cariNot, setCariNot] = useState("");
    const [cariIadeTutar, setCariIadeTutar] = useState("");
    const [cariIadeHesapId, setCariIadeHesapId] = useState("");

    // Fatura Tanım / Giriş
    const [tanimBaslik, setTanimBaslik] = useState("");
    const [tanimKurum, setTanimKurum] = useState("");
    const [tanimAboneNo, setTanimAboneNo] = useState("");
    const [tanimHesapId, setTanimHesapId] = useState("");
    const [secilenTanimId, setSecilenTanimId] = useState("");
    const [faturaGirisTutar, setFaturaGirisTutar] = useState("");
    const [faturaGirisTarih, setFaturaGirisTarih] = useState("");
    const [faturaGirisAciklama, setFaturaGirisAciklama] = useState("");

    // KK Ödeme
    const [kkOdemeKartId, setKkOdemeKartId] = useState("");
    const [kkOdemeKaynakId, setKkOdemeKaynakId] = useState("");
    const [kkOdemeTutar, setKkOdemeTutar] = useState("");

    const [tasimaIslemiSuruyor, setTasimaIslemiSuruyor] = useState(false);
    const [yeniKodInput, setYeniKodInput] = useState("");

    // --- ACTIONS ---

    const hesapEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!hesapAdi) {
                toast.warning("Lütfen hesap adı giriniz.");
                return false;
            }
            let bakiye = parseFloat(baslangicBakiye);
            if (isNaN(bakiye)) {
                bakiye = 0;
            }

            await addDoc(collection(db, "hesaplar"), {
                uid: user.uid, alanKodu, hesapAdi, hesapTipi,
                guncelBakiye: bakiye,
                kesimGunu: hesapTipi === 'krediKarti' ? hesapKesimGunu : ""
            });
            setHesapAdi(""); setBaslangicBakiye(""); setHesapKesimGunu("");
            toast.success("Hesap eklendi.");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Hesap eklenirken hata oluştu.");
            return false;
        }
    }

    const hesapDuzenle = async (e, id) => {
        if (e) e.preventDefault();
        try {
            const bakiye = parseFloat(baslangicBakiye);
            if (isNaN(bakiye)) {
                toast.warning("Geçerli bir bakiye giriniz.");
                return false;
            }
            await updateDoc(doc(db, "hesaplar", id), {
                hesapAdi, hesapTipi,
                guncelBakiye: bakiye,
                kesimGunu: hesapTipi === 'krediKarti' ? hesapKesimGunu : ""
            });
            toast.success("Hesap güncellendi.");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Güncelleme başarısız.");
            return false;
        }
    }

    const islemEkle = async (e, manualData = null) => {
        if (e) e.preventDefault();

        try {
            const hedefHesapId = manualData ? manualData.hesapId : secilenHesapId;
            const hedefTutar = manualData ? manualData.tutar : islemTutar;
            const hedefAciklama = manualData ? manualData.aciklama : islemAciklama;
            const hedefKategori = manualData ? manualData.kategori : (kategori || (kategoriListesi && kategoriListesi[0]) || "Diğer");
            const hedefTipi = manualData ? manualData.islemTipi : islemTipi;

            if (!hedefHesapId) {
                toast.warning("Lütfen hesap seçimi yapınız.");
                return false;
            }
            if (!hedefTutar) {
                toast.warning("Lütfen tutar giriniz.");
                return false;
            }

            const tutar = parseFloat(hedefTutar);
            if (isNaN(tutar)) {
                toast.warning("Geçerli bir tutar giriniz.");
                return false;
            }

            const tarih = (manualData && manualData.tarih) ? new Date(manualData.tarih) : (islemTarihi ? new Date(islemTarihi) : new Date());
            const yeniIslem = {
                uid: user.uid,
                alanKodu,
                hesapId: hedefHesapId,
                islemTipi: hedefTipi,
                kategori: hedefKategori,
                tutar,
                aciklama: hedefAciklama || "",
                tarih
            };

            const batch = writeBatch(db);
            batch.set(doc(collection(db, "nakit_islemleri")), yeniIslem);

            batch.update(doc(db, "hesaplar", hedefHesapId), {
                guncelBakiye: increment(hedefTipi === 'gelir' ? tutar : -tutar)
            });
            await batch.commit();

            if (!manualData) {
                setIslemTutar(""); setIslemAciklama(""); setIslemTarihi("");
            }
            toast.success("İşlem kaydedildi!");
            return true;
        } catch (error) {
            console.error("İşlem ekleme hatası:", error);
            toast.error("İşlem eklenirken hata oluştu.");
            return false;
        }
    }

    // Re-implementing islemSil properly
    const islemSilAction = async (id) => {
        const docRef = doc(db, "nakit_islemleri", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            Swal.fire({
                title: 'Silmek istiyor musun?',
                html: `Bu işlemi geri alamazsın.<br/>Tutar: <b>${formatCurrencyPlain(data.tutar)}</b>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Evet, Sil!',
                cancelButtonText: 'Vazgeç'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const batch = writeBatch(db);

                        // 1. TERSİNE BAKE GÜNCELLEME MANTIĞI
                        if (data.islemTipi === "transfer") {
                            // Transfer: Kaynaktan çıktı, Hedefe girdi.
                            // Silinince: Kaynağa geri ekle (+), Hedepten düş (-).
                            if (data.kaynakId) {
                                const kaynakRef = doc(db, "hesaplar", data.kaynakId);
                                batch.update(kaynakRef, { guncelBakiye: increment(data.tutar) });
                            }
                            if (data.hedefId) {
                                const hedefRef = doc(db, "hesaplar", data.hedefId);
                                batch.update(hedefRef, { guncelBakiye: increment(-data.tutar) });
                            }
                        } else {
                            // Gelir/Gider
                            let duzeltmeMiktari = 0;
                            if (data.islemTipi === 'gider' || data.islemTipi === 'yatirim_alis') duzeltmeMiktari = data.tutar; // Harcananı iade et (+)
                            if (data.islemTipi === 'gelir' || data.islemTipi === 'yatirim_satis') duzeltmeMiktari = -data.tutar; // Geleni geri al (-)

                            if (data.hesapId && duzeltmeMiktari !== 0) {
                                const hesapRef = doc(db, "hesaplar", data.hesapId);
                                batch.update(hesapRef, { guncelBakiye: increment(duzeltmeMiktari) });
                            }
                        }

                        // 2. Taksit Durumu
                        if (data.kategori === "Taksit" && data.taksitId) {
                            const taksitRef = doc(db, "taksitler", data.taksitId);
                            batch.update(taksitRef, { odenmisTaksit: increment(-1) });
                        }

                        // 3. Borç Ödeme Durumu
                        if (data.borcId) {
                            const borcRef = doc(db, "borclar", data.borcId);
                            batch.update(borcRef, { kalanTutar: increment(data.tutar) });
                        }

                        // 4. İşlemi Sil
                        batch.delete(docRef);

                        // 5. Atomik İşlemi Uygula
                        await batch.commit();
                        toast.success("İşlem başarıyla silindi ve bakiyeler güncellendi.");

                    } catch (error) {
                        console.error("Silme hatası:", error);
                        toast.error("İşlem silinirken hata oluştu.");
                    }
                }
            });
        }
    }

    const islemDuzenle = async (e, id, veriler) => {
        e.preventDefault();
        try {
            const yeniTutar = parseFloat(islemTutar);
            if (isNaN(yeniTutar)) {
                toast.warning("Geçerli bir tutar giriniz.");
                return false;
            }

            const guncelTarih = islemTarihi ? new Date(islemTarihi) : new Date();
            const isTransfer = veriler.islemTipi === 'transfer' || veriler.kategori === 'Transfer';
            const eskiTutar = parseFloat(veriler.tutar || 0);
            const eskiHesapId = veriler.hesapId || "";
            const yeniHesapId = isTransfer ? "" : (secilenHesapId || eskiHesapId);

            if (!isTransfer && !yeniHesapId) {
                toast.warning("Lütfen ödeme aracı seçiniz.");
                return false;
            }

            const updateData = { aciklama: islemAciklama, tutar: yeniTutar, tarih: guncelTarih };
            if (veriler.islemTipi.includes('yatirim') || veriler.kategori === 'Yatırım') {
                updateData.yatirimTuru = kategori;
                updateData.adet = islemAdet ? parseFloat(islemAdet) : 0;
                updateData.birimFiyat = islemBirimFiyat ? parseFloat(islemBirimFiyat) : 0;
            } else {
                updateData.kategori = kategori;
            }

            const batch = writeBatch(db);

            if (isTransfer) {
                const fark = yeniTutar - eskiTutar;
                if (Math.abs(fark) > 0.0001) {
                    if (veriler.kaynakId) {
                        batch.update(doc(db, "hesaplar", veriler.kaynakId), { guncelBakiye: increment(-fark) });
                    }
                    if (veriler.hedefId) {
                        batch.update(doc(db, "hesaplar", veriler.hedefId), { guncelBakiye: increment(fark) });
                    }
                }
            } else {
                updateData.hesapId = yeniHesapId;
                const isPozitif = veriler.islemTipi === 'gelir' || veriler.islemTipi === 'yatirim_satis';
                const isNegatif = veriler.islemTipi === 'gider' || veriler.islemTipi === 'yatirim_alis';
                const islemSign = isPozitif ? 1 : (isNegatif ? -1 : 0);

                if (islemSign !== 0) {
                    if (eskiHesapId && eskiHesapId === yeniHesapId) {
                        const fark = islemSign * (yeniTutar - eskiTutar);
                        if (Math.abs(fark) > 0.0001) {
                            batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(fark) });
                        }
                    } else {
                        if (eskiHesapId) {
                            batch.update(doc(db, "hesaplar", eskiHesapId), { guncelBakiye: increment(-(islemSign * eskiTutar)) });
                        }
                        batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(islemSign * yeniTutar) });
                    }
                }
            }

            batch.update(doc(db, "nakit_islemleri", id), updateData);
            await batch.commit();

            toast.success("İşlem güncellendi.");
            return true;
        } catch (error) {
            console.error("İşlem güncelleme hatası:", error);
            toast.error("İşlem güncellenemedi.");
            return false;
        }
    }

    const normalSil = async (koleksiyon, id) => {
        Swal.fire({ title: 'Emin misin?', text: "Bu kayıt kalıcı olarak silinecek.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Evet, Sil' }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, koleksiyon, id));
                    toast.info("Kayıt silindi.");
                } catch (error) {
                    console.error("Silme hatası:", error);
                    toast.error("Silinirken bir hata oluştu: " + error.message);
                }
            }
        });
    }

    const transferYap = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!transferKaynakId || !transferHedefId) {
                toast.error("Lütfen hesapları seçin.");
                return false;
            }
            if (transferKaynakId === transferHedefId) {
                toast.error("Aynı hesaba transfer yapılamaz.");
                return false;
            }
            const tutar = parseFloat(transferTutar);
            const ucret = parseFloat(transferUcreti) || 0; // Fee

            if (!transferTutar || isNaN(tutar) || tutar <= 0) {
                toast.error("Geçerli bir transfer tutarı girin.");
                return false;
            }

            const k = hesaplar.find(h => h.id === transferKaynakId);
            const h = hesaplar.find(h => h.id === transferHedefId);
            const tarih = transferTarihi ? new Date(transferTarihi) : new Date();

            const batch = writeBatch(db);

            // 1. Transfer Logic (Money Moved)
            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid, alanKodu, islemTipi: "transfer", kategori: "Transfer",
                tutar: tutar, aciklama: `${k?.hesapAdi} ➝ ${h?.hesapAdi}` + (ucret > 0 ? ` (+${formatCurrencyPlain(ucret)} Komisyon)` : ""),
                tarih: tarih, kaynakId: transferKaynakId, hedefId: transferHedefId
            });

            // 2. Fee Logic (Extra Expense)
            if (ucret > 0) {
                batch.set(doc(collection(db, "nakit_islemleri")), {
                    uid: user.uid,
                    alanKodu,
                    hesapId: transferKaynakId, // Fee deducted from Source
                    islemTipi: "gider",
                    kategori: "Banka Komisyonu",
                    tutar: ucret,
                    aciklama: `Transfer Ücreti (${k?.hesapAdi} ➝ ${h?.hesapAdi})`,
                    tarih: tarih
                });
            }

            // 3. Update Balances
            // Source: Deduct Tutar AND Fee
            batch.update(doc(db, "hesaplar", transferKaynakId), { guncelBakiye: increment(-(tutar + ucret)) });
            // Target: Add Tutar only
            batch.update(doc(db, "hesaplar", transferHedefId), { guncelBakiye: increment(tutar) });
            await batch.commit();

            toast.success("Transfer (ve varsa ücret) işlendi!");
            setTransferTutar(""); setTransferUcreti(""); setTransferKaynakId(""); setTransferHedefId(""); setTransferTarihi("");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Transfer hatası");
            return false;
        }
    }

    const krediKartiBorcOde = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!kkOdemeKartId || !kkOdemeKaynakId || !kkOdemeTutar) {
                toast.error("Eksik bilgi");
                return false;
            }
            const tutar = parseFloat(kkOdemeTutar);
            if (isNaN(tutar)) {
                toast.error("Tutar geçersiz");
                return false;
            }

            const kart = hesaplar.find(h => h.id === kkOdemeKartId);
            const kaynak = hesaplar.find(h => h.id === kkOdemeKaynakId);

            const batch = writeBatch(db);
            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid, alanKodu, islemTipi: "transfer", kategori: "Kredi Kartı Ödemesi",
                tutar: tutar, aciklama: `${kaynak.hesapAdi} ➝ ${kart.hesapAdi} Borç Ödeme`,
                tarih: new Date(), kaynakId: kkOdemeKaynakId, hedefId: kkOdemeKartId
            });
            batch.update(doc(db, "hesaplar", kkOdemeKaynakId), { guncelBakiye: increment(-tutar) });
            batch.update(doc(db, "hesaplar", kkOdemeKartId), { guncelBakiye: increment(tutar) });
            await batch.commit();

            toast.success("Kredi kartı ödemesi yapıldı!");
            setKkOdemeTutar(""); setKkOdemeKaynakId(""); setKkOdemeKartId("");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Ödeme hatası");
            return false;
        }
    }

    // --- TAKSİT ---
    const taksitEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!taksitHesapId || !taksitToplamTutar || !taksitSayisi) {
                toast.error("Eksik bilgi!");
                return false;
            }
            const toplam = parseFloat(taksitToplamTutar);
            const sayi = parseInt(taksitSayisi);

            if (isNaN(toplam) || isNaN(sayi) || sayi <= 0) {
                toast.error("Geçersiz değerler.");
                return false;
            }

            const aylik = toplam / sayi;
            const secilenTaksitKategori = taksitKategori || (kategoriListesi && kategoriListesi[0]) || "Diğer";
            const tarih = taksitAlisTarihi ? new Date(taksitAlisTarihi) : new Date();

            await addDoc(collection(db, "taksitler"), { uid: user.uid, alanKodu, baslik: taksitBaslik, toplamTutar: toplam, taksitSayisi: sayi, aylikTutar: aylik, odenmisTaksit: 0, hesapId: taksitHesapId, kategori: secilenTaksitKategori, olusturmaTarihi: new Date(), alisTarihi: tarih });

            toast.success("Taksit planı oluşturuldu!");
            setTaksitBaslik(""); setTaksitToplamTutar(""); setTaksitSayisi(""); setTaksitHesapId(""); setTaksitAlisTarihi("");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Taksit oluşturulamadı.");
            return false;
        }
    }

    const taksitOde = async (t) => {
        const result = await Swal.fire({ title: 'Taksit İşlensin mi?', html: `<b>${t.baslik}</b> için bu ayın taksiti işlenecek.<br/><br/><span style="font-size:1.2em; color:#4f46e5; font-weight:bold">${formatCurrencyPlain(t.aylikTutar)}</span>`, icon: 'question', showCancelButton: true, confirmButtonText: 'Evet, İşle', cancelButtonText: 'İptal' });
        if (!result.isConfirmed) return;
        const yeniSayac = t.odenmisTaksit + 1;
        const commitPayment = async (shouldDelete = false) => {
            const batch = writeBatch(db);
            batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: t.hesapId, islemTipi: "gider", kategori: t.kategori || "Taksit", tutar: t.aylikTutar, aciklama: `${t.baslik} (${yeniSayac}/${t.taksitSayisi})`, tarih: new Date(), taksitId: t.id });
            batch.update(doc(db, "hesaplar", t.hesapId), { guncelBakiye: increment(-t.aylikTutar) });
            if (shouldDelete) batch.delete(doc(db, "taksitler", t.id));
            else batch.update(doc(db, "taksitler", t.id), { odenmisTaksit: yeniSayac });
            await batch.commit();
        };

        if (yeniSayac >= t.taksitSayisi) {
            const finishResult = await Swal.fire({
                title: 'Taksit Bitti! 🎉',
                text: `${t.baslik} taksitleri (${t.taksitSayisi} ay) bitti. Kaldırılsın mı?`,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Kaldır',
                cancelButtonText: 'Listede Tut'
            });
            await commitPayment(finishResult.isConfirmed);
        } else { await commitPayment(); }
        toast.success("Taksit işlendi.");
    }
    const taksitDuzenle = async (e, id) => { e.preventDefault(); const toplam = parseFloat(taksitToplamTutar); const sayi = parseInt(taksitSayisi); const aylik = toplam / sayi; const tarih = taksitAlisTarihi ? new Date(taksitAlisTarihi) : new Date(); await updateDoc(doc(db, "taksitler", id), { baslik: taksitBaslik, toplamTutar: toplam, taksitSayisi: sayi, aylikTutar: aylik, hesapId: taksitHesapId, kategori: taksitKategori, alisTarihi: tarih }); toast.success("Taksit güncellendi."); return true; }

    // --- ABONELİK ---
    const abonelikEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!aboAd || !aboTutar || !aboHesapId) {
                toast.error("Eksik bilgi");
                return false;
            }
            const tutar = parseFloat(aboTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            const secilenAboKategori = aboKategori || (kategoriListesi && kategoriListesi[0]) || "Fatura";
            await addDoc(collection(db, "abonelikler"), { uid: user.uid, alanKodu, ad: aboAd, tutar: tutar, gun: aboGun, hesapId: aboHesapId, kategori: secilenAboKategori });
            setAboAd(""); setAboTutar(""); setAboGun(""); setAboHesapId("");
            toast.success("Sabit gider eklendi.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Hata oluştu");
            return false;
        }
    }
    const abonelikOde = async (abonelik) => { const result = await Swal.fire({ title: 'Ödeme Onayı', html: `${abonelik.ad} (<b>${formatCurrencyPlain(abonelik.tutar)}</b>) ödensin mi?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Evet, Öde', cancelButtonText: 'İptal' }); if (!result.isConfirmed) return; const batch = writeBatch(db); batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: abonelik.hesapId, islemTipi: "gider", kategori: abonelik.kategori || "Fatura", tutar: abonelik.tutar, aciklama: abonelik.ad + " (Otomatik)", tarih: new Date() }); batch.update(doc(db, "hesaplar", abonelik.hesapId), { guncelBakiye: increment(-abonelik.tutar) }); await batch.commit(); toast.success("Ödeme işlendi."); }
    const abonelikDuzenle = async (e, id) => { e.preventDefault(); await updateDoc(doc(db, "abonelikler", id), { ad: aboAd, tutar: parseFloat(aboTutar), gun: aboGun, hesapId: aboHesapId, kategori: aboKategori }); toast.success("Sabit gider güncellendi."); return true; }

    // --- MAAŞ ---
    const maasEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!maasAd || !maasTutar || !maasHesapId) {
                toast.error("Eksik bilgi");
                return false;
            }
            const tutar = parseFloat(maasTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            await addDoc(collection(db, "maaslar"), { uid: user.uid, alanKodu, ad: maasAd, tutar: tutar, gun: maasGun, hesapId: maasHesapId });
            setMaasAd(""); setMaasTutar(""); setMaasGun(""); setMaasHesapId("");
            toast.success("Gelir kalemi eklendi.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Kayıt başarısız");
            return false;
        }
    }
    const maasYatir = async (maas) => { const result = await Swal.fire({ title: 'Maaş Yatırılsın mı?', html: `💰 <b>${maas.ad}</b> tutarı (${formatCurrencyPlain(maas.tutar)}) hesaba işlensin mi?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Evet, Yatır', confirmButtonColor: 'green' }); if (!result.isConfirmed) return; const batch = writeBatch(db); batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: maas.hesapId, islemTipi: "gelir", kategori: "Maaş/Gelir", tutar: maas.tutar, aciklama: `${maas.ad} (Otomatik)`, tarih: new Date() }); batch.update(doc(db, "hesaplar", maas.hesapId), { guncelBakiye: increment(maas.tutar) }); await batch.commit(); toast.success("Gelir hesaba işlendi!"); }
    const maasDuzenle = async (e, id) => { e.preventDefault(); await updateDoc(doc(db, "maaslar", id), { ad: maasAd, tutar: parseFloat(maasTutar), gun: maasGun, hesapId: maasHesapId }); toast.success("Gelir kalemi güncellendi."); return true; }

    // --- BORÇ ---
    const borcEkle = async (e, close) => {
        if (e) e.preventDefault();
        try {
            if (!borcAd || !borcTutar) {
                toast.error("Eksik bilgi");
                return false;
            }
            const tutar = parseFloat(borcTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            const kalan = borcKalanTutar ? parseFloat(borcKalanTutar) : tutar;
            const borcQuery = query(collection(db, "borclar"), where("alanKodu", "==", alanKodu));
            const borcSnap = await getDocs(borcQuery);
            const maxOrderIndex = borcSnap.docs.reduce((max, belge) => {
                const sira = Number(belge.data()?.orderIndex);
                return Number.isFinite(sira) ? Math.max(max, sira) : max;
            }, -1);

            const data = {
                uid: user.uid, alanKodu,
                ad: borcAd, toplamTutar: tutar, kalanTutar: kalan,
                kategori: borcKategori || "Borç Ödemesi",
                orderIndex: maxOrderIndex + 1,
                eklenmeTarihi: new Date()
            };
            if (borcTarih) data.sonOdemeTarihi = borcTarih;

            await addDoc(collection(db, "borclar"), data);
            setBorcAd(""); setBorcTutar(""); setBorcKalanTutar(""); setBorcTarih(""); setBorcKategori(kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : "");
            toast.success("Borç tanımlandı.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Kayıt başarısız");
            return false;
        }
    }

    const borcDuzenle = async (e, id, close) => {
        if (e) e.preventDefault();
        try {
            const data = {
                ad: borcAd,
                toplamTutar: parseFloat(borcTutar),
                kalanTutar: parseFloat(borcKalanTutar),
                kategori: borcKategori || "Borç Ödemesi"
            };
            if (borcTarih) data.sonOdemeTarihi = borcTarih;
            else data.sonOdemeTarihi = deleteField(); // Remove field if left empty on edit

            await updateDoc(doc(db, "borclar", id), data);
            toast.success("Borç güncellendi.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Güncelleme başarısız");
            return false;
        }
    }

    const borcOrderGuncelle = async (id, yeniVeri) => {
        if (!id) return false;
        try {
            await updateDoc(doc(db, "borclar", id), yeniVeri);
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Borç sırası güncellenemedi");
            return false;
        }
    }

    const borcOde = async (borc, odemeTutar, secilenHesapId) => {
        try {
            const odeme = parseFloat(odemeTutar);
            const mevcutKalan = parseFloat(borc?.kalanTutar) || 0;
            if (isNaN(odeme) || odeme <= 0) {
                toast.error("Geçerli bir ödeme tutarı girin");
                return { success: false };
            }

            const batch = writeBatch(db);

            // 1. İşlemi Kaydet (Gider)
            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid, alanKodu,
                hesapId: secilenHesapId,
                islemTipi: "gider", kategori: borc.kategori || "Borç Ödemesi",
                borcId: borc.id, // Reversion için id bilgisini ekliyoruz
                tutar: odeme, aciklama: `${borc.ad} - Borç Ödemesi`,
                tarih: new Date()
            });

            // 2. Bakiyeden Düş
            batch.update(doc(db, "hesaplar", secilenHesapId), { guncelBakiye: increment(-odeme) });

            // 3. Borcun Kalan Tutarını Düş
            const yeniKalan = mevcutKalan - odeme;
            if (yeniKalan <= 0) {
                batch.update(doc(db, "borclar", borc.id), { kalanTutar: 0 });
            } else {
                batch.update(doc(db, "borclar", borc.id), { kalanTutar: yeniKalan });
            }
            await batch.commit();

            toast.success("Ödeme işlendi.");
            return {
                success: true,
                borcKapandi: yeniKalan <= 0,
                borcId: borc.id,
                borcAd: borc.ad
            };
        } catch (err) {
            console.error(err);
            toast.error("Ödeme işlenemedi");
            return { success: false };
        }
    }

    const borcSil = async (id) => {
        if (!id) return false;
        try {
            await deleteDoc(doc(db, "borclar", id));
            toast.success("Borç listeden kaldırıldı.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Borç kaldırılamadı");
            return false;
        }
    }

    // --- CARİ / ŞİRKET ALACAKLARI ---
    const cariHarcamaEkle = async (e, close) => {
        if (e) e.preventDefault();
        try {
            if (!cariBaslik || !cariTutar || !cariHesapId) {
                toast.error("Başlık, tutar ve ödeme hesabı gerekli.");
                return false;
            }

            const tutar = parseFloat(cariTutar);
            if (isNaN(tutar) || tutar <= 0) {
                toast.error("Geçerli bir tutar girin.");
                return false;
            }

            const tarih = cariTarih ? new Date(cariTarih) : new Date();
            const cariRef = doc(collection(db, "cari_islemleri"));
            const batch = writeBatch(db);

            batch.set(cariRef, {
                uid: user.uid,
                alanKodu,
                baslik: cariBaslik,
                kategori: cariKategori || "Şirket Harcaması",
                tutar,
                iadeAlinan: 0,
                hesapId: cariHesapId,
                not: cariNot || "",
                durum: "bekliyor",
                tarih,
                olusturmaTarihi: new Date()
            });

            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid,
                alanKodu,
                hesapId: cariHesapId,
                islemTipi: "cari_harcama",
                kategori: "Cari Alacak",
                tutar,
                aciklama: `${cariBaslik} (şirket adına)`,
                cariId: cariRef.id,
                tarih
            });

            batch.update(doc(db, "hesaplar", cariHesapId), { guncelBakiye: increment(-tutar) });
            await batch.commit();

            setCariBaslik(""); setCariTutar(""); setCariHesapId(""); setCariKategori("Şirket Harcaması"); setCariTarih(""); setCariNot("");
            toast.success("Cari alacak kaydedildi.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Cari kayıt oluşturulamadı.");
            return false;
        }
    };

    const cariIadeAl = async (cari, odemeTutar, hesapId) => {
        try {
            const odeme = parseFloat(odemeTutar);
            const toplam = parseFloat(cari?.tutar) || 0;
            const alinan = parseFloat(cari?.iadeAlinan) || 0;
            const kalan = Math.max(0, toplam - alinan);

            if (isNaN(odeme) || odeme <= 0) {
                toast.error("Geçerli bir iade tutarı girin.");
                return false;
            }
            if (!hesapId) {
                toast.error("İadenin girdiği hesabı seçin.");
                return false;
            }

            const yeniAlinan = Math.min(toplam, alinan + odeme);
            const batch = writeBatch(db);
            batch.update(doc(db, "cari_islemleri", cari.id), {
                iadeAlinan: yeniAlinan,
                durum: yeniAlinan >= toplam ? "odendi" : "kismi",
                sonIadeTarihi: new Date()
            });
            batch.set(doc(collection(db, "nakit_islemleri")), {
                uid: user.uid,
                alanKodu,
                hesapId,
                islemTipi: "cari_iade",
                kategori: "Cari İade",
                tutar: odeme,
                aciklama: `${cari.baslik} iadesi`,
                cariId: cari.id,
                tarih: new Date()
            });
            batch.update(doc(db, "hesaplar", hesapId), { guncelBakiye: increment(odeme) });
            await batch.commit();

            if (odeme > kalan) {
                toast.warning("İade kaydedildi; cari kalan tutardan fazla giriş toplam alacakla sınırlandı.");
            } else {
                toast.success("İade alındı.");
            }
            return true;
        } catch (err) {
            console.error(err);
            toast.error("İade kaydedilemedi.");
            return false;
        }
    };

    const cariSil = async (cari) => {
        if (!cari?.id) return false;
        try {
            const result = await Swal.fire({
                title: 'Cari kayıt silinsin mi?',
                text: 'Bağlı bakiye hareketleri de geri alınacak.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Evet, Sil',
                cancelButtonText: 'Vazgeç'
            });
            if (!result.isConfirmed) return false;

            const q = query(collection(db, "nakit_islemleri"), where("cariId", "==", cari.id));
            const snap = await getDocs(q);
            const batch = writeBatch(db);

            snap.docs.forEach(belge => {
                const data = belge.data();
                const tutar = parseFloat(data.tutar) || 0;
                if (data.hesapId && tutar > 0) {
                    const duzeltme = data.islemTipi === 'cari_harcama' ? tutar : -tutar;
                    batch.update(doc(db, "hesaplar", data.hesapId), { guncelBakiye: increment(duzeltme) });
                }
                batch.delete(belge.ref);
            });

            batch.delete(doc(db, "cari_islemleri", cari.id));
            await batch.commit();
            toast.success("Cari kayıt silindi ve bakiyeler geri alındı.");
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Cari kayıt silinemedi.");
            return false;
        }
    };

    const fillCariIadeForm = (v) => {
        const kalan = (parseFloat(v?.tutar) || 0) - (parseFloat(v?.iadeAlinan) || 0);
        setCariIadeTutar(kalan > 0 ? kalan.toFixed(2) : "");
        setCariIadeHesapId("");
    };

    const fillCariForm = (v) => {
        setCariBaslik(v.baslik || "");
        setCariTutar(v.tutar || "");
        setCariHesapId(v.hesapId || "");
        setCariKategori(v.kategori || "Şirket Harcaması");
        setCariNot(v.not || "");
        if (v.tarih?.seconds) {
            const d = new Date(v.tarih.seconds * 1000);
            setCariTarih(d.toISOString().split('T')[0]);
        } else {
            setCariTarih(v.tarih || "");
        }
    };

    const cariHarcamaDuzenle = async (e, cari, close) => {
        if (e) e.preventDefault();
        try {
            if (!cari?.id || !cariBaslik || !cariTutar || !cariHesapId) {
                toast.error("Başlık, tutar ve ödeme hesabı gerekli.");
                return false;
            }

            const yeniTutar = parseFloat(cariTutar);
            const eskiTutar = parseFloat(cari.tutar) || 0;
            if (isNaN(yeniTutar) || yeniTutar <= 0) {
                toast.error("Geçerli bir tutar girin.");
                return false;
            }

            const eskiHesapId = cari.hesapId || "";
            const yeniHesapId = cariHesapId;
            const tarih = cariTarih ? new Date(cariTarih) : (cari.tarih || new Date());

            const q = query(collection(db, "nakit_islemleri"), where("cariId", "==", cari.id), where("islemTipi", "==", "cari_harcama"));
            const snap = await getDocs(q);
            const batch = writeBatch(db);

            if (eskiHesapId === yeniHesapId) {
                const fark = yeniTutar - eskiTutar;
                if (Math.abs(fark) > 0.0001) {
                    batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(-fark) });
                }
            } else {
                if (eskiHesapId) batch.update(doc(db, "hesaplar", eskiHesapId), { guncelBakiye: increment(eskiTutar) });
                batch.update(doc(db, "hesaplar", yeniHesapId), { guncelBakiye: increment(-yeniTutar) });
            }

            batch.update(doc(db, "cari_islemleri", cari.id), {
                baslik: cariBaslik,
                kategori: cariKategori || "Şirket Harcaması",
                tutar: yeniTutar,
                hesapId: yeniHesapId,
                not: cariNot || "",
                tarih
            });

            snap.docs.forEach(belge => {
                batch.update(belge.ref, {
                    hesapId: yeniHesapId,
                    tutar: yeniTutar,
                    aciklama: `${cariBaslik} (şirket adına)`,
                    tarih
                });
            });

            await batch.commit();
            toast.success("Cari kayıt güncellendi.");
            if (close) close();
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Cari kayıt güncellenemedi.");
            return false;
        }
    };

    // --- FATURA ---
    // --- FATURA ---
    const faturaTanimEkle = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!tanimBaslik) {
                toast.warning("Başlık giriniz");
                return false;
            }
            await addDoc(collection(db, "fatura_tanimlari"), { uid: user.uid, alanKodu, baslik: tanimBaslik, kurum: tanimKurum, aboneNo: tanimAboneNo, hesapId: tanimHesapId });
            toast.success("Fatura/Abone Tanımlandı!");
            setTanimBaslik(""); setTanimKurum(""); setTanimAboneNo(""); setTanimHesapId("");
            return true;
        } catch (err) {
            console.error(err); return false;
        }
    }

    const faturaGir = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!secilenTanimId || !faturaGirisTutar || !faturaGirisTarih) {
                toast.warning("Tüm alanları doldurunuz.");
                return false;
            }
            const tutar = parseFloat(faturaGirisTutar);
            if (isNaN(tutar)) {
                toast.error("Geçersiz tutar");
                return false;
            }
            await addDoc(collection(db, "bekleyen_faturalar"), { uid: user.uid, alanKodu, tanimId: secilenTanimId, tutar: tutar, sonOdemeTarihi: faturaGirisTarih, aciklama: faturaGirisAciklama, eklenmeTarihi: new Date() });
            toast.success("Fatura takibe alındı!");
            setFaturaGirisTutar(""); setFaturaGirisTarih(""); setFaturaGirisAciklama("");
            return true;
        } catch (err) { console.error(err); return false; }
    }

    const faturaOde = async (fatura, hesapId) => {
        if (!hesapId) return;
        try {
            const tanim = tanimliFaturalar.find(t => t.id === fatura.tanimId);
            const ad = tanim ? tanim.baslik : "Fatura";

            const batch = writeBatch(db);

            // 1. İşlemi Kaydet (Gider)
            batch.set(doc(collection(db, "nakit_islemleri")), { uid: user.uid, alanKodu, hesapId: hesapId, islemTipi: "gider", kategori: "Fatura", tutar: fatura.tutar, aciklama: `${ad} Ödeme (${fatura.aciklama || ''})`, tarih: new Date() });

            // 2. Bakiyeden Düş
            batch.update(doc(db, "hesaplar", hesapId), { guncelBakiye: increment(-fatura.tutar) });

            // 3. Bekleyen Listesinden Sil (Tek Seferlik Ödeme)
            // Kullanıcı her ay manuel girecek.
            batch.delete(doc(db, "bekleyen_faturalar", fatura.id));
            await batch.commit();

            toast.success("Fatura ödendi ve listeden kaldırıldı.");

            return true;
        } catch (err) { console.error(err); toast.error("Fatura ödenemedi"); return false; }
    }

    const bekleyenFaturaDuzenle = async (e, id) => {
        if (e) e.preventDefault();
        try {
            const tutar = parseFloat(faturaGirisTutar);
            if (isNaN(tutar)) return false;
            await updateDoc(doc(db, "bekleyen_faturalar", id), { tutar: tutar, sonOdemeTarihi: faturaGirisTarih, aciklama: faturaGirisAciklama });
            setFaturaGirisTutar(""); setFaturaGirisTarih(""); setFaturaGirisAciklama("");
            toast.success("Fatura güncellendi");
            return true;
        } catch (err) { console.error(err); return false; }
    }

    const faturaTanimDuzenle = async (e, id) => {
        if (e) e.preventDefault();
        try {
            await updateDoc(doc(db, "fatura_tanimlari", id), { baslik: tanimBaslik, kurum: tanimKurum, aboneNo: tanimAboneNo, hesapId: tanimHesapId });
            setTanimBaslik(""); setTanimKurum(""); setTanimAboneNo(""); setTanimHesapId("");
            toast.success("Tanım güncellendi");
            return true;
        } catch (err) { console.error(err); return false; }
    }

    const excelIndir = async (islemler) => {
        const XLSX = await import('xlsx');
        let veri = [];
        if (!islemler || islemler.length === 0) {
            // Boş Template
            veri = [{
                Tarih: "01.01.2024",
                Saat: "12:00",
                "Açıklama": "Örnek Açıklama",
                Kategori: "Market",
                Tutar: 100,
                Hesap: "Nakit"
            }];
        } else {
            veri = islemler.map(i => {
                const date = new Date(i.tarih.seconds * 1000);
                const hesap = hesaplar.find(h => h.id === i.hesapId);
                return {
                    Tarih: date.toLocaleDateString('tr-TR'),
                    Saat: date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                    "Açıklama": i.aciklama,
                    Kategori: i.kategori,
                    Tutar: i.tutar,
                    Hesap: hesap ? hesap.hesapAdi : "Bilinmiyor"
                };
            });
        }

        const ws = XLSX.utils.json_to_sheet(veri);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Islemler");
        XLSX.writeFile(wb, "Harcamalar_Sablon.xlsx");
    }

    const excelYukle = (e) => {
        const dosya = e.target.files[0];
        if (!dosya) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const XLSX = await import('xlsx');
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            let eklenenSayisi = 0;
            let hataSayisi = 0;

            for (const row of data) {
                // 1. Temel Validasyon
                if (!row.Tutar || !row.Hesap) {
                    hataSayisi++;
                    continue;
                }

                // 2. Hesap Eşleştirme (Case-insensitive)
                const hedefHesap = hesaplar.find(h => h.hesapAdi.toLowerCase() === row.Hesap.toString().trim().toLowerCase());
                if (!hedefHesap) {
                    hataSayisi++;
                    console.warn(`Hesap bulunamadı: ${row.Hesap}`);
                    continue;
                }

                // 3. Tarih ve Saat Birleştirme
                let islemTarihi = new Date(); // Varsayılan: Şimdi

                if (row.Tarih) {
                    try {
                        // String Format: DD.MM.YYYY
                        if (typeof row.Tarih === 'string' && row.Tarih.includes('.')) {
                            const [gun, ay, yil] = row.Tarih.split('.');
                            if (gun && ay && yil) {
                                islemTarihi = new Date(`${yil}-${ay}-${gun}`);
                            }
                        } else {
                            // JS Date veya Serial Date
                            const d = new Date(row.Tarih);
                            if (!isNaN(d)) islemTarihi = d;
                        }

                        // Saat Varsa Ekleyelim (HH:MM)
                        if (row.Saat) {
                            const saatStr = row.Saat.toString();
                            if (saatStr.includes(':')) {
                                const [saat, dakika] = saatStr.split(':');
                                islemTarihi.setHours(parseInt(saat), parseInt(dakika));
                            }
                        }
                    } catch (err) {
                        console.error("Tarih parslama hatası", err);
                    }
                }

                // 4. Firestore Kayıt (Tek Tek - Güvenli)
                const kategori = row.Kategori || "Genel";
                const tutarVal = parseFloat(row.Tutar);

                try {
                    const yeniIslem = {
                        uid: user.uid,
                        alanKodu,
                        tarih: islemTarihi,
                        kategori: kategori,
                        aciklama: row['Açıklama'] || "Excel İçe Aktarım",
                        tutar: tutarVal,
                        islemTipi: "gider",
                        hesapId: hedefHesap.id
                    };
                    const batch = writeBatch(db);
                    batch.set(doc(collection(db, "nakit_islemleri")), yeniIslem);

                    // Bakiyeyi güncelle
                    batch.update(doc(db, "hesaplar", hedefHesap.id), {
                        guncelBakiye: increment(-tutarVal)
                    });
                    await batch.commit();

                    eklenenSayisi++;
                } catch (error) {
                    console.error("Satır ekleme hatası:", error);
                    hataSayisi++;
                }
            }

            if (eklenenSayisi > 0) toast.success(`${eklenenSayisi} işlem başarıyla yüklendi.`);
            if (hataSayisi > 0) toast.warning(`${hataSayisi} satır hatalı/eksik olduğu için atlandı.`);
        };
        reader.readAsBinaryString(dosya);
    }

    const verileriTasi = async (e) => {
        e.preventDefault();
        if (!yeniKodInput) return toast.error("Yeni kodu girmelisiniz.");
        if (yeniKodInput === alanKodu) return toast.error("Yeni kod eskisiyle aynı olamaz.");

        const result = await Swal.fire({
            title: 'DİKKAT!',
            html: `Tüm veriler <b>"${alanKodu}"</b> kodundan <b>"${yeniKodInput}"</b> koduna taşınacaktır.<br/>Bu işlem geri alınamaz!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Evet, Taşı'
        });

        if (!result.isConfirmed) return;

        setTasimaIslemiSuruyor(true);
        const yeniKod = yeniKodInput;
        const eskiKod = alanKodu;

        try {
            const eskiAyarRef = doc(db, "ayarlar", eskiKod);
            const eskiAyarSnap = await getDoc(eskiAyarRef);
            if (eskiAyarSnap.exists()) {
                await setDoc(doc(db, "ayarlar", yeniKod), eskiAyarSnap.data());
                await deleteDoc(eskiAyarRef);
            }

            const koleksiyonlar = ["hesaplar", "nakit_islemleri", "abonelikler", "taksitler", "maaslar", "portfoy", "bekleyen_faturalar", "fatura_tanimlari"];

            for (const kolAdi of koleksiyonlar) {
                const q = query(collection(db, kolAdi), where("alanKodu", "==", eskiKod));
                const snapshot = await getDocs(q);
                const promises = snapshot.docs.map(belge =>
                    updateDoc(doc(db, kolAdi, belge.id), { alanKodu: yeniKod })
                );
                await Promise.all(promises);
            }

            Swal.fire('Başarılı!', 'Taşıma işlemi tamamlandı.', 'success');
            localStorage.setItem("alan_kodu", yeniKod);
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error("Taşıma hatası:", error);
            Swal.fire('Hata', error.message, 'error');
        } finally {
            setTasimaIslemiSuruyor(false);
        }
    }

    // Helpers to fill forms
    const fillAccountForm = (v) => { setHesapAdi(v.hesapAdi); setHesapTipi(v.hesapTipi || "nakit"); setBaslangicBakiye(formatMoneyInputValue(v.guncelBakiye)); setHesapKesimGunu(v.kesimGunu || ""); }
    const fillTransactionForm = (v) => {
        setIslemAciklama(v.aciklama);
        setIslemTutar(formatMoneyInputValue(v.tutar));
        setSecilenHesapId(v.hesapId || "");
        setIslemAdet(v.adet || ""); // Fill Quantity
        setIslemBirimFiyat(formatMoneyInputValue(v.birimFiyat)); // Fill Unit Price
        if (v.islemTipi?.includes('yatirim')) { setKategori(v.yatirimTuru || "Hisse"); }
        else { setKategori(v.kategori || ""); }
        if (v.tarih) { const date = new Date(v.tarih.seconds * 1000); const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16); setIslemTarihi(isoString); }
    }
    const fillSubscriptionForm = (v) => { setAboAd(v.ad); setAboTutar(formatMoneyInputValue(v.tutar)); setAboGun(v.gun); setAboHesapId(v.hesapId); setAboKategori(v.kategori); }
    const fillInstallmentForm = (v) => { setTaksitBaslik(v.baslik); setTaksitToplamTutar(formatMoneyInputValue(v.toplamTutar)); setTaksitSayisi(v.taksitSayisi); setTaksitHesapId(v.hesapId); setTaksitKategori(v.kategori); if (v.alisTarihi) { const d = new Date(v.alisTarihi.seconds * 1000); setTaksitAlisTarihi(d.toISOString().split('T')[0]); } }
    const fillSalaryForm = (v) => { setMaasAd(v.ad); setMaasTutar(formatMoneyInputValue(v.tutar)); setMaasGun(v.gun); setMaasHesapId(v.hesapId); }
    const fillBorcForm = (v) => { setBorcAd(v.ad); setBorcTutar(formatMoneyInputValue(v.toplamTutar)); setBorcKalanTutar(formatMoneyInputValue(v.kalanTutar)); setBorcTarih(v.sonOdemeTarihi || ""); setBorcKategori(v.kategori || (kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : "")); }
    const resetBorcForm = () => { setBorcAd(""); setBorcTutar(""); setBorcKalanTutar(""); setBorcTarih(""); setBorcKategori(kategoriListesi && kategoriListesi[0] ? kategoriListesi[0] : ""); }
    const fillBillForm = (v) => { setFaturaGirisTutar(formatMoneyInputValue(v.tutar)); setFaturaGirisTarih(v.sonOdemeTarihi); setFaturaGirisAciklama(v.aciklama || ""); }
    const fillBillDefForm = (v) => { setTanimBaslik(v.baslik); setTanimKurum(v.kurum); setTanimAboneNo(v.aboneNo); setTanimHesapId(v.hesapId || ""); }
    const fillCCForm = (v) => { setKkOdemeKartId(v.id); }

    return {
        // States
        hesapAdi, setHesapAdi, hesapTipi, setHesapTipi, baslangicBakiye, setBaslangicBakiye, hesapKesimGunu, setHesapKesimGunu,
        secilenHesapId, setSecilenHesapId, islemTutar, setIslemTutar, islemAciklama, setIslemAciklama, islemTipi, setIslemTipi, kategori, setKategori, islemTarihi, setIslemTarihi,
        islemAdet, setIslemAdet, islemBirimFiyat, setIslemBirimFiyat, // Return new states
        transferKaynakId, setTransferKaynakId, transferHedefId, setTransferHedefId, transferTutar, setTransferTutar, transferUcreti, setTransferUcreti, transferTarihi, setTransferTarihi,
        aboAd, setAboAd, aboTutar, setAboTutar, aboGun, setAboGun, aboHesapId, setAboHesapId, aboKategori, setAboKategori,
        taksitBaslik, setTaksitBaslik, taksitToplamTutar, setTaksitToplamTutar, taksitSayisi, setTaksitSayisi, taksitHesapId, setTaksitHesapId, taksitKategori, setTaksitKategori, taksitAlisTarihi, setTaksitAlisTarihi,
        maasAd, setMaasAd, maasTutar, setMaasTutar, maasGun, setMaasGun, maasHesapId, setMaasHesapId,
        borcAd, setBorcAd, borcTutar, setBorcTutar, borcKalanTutar, setBorcKalanTutar, borcTarih, setBorcTarih, borcKategori, setBorcKategori,
        cariBaslik, setCariBaslik, cariTutar, setCariTutar, cariHesapId, setCariHesapId, cariKategori, setCariKategori, cariTarih, setCariTarih, cariNot, setCariNot,
        cariIadeTutar, setCariIadeTutar, cariIadeHesapId, setCariIadeHesapId,
        tanimBaslik, setTanimBaslik, tanimKurum, setTanimKurum, tanimAboneNo, setTanimAboneNo, tanimHesapId, setTanimHesapId, secilenTanimId, setSecilenTanimId, faturaGirisTutar, setFaturaGirisTutar, faturaGirisTarih, setFaturaGirisTarih, faturaGirisAciklama, setFaturaGirisAciklama,
        kkOdemeKartId, setKkOdemeKartId, kkOdemeKaynakId, setKkOdemeKaynakId, kkOdemeTutar, setKkOdemeTutar,
        tasimaIslemiSuruyor, setTasimaIslemiSuruyor, yeniKodInput, setYeniKodInput,

        // Actions
        hesapEkle, hesapDuzenle,
        islemEkle, islemSil: islemSilAction, islemDuzenle, normalSil,
        transferYap, krediKartiBorcOde,
        taksitEkle, taksitOde, taksitDuzenle,
        abonelikEkle, abonelikOde, abonelikDuzenle,
        maasEkle, maasYatir, maasDuzenle,
        borcEkle, borcDuzenle, borcOrderGuncelle, borcOde, borcSil,
        cariHarcamaEkle, cariHarcamaDuzenle, cariIadeAl, cariSil,
        faturaTanimEkle, faturaGir, faturaOde, bekleyenFaturaDuzenle, faturaTanimDuzenle,
        excelIndir, excelYukle, verileriTasi,

        // Fillers
        fillAccountForm, fillTransactionForm, fillSubscriptionForm, fillInstallmentForm, fillSalaryForm, fillBorcForm, resetBorcForm, fillCariForm, fillCariIadeForm, fillBillForm, fillBillDefForm, fillCCForm
    };
};
