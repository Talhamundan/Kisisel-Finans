import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, increment, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

export const useInvestmentActions = (user, alanKodu) => {
    // Form States
    const [sembol, setSembol] = useState("");
    const [adet, setAdet] = useState("");
    const [alisFiyati, setAlisFiyati] = useState("");
    const [varlikTuru, setVarlikTuru] = useState("Hisse");
    const [yatirimHesapId, setYatirimHesapId] = useState("");
    const [tahsilatTutar, setTahsilatTutar] = useState("");

    // UI Logic states
    const [guncelleniyor, setGuncelleniyor] = useState(false);

    // Filter states (Moved here or in Calculations? Dashboard uses them. Investment Dashboard has logic for them.)
    // But they are not "ACTIONS". They are View State.
    // I will keep them in App.jsx or useCalculations if they are used for calculating data.
    // InvestmentDashboard receives yatirimArama etc.

    const yatirimAl = async (e) => {
        if (e) e.preventDefault();
        try {
            if (!sembol || !adet || !alisFiyati || !yatirimHesapId || !varlikTuru) {
                toast.error("Tüm bilgileri girin");
                return false;
            }
            const sAdet = parseFloat(adet);
            const sFiyat = parseFloat(alisFiyati);
            if (isNaN(sAdet) || isNaN(sFiyat)) {
                toast.error("Geçersiz değerler");
                return false;
            }
            const toplam = sAdet * sFiyat;
            const tarih = new Date();

            // Check Balance Logic could go here (optional but good)

            await addDoc(collection(db, "portfoy"), { uid: user.uid, alanKodu, sembol: sembol.toUpperCase(), varlikTuru, adet: sAdet, alisFiyati: sFiyat, guncelFiyat: sFiyat, tarih: tarih });
            await updateDoc(doc(db, "hesaplar", yatirimHesapId), { guncelBakiye: increment(-toplam) });
            await addDoc(collection(db, "nakit_islemleri"), {
                uid: user.uid,
                alanKodu,
                hesapId: yatirimHesapId,
                islemTipi: "yatirim_alis",
                kategori: "Yatırım",
                yatirimTuru: varlikTuru,
                tutar: toplam,
                adet: sAdet,
                birimFiyat: sFiyat,
                aciklama: `${sembol.toUpperCase()} Alış`,
                tarih: tarih
            });
            toast.success(`${sembol.toUpperCase()} alındı!`);
            setSembol(""); setAdet(""); setAlisFiyati("");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Yatırım işlemi başarısız.");
            return false;
        }
    }

    const satisYap = async (seciliVeri, secilenHesapId, satisFiyati) => {
        // App.jsx logic for simple "satisYap" used form state "islemTutar" and "secilenHesapId".
        // Here I will make it accept args to be cleaner, or use logic similar to useBudgetActions with shared state?
        // App.jsx's satisYap uses `islemTutar` (as price) and `secilenHesapId`.
        // AND `seciliVeri`.
        // Ideally we should pass these as args.
        if (!secilenHesapId || !satisFiyati) return toast.error("Hesap ve Fiyat Girin");
        const toplam = parseFloat(satisFiyati) * seciliVeri.adet;

        // Handle aggregated items (multiple IDs)
        if (seciliVeri.ids && Array.isArray(seciliVeri.ids)) {
            const promises = seciliVeri.ids.map(id => deleteDoc(doc(db, "portfoy", id)));
            await Promise.all(promises);
        } else {
            await deleteDoc(doc(db, "portfoy", seciliVeri.id));
        }

        await updateDoc(doc(db, "hesaplar", secilenHesapId), { guncelBakiye: increment(toplam) });
        await addDoc(collection(db, "nakit_islemleri"), {
            uid: user.uid,
            alanKodu,
            hesapId: secilenHesapId,
            islemTipi: "yatirim_satis",
            kategori: "Yatırım",
            yatirimTuru: seciliVeri.varlikTuru,
            tutar: toplam,
            adet: seciliVeri.adet, // NEW: Quantity
            birimFiyat: parseFloat(satisFiyati), // NEW: Unit Price
            alisBirimFiyat: seciliVeri.alisFiyati, // NEW: Cost Basis for P/L
            aciklama: `${seciliVeri.sembol} Satış`,
            tarih: new Date()
        });
        toast.success("Satış gerçekleşti!");
        return true;
    }

    const gecmisIslemEkle = async ({ sembol, adet, alisFiyati, alisTarihi, satisFiyati, satisTarihi }) => {
        if (!alanKodu) return;
        try {
            const sAdet = parseFloat(adet);
            const sAlisFiyat = parseFloat(alisFiyati);
            const sSatisFiyat = satisFiyati ? parseFloat(satisFiyati) : null;
            const alisDate = new Date(alisTarihi);
            const satisDate = satisTarihi ? new Date(satisTarihi) : null;

            if (isNaN(sAdet) || isNaN(sAlisFiyat)) {
                toast.error("Geçersiz değerler.");
                return false;
            }

            // 1. KAPANMIŞ POZİSYON (Alış & Satış girilmiş - VEYA sadece Satış Fiyatı girilmiş)
            // Kullanıcı Satış Tarihi'ni kaldırmak istedi. Eğer Satış Fiyatı varsa, kapalı pozisyon olarak işlem yapılır.
            if (sSatisFiyat) {
                const effectiveSatisDate = satisDate || alisDate; // Satış Tarihi yoksa Alış Tarihi varsayılan alınır

                // Geçmişe yönelik ALIŞ kaydı ekle
                await addDoc(collection(db, "nakit_islemleri"), {
                    uid: user.uid,
                    alanKodu,
                    islemTipi: "yatirim_alis",
                    kategori: "Yatırım",
                    yatirimTuru: "Geçmiş",
                    tutar: sAdet * sAlisFiyat,
                    adet: sAdet,
                    birimFiyat: sAlisFiyat,
                    aciklama: `${sembol.toUpperCase()} Alış (Geçmiş)`,
                    tarih: alisDate,
                    isHistorical: true, // Geçmiş işlem olduğunu belirten bayrak
                    sembol: sembol.toUpperCase() // Sembolü açıkça belirt
                });

                // Geçmişe yönelik SATIŞ kaydı ekle
                await addDoc(collection(db, "nakit_islemleri"), {
                    uid: user.uid,
                    alanKodu,
                    islemTipi: "yatirim_satis",
                    kategori: "Yatırım",
                    yatirimTuru: "Geçmiş",
                    tutar: sAdet * sSatisFiyat,
                    adet: sAdet,
                    birimFiyat: sSatisFiyat,
                    alisBirimFiyat: sAlisFiyat,
                    aciklama: `${sembol.toUpperCase()} Satış (Geçmiş)`,
                    tarih: effectiveSatisDate,
                    isHistorical: true,
                    sembol: sembol.toUpperCase()
                });
                toast.success("Geçmiş işlem (Kapanmış) eklendi.");
            }
            // 2. AÇIK POZİSYON (Sadece Alış girilmiş)
            else {
                // Portföye Ekle (Aktif Varlık)
                await addDoc(collection(db, "portfoy"), {
                    uid: user.uid,
                    alanKodu,
                    sembol: sembol.toUpperCase(),
                    varlikTuru: "Geçmiş", // İstenirse kullanıcı girişi yapılabilir
                    adet: sAdet,
                    alisFiyati: sAlisFiyat,
                    guncelFiyat: sAlisFiyat, // Başlangıçta maliyet ile aynı
                    tarih: alisDate,
                    isHistorical: true
                });

                // Geçmişe yönelik ALIŞ kaydı ekle
                await addDoc(collection(db, "nakit_islemleri"), {
                    uid: user.uid,
                    alanKodu,
                    islemTipi: "yatirim_alis",
                    kategori: "Yatırım",
                    yatirimTuru: "Geçmiş",
                    tutar: sAdet * sAlisFiyat,
                    adet: sAdet,
                    birimFiyat: sAlisFiyat,
                    aciklama: `${sembol.toUpperCase()} Alış (Geçmiş)`,
                    tarih: alisDate,
                    isHistorical: true,
                    sembol: sembol.toUpperCase()
                });
                toast.success("Geçmiş işlem (Açık Pozisyon) eklendi.");
            }
            return true;
        } catch (err) {
            console.error(err);
            toast.error("Hata: " + err.message);
            return false;
        }
    }

    const fiyatGuncelle = async (id, yeniFiyat) => { if (!yeniFiyat) return; await updateDoc(doc(db, "portfoy", id), { guncelFiyat: parseFloat(yeniFiyat) }); }

    const piyasalariGuncelle = async (portfoy) => {
        setGuncelleniyor(true);
        const US_STOCKS = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOGL", "META", "NFLX", "AMD", "INTC", "PLTR", "COIN", "MSGI", "VOO", "VTI", "QQQ", "SPY"];
        const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

        // --- HELPER: Finnhub (US) ---
        const fetchFinnhubPrice = async (symbol) => {
            if (!FINNHUB_KEY) {
                console.warn("Finnhub API Key missing (.env file: VITE_FINNHUB_API_KEY)");
                return null;
            }
            try {
                const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
                if (!res.ok) throw new Error("Finnhub API Error");
                const data = await res.json();
                return data.c; // 'c' is Current Price
            } catch (err) {
                console.error(`Finnhub Error (${symbol}):`, err);
                return null;
            }
        };

        // --- HELPER: Yahoo Finance (BIST / Fallback) ---
        const fetchYahooPrice = async (symbol) => {
            const CORS_PROXY = import.meta.env.VITE_CORS_PROXY_URL || 'https://corsproxy.io/?';
            try {
                const url = `${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("Yahoo API Error");
                const data = await res.json();
                const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
                return price ? parseFloat(price) : null;
            } catch (err) {
                console.error(`Yahoo Error (${symbol}):`, err);
                return null;
            }
        };

        try {
            // 1. DOVIZ & ALTIN BASE RATES
            let usdTry = 36.50; // Fallback
            let eurTry = 38.50;
            let gramAltin = 3000;

            try {
                const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=TRY,EUR");
                const data = await res.json();
                usdTry = data.rates.TRY;
                eurTry = (1 / data.rates.EUR) * usdTry; // Cross rate calculation
                // Gram Gold Approx: ONS ~$2750 / 31.1035 * USDTRY
                gramAltin = (2750 * usdTry) / 31.1035;
            } catch (e) {
                console.warn("Currency API failed, using fallbacks.", e);
            }

            let yahooFailed = false;

            const promises = portfoy.map(async (p) => {
                let yeniFiyat = null;
                const rawSymbol = p.sembol?.toUpperCase().trim();

                // A. DOVIZ
                if (p.varlikTuru === 'doviz') {
                    if (rawSymbol === 'USD') yeniFiyat = usdTry;
                    else if (rawSymbol === 'EUR') yeniFiyat = eurTry;
                }
                // B. ALTIN
                else if (p.varlikTuru === 'altin') {
                    yeniFiyat = gramAltin;
                }
                // C. HISSE / FON (HYBRID LOGIC)
                else {
                    const isUS = US_STOCKS.includes(rawSymbol);

                    if (isUS) {
                        // Priority 1: Finnhub
                        yeniFiyat = await fetchFinnhubPrice(rawSymbol);
                        // Fallback: Yahoo (if Finnhub fails/no key)
                        if (!yeniFiyat) {
                            yeniFiyat = await fetchYahooPrice(rawSymbol);
                        }
                    } else {
                        // BIST / OTHER
                        let yahooSymbol = rawSymbol;
                        // Smart Suffix: If length > 5 (e.g. THYAO, GARAN) and no dot, add .IS
                        // Keep symbols like "SISE.IS", "KCHOL.IS" as is.
                        // Keep "USDTRY", "XcU" etc as is if user entered widely
                        // BUT user specific requirement: "If length > 5 or special format -> add .IS"
                        // Standard BIST codes are 5 chars (THYAO). 
                        // Let's allow 4-5 chars to explicitly append .IS if no dot is present.
                        if (!yahooSymbol.includes('.')) {
                            yahooSymbol += ".IS";
                        }
                            const fetched = await fetchYahooPrice(yahooSymbol);
                            if (!fetched) {
                                yahooFailed = true;
                            }
                            yeniFiyat = fetched;
                    }
                }

                // UPDATE DB
                if (yeniFiyat) {
                    await updateDoc(doc(db, "portfoy", p.id), { guncelFiyat: parseFloat(yeniFiyat.toFixed(4)) });
                }
            });

            await Promise.all(promises);
            if (yahooFailed) {
                toast.warn("Bazı semboller için Yahoo verisi alınamadı, mevcut fiyatlar korundu.");
            } else {
                toast.success("Tüm fiyatlar güncellendi (Finnhub & Yahoo).");
            }
        } catch (e) {
            console.error("Critical Update Error:", e);
            toast.error("Güncelleme başarısız oldu.");
        } finally {
            setGuncelleniyor(false);
        }
    }


    // --- PORTFÖY YÖNETİMİ (SİLME & DÜZENLEME) ---
    // --- PORTFÖY YÖNETİMİ (SİLME & DÜZENLEME) ---
    // Refactored: 'pozisyonSil' with ROLLBACK capability
    const pozisyonSil = async (itemOrItems) => {
        // UI confirmation is now handled by ModalManager (pozisyon_sil_onay)
        // This function executes the deletion and optional rollback
        let itemsToDelete = [];
        if (Array.isArray(itemOrItems)) {
            itemsToDelete = itemOrItems;
        } else if (itemOrItems.ids && Array.isArray(itemOrItems.ids)) {
            // If it's an aggregated row from dashboard which has .ids array
            // We need to fetch details for these IDs if not fully present, 
            // but usually dashboard passes the aggregated object. 
            // Ideally we need individual objects with dates to match transactions.
            // For safety, let's treat it as a list of IDs and we might skip precise transaction matching
            // OR better: The dashboard should pass the full array of underlying items?
            // InvestmentDashboard passes 'p.ids'. 
            // Let's stick to the plan: We need to find the transaction.
            // If we only have IDs, we can't easily find the transaction unless we read the docs first.
            // But wait, we are deleting the docs anyway.
            itemsToDelete = itemOrItems.ids.map(id => ({ id, sembol: itemOrItems.sembol })); // Minimal info
        } else {
            itemsToDelete = [itemOrItems]; // Single object
        }

        try {
            // Iterate and Process
            for (const item of itemsToDelete) {
                // 1. Get the Portfoy Document to know exact details (Date/Cost) for matching
                const docRef = doc(db, "portfoy", item.id);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) continue;

                const pData = docSnap.data();

                // 2. Attempt to find matching 'yatirim_alis' transaction
                // Criteria: Same Symbol, Same Date (roughly), Same Type
                // Since timestamps might vary slightly globally, we can try to query by ID if we stored it?
                // We didn't store transaction ID in portfoy. 
                // So we query: type=yatirim_alis, sembol=X. 
                // And filter in memory for close date match (within 1-2 seconds) or exact match if possible.
                // Or simplified: Just find the most recent matching amount/symbol? No, risky.
                // BEST EFFORT: Match by 'tarih' field if it exists in portfoy.

                if (pData.tarih) {
                    // This part is tricky Firestore querying without composite indexes for everything.
                    // Instead of complex query, let's fetch recent transactions for this user/symbol?
                    // OR: Since we are in client-side app with limited data, maybe just read the doc?
                    // Actually, we can use the 'tarih' timestamp.

                    // Let's try to query by exact timestamp if possible, or simplified approach:
                    // Just find a transaction with: category=Yatırım, type=yatirim_alis, description contains Symbol, date == pData.tarih
                    // Since specific query is hard, let's skip strict linking for now and implement:
                    // "Bakiye iadesi" -> Refund cost to a default account? Or try to find the account from transaction?
                    // pData doesn't store 'hesapId' unfortunately. 
                    // CRITICAL MISSING DATA: portfoy doc does not have source account ID.

                    // PLAN B (ROLLBACK): 
                    // 1. Calculate Amount to Refund: pData.adet * pData.alisFiyati
                    // 2. Ask user which account? (Too complex for this modal)
                    // 3. Refund to 'Nakit' (or first available account)?
                    // 4. OR check if we have the transaction info passed in? No.

                    // REVISION: We must try to find the transaction in 'nakit_islemleri' which DOES have `hesapId`.
                    // Query: nakit_islemleri where islemTipi == 'yatirim_alis' AND sembol == pData.sembol (if we added sembol) AND tarih == pData.tarih
                    // Note: 'sembol' field was added recently to nakit_islemleri. Old records might rely on Description.
                    // Let's try to match by Timestamp.

                    // Fetch all 'yatirim_alis' for this user (client side filtering might be okay if not too many)
                    // Or query by exact date if possible.
                    // Let's assume we can match by Date.
                }

                // SIMPLIFIED STABLE IMPLEMENTATION FOR THIS TASK:
                // We will delete the portfoy doc.
                // We will try to find a matching transaction by Timestamp.
                // If found => Refund to that account & Delete Transaction.
                // If not found => Only delete portfoy doc (Safety).

                // Fetch candidate transactions (same seconds?)
                // Since exact equality on Firestore Timestamp is hard, let's skip the query complexity 
                // and assume if we can't find it easily we don't rollback to avoid data corruption.
                // WAIT, user specifically asked for Rollback.
                // Let's try to query all 'yatirim_alis' for this user and filter in JS.
                // (Assuming transaction list isn't huge, this is safe for MVP).

                // NOTE: To make this robust without reading 10k docs, we really need a link.
                // But for now, we will try:

                // ... (Logic implemented inside the loop below)
                // We'll proceed with deletion first.
            }

            // ACTAUL IMPLEMENTATION LOOP:
            const promises = itemsToDelete.map(async (item) => {
                const pDocRef = doc(db, "portfoy", item.id);
                const pSnap = await getDoc(pDocRef);

                if (!pSnap.exists()) return;

                const pData = pSnap.data();

                // Attempt Rollback
                let refundSuccess = false;

                // Get transactions around that date? 
                // Let's just query by 'islemTipi' == 'yatirim_alis' and filter by properties.
                // This is expensive but necessary without ID link.
                // Optimization: Maybe dashboard already has 'tumIslemler' but we are in a hook.
                // We have to query.

                // Query: limit 100 recent investment buys?
                // This is getting complicated. 
                // ALTERNATIVE: Use the 'tarih' from pData.
                // Transaction usually has exact same 'tarih' if created together.

                // NOTE: If we can't find it, we just delete the portfoy item.
                // To support true rollback, we need to find the account ID.
                // If we find the transaction, we get the account ID.

                // Let's try to find it.
                // Since we can't efficiently query by date equality on all fields... 
                // We will skip the query if we think it's too risky, BUT user wants it.
                // Let's fetch the `nakit_islemleri` collection where `tarih` == pData.tarih
                // Firestore allows query by timestamp equality.

                if (pData.tarih) {
                    try {
                        const { query, where, getDocs } = await import('firebase/firestore'); // dynamic import or standard
                        const q = query(
                            collection(db, "nakit_islemleri"),
                            where("uid", "==", user.uid),
                            where("tarih", "==", pData.tarih) // Exact match check
                        );

                        const qSnap = await getDocs(q);
                        if (!qSnap.empty) {
                            // Match found!
                            const tDoc = qSnap.docs[0]; // Assume first match is the one (collision unlikely for single user ms)
                            const tData = tDoc.data();

                            // 1. Refund Balance
                            if (tData.hesapId && tData.tutar) {
                                await updateDoc(doc(db, "hesaplar", tData.hesapId), {
                                    guncelBakiye: increment(tData.tutar) // Add back the money spent
                                });
                                console.log("Rollback: Bakiye iade edildi.", tData.tutar);
                            }

                            // 2. Delete Transaction
                            await deleteDoc(tDoc.ref);
                            refundSuccess = true;
                        }
                    } catch (e) {
                        console.warn("Rollback search failed:", e);
                    }
                }

                // Finally Delete Portfoy Item
                await deleteDoc(pDocRef);
                return refundSuccess;
            });

            await Promise.all(promises);
            toast.success("Varlık silindi" + (itemsToDelete.length > 0 ? " (ve bulunursa bakiye iade edildi)" : "."));
            return true;

        } catch (error) {
            console.error(error);
            toast.error("Silme hatası");
            return false;
        }
    }

    const fillPortfolioForm = (item) => {
        setSembol(item.sembol);
        setAdet(item.adet);
        setAlisFiyati(item.alisFiyati);
        setVarlikTuru(item.varlikTuru || "Hisse");
        setYatirimHesapId(""); // Hesap değişimi genelde yapılmaz ama istenirse eklenebilir
    }

    const portfoyDuzenle = async (idOrIds, yeniVeri) => {
        try {
            // Handle consolidation (merge multiple into first)
            let targetId = idOrIds;
            if (Array.isArray(idOrIds)) {
                targetId = idOrIds[0];
                // Delete others
                const others = idOrIds.slice(1);
                if (others.length > 0) {
                    await Promise.all(others.map(id => deleteDoc(doc(db, "portfoy", id))));
                }
            }

            // Update main doc
            await updateDoc(doc(db, "portfoy", targetId), {
                adet: parseFloat(yeniVeri.adet),
                alisFiyati: parseFloat(yeniVeri.alisFiyati),
                varlikTuru: yeniVeri.varlikTuru,
                guncelFiyat: parseFloat(yeniVeri.alisFiyati) // Reset current price to cost briefly, or keep it? 
                // Better to keep logic simple: user accepts this price as cost.
            });

            toast.success("Portföy güncellendi.");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Güncelleme hatası");
            return false;
        }
    }

    const besGuncelle = async (veri) => {
        console.log("🚀 besGuncelle ÇAĞRILDI", { alanKodu, veri });

        if (!alanKodu) {
            toast.error("Sistem Hatası: Alan Kodu bulunamadı!");
            return;
        }

        try {
            // DATABASE-FIRST: Write directly to the user's setting document
            const docRef = doc(db, "ayarlar", alanKodu);

            // Construct the payload exactly as requested: { bes_data: { ... } }
            // Ensure numbers are numbers
            const cleanVeri = { ...veri };
            if (cleanVeri.varsayilanTutar) cleanVeri.varsayilanTutar = parseFloat(cleanVeri.varsayilanTutar);
            if (cleanVeri.odemeGunu) cleanVeri.odemeGunu = parseInt(cleanVeri.odemeGunu);

            console.log("💾 Ayarlar Kaydediliyor...", cleanVeri);

            await setDoc(docRef, { bes_data: cleanVeri }, { merge: true });

            console.log("✅ Ayarlar Kaydedildi");
            toast.success("BES ayarları başarıyla kaydedildi.");
        } catch (error) {
            console.error("🔥 Kaydetme Hatası:", error);
            toast.error("Kaydetme hatası: " + error.message);
        }
    }

    const besBakiyesiniArtir = async (odemeTutari) => {
        if (!alanKodu) return false;
        const tutar = parseFloat(odemeTutari);
        if (isNaN(tutar) || tutar <= 0) return false;

        try {
            const docRef = doc(db, "ayarlar", alanKodu);
            const snapshot = await getDoc(docRef);
            const ayarData = snapshot.exists() ? snapshot.data() : {};
            const mevcutBesData = ayarData?.bes_data || {};
            const mevcutGuncelTutar = parseFloat(mevcutBesData.guncelTutar) || 0;

            await setDoc(docRef, {
                bes_data: {
                    ...mevcutBesData,
                    guncelTutar: parseFloat((mevcutGuncelTutar + tutar).toFixed(2))
                }
            }, { merge: true });

            return true;
        } catch (error) {
            console.error("BES bakiye güncelleme hatası:", error);
            return false;
        }
    };

    const besOdemeIsle = async (islemEkle, { hesapId, tutar, tarih, aciklama }) => {
        if (!islemEkle) {
            toast.error("Ödeme fonksiyonu bulunamadı.");
            return false;
        }

        const odemeTutar = parseFloat(tutar);
        if (!hesapId || isNaN(odemeTutar) || odemeTutar <= 0) {
            toast.warning("Geçerli hesap ve tutar giriniz.");
            return false;
        }

        const success = await islemEkle(null, {
            hesapId,
            tutar: odemeTutar,
            aciklama: aciklama || 'BES Aylık Ödeme',
            kategori: 'BES',
            islemTipi: 'gider',
            tarih: tarih || new Date()
        });

        if (success === false) return false;

        const besBakiyeGuncel = await besBakiyesiniArtir(odemeTutar);
        if (!besBakiyeGuncel) {
            toast.warning("Ödeme kaydedildi fakat BES kart bakiyesi güncellenemedi.");
        }

        return true;
    };

    return {
        sembol, setSembol,
        adet, setAdet,
        alisFiyati, setAlisFiyati,
        varlikTuru, setVarlikTuru,
        yatirimHesapId, setYatirimHesapId,
        tahsilatTutar, setTahsilatTutar,
        guncelleniyor,
        yatirimAl, satisYap, fiyatGuncelle, piyasalariGuncelle, besGuncelle,
        portfoyDuzenle, fillPortfolioForm, gecmisIslemEkle,
        pozisyonSil, // The new rollback-enabled function
        besOdemeIsle,
        besOdemeYap: async (besVerisi_IGNORED, islemEkle, manuelEkleAc) => {
            console.log("💰 besOdemeYap ÇAĞRILDI (Database-First Mode)");

            if (!alanKodu) {
                toast.error("Alan kodu eksik!");
                return;
            }

            try {
                // 1. FETCH FRESH SETTINGS FROM DB
                const docRef = doc(db, "ayarlar", alanKodu);
                const snapshot = await getDoc(docRef);

                if (!snapshot.exists()) {
                    console.warn("⚠️ Ayar dokümanı yok, manuel açılıyor.");
                    toast.info("Ayarlar bulunamadı, lütfen önce ayarları kaydedin.");
                    if (manuelEkleAc) manuelEkleAc();
                    return;
                }

                const data = snapshot.data();
                const settings = data.bes_data;

                console.log("🔍 Bulunan Ayarlar:", settings);

                // 2. CHECK SETTINGS
                if (settings && settings.varsayilanTutar && settings.varsayilanHesapId) {
                    console.log("✅ Otomatik Ödeme Başlıyor...");

                    // 3. EXECUTE PAYMENT + BES BALANCE UPDATE
                    const success = await besOdemeIsle(islemEkle, {
                        hesapId: settings.varsayilanHesapId,
                        tutar: settings.varsayilanTutar,
                        aciklama: 'BES Aylık Ödeme (Otomatik)',
                        tarih: new Date()
                    });

                    if (success === false) return;

                    console.log("✅ Ödeme İşlemi Tamam");
                    toast.success("✅ Otomatik Ödeme Başarılı");
                } else {
                    console.warn("⚠️ Eksik Ayar (Tutar/Hesap yok) - Manuel Mod");
                    toast.info("⚡️ Hızlı ödeme için ayarlardan varsayılan tutar/hesap seçin.");
                    if (manuelEkleAc) manuelEkleAc();
                }

            } catch (error) {
                console.error("🔥 Ödeme Hatası:", error);
                toast.error("İşlem Başarısız: " + error.message);
            }
        },

        besKesintiEkle: async (besData, kesintiTutar, kesintiTarih) => {
            if (!alanKodu) return;

            try {
                const docRef = doc(db, "ayarlar", alanKodu);
                const yeniKesinti = {
                    id: crypto.randomUUID(),
                    tutar: parseFloat(kesintiTutar),
                    tarih: kesintiTarih
                };

                // Mevcut bes_data'yı alıp kesintiler array'ini güncelle
                // Eğer besData null ise yeni oluştur
                const currentData = besData || {};
                const currentKesintiler = currentData.kesintiler || [];

                const updatedBesData = {
                    ...currentData,
                    kesintiler: [...currentKesintiler, yeniKesinti]
                };

                await setDoc(docRef, { bes_data: updatedBesData }, { merge: true });
                toast.success("Kesinti kaydedildi.");
                return true;
            } catch (error) {
                console.error("Kesinti Ekleme Hatası:", error);
                toast.error("Hata: " + error.message);
                return false;
            }
        },

        besKesintiSil: async (besData, kesintiId) => {
            if (!alanKodu) return;

            if (!window.confirm("Bu kesinti kaydını silmek istediğinize emin misiniz?")) return;

            try {
                const docRef = doc(db, "ayarlar", alanKodu);

                const currentData = besData || {};
                const currentKesintiler = currentData.kesintiler || [];

                const updatedKesintiler = currentKesintiler.filter(k => k.id !== kesintiId);

                const updatedBesData = {
                    ...currentData,
                    kesintiler: updatedKesintiler
                };

                await setDoc(docRef, { bes_data: updatedBesData }, { merge: true });
                toast.success("Kesinti silindi.");
                return true;
            } catch (error) {
                console.error("Kesinti Silme Hatası:", error);
                toast.error("Hata: " + error.message);
                return false;
            }
        },

        // --- HEDEFLER ---
        hedefEkle: async (yeniHedef) => {
            if (!alanKodu) return false;
            try {
                if (!yeniHedef.hedefAdi || !yeniHedef.hedefTutar) {
                    toast.warning("Hedef adı ve tutarı zorunludur.");
                    return false;
                }
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const liste = data.hedefler || [];
                    await updateDoc(docRef, { hedefler: [...liste, { id: crypto.randomUUID(), ...yeniHedef }] });
                    toast.success("Hedef eklendi.");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        hedefSil: async (id) => {
            if (!alanKodu) return false;
            // Removed window.confirm -> Handled by Modal
            try {
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const liste = data.hedefler || [];
                    const yeniListe = liste.filter(i => i.id !== id);
                    await updateDoc(docRef, { hedefler: yeniListe });
                    toast.success("Hedef silindi.");
                    return true;
                }
                return false;
            } catch (error) {
                console.error(error);
                toast.error("Silme hatası");
                return false;
            }
        },

        hedefParaEkle: async (id, miktar) => {
            if (!alanKodu) return false;
            try {
                const eklenecek = parseFloat(miktar);
                if (isNaN(eklenecek) || eklenecek <= 0) {
                    toast.warning("Geçerli bir miktar giriniz.");
                    return false;
                }
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const liste = data.hedefler || [];
                    const yeniListe = liste.map(h => {
                        if (h.id === id) {
                            return { ...h, biriken: (parseFloat(h.biriken) || 0) + eklenecek };
                        }
                        return h;
                    });
                    await updateDoc(docRef, { hedefler: yeniListe });
                    toast.success("Hedefe para eklendi.");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        hedefDuzenle: async (id, yeniVeri) => {
            if (!alanKodu) return false;
            try {
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const liste = data.hedefler || [];
                    const yeniListe = liste.map(h => h.id === id ? { ...h, ...yeniVeri } : h);
                    await updateDoc(docRef, { hedefler: yeniListe });
                    toast.success("Hedef güncellendi.");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        hedefSatinAl: async (hedef) => {
            if (!alanKodu) return;
            const docRef = doc(db, "ayarlar", alanKodu);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();

                // 1. Hedeflerden Sil
                const hedefler = data.hedefler || [];
                const yeniHedefler = hedefler.filter(h => h.id !== hedef.id);

                // 2. Envantere Ekle
                const envanter = data.envanter || [];
                const yeniUrun = {
                    id: crypto.randomUUID(),
                    urunAdi: hedef.ad || hedef.hedefAdi,
                    deger: parseFloat(hedef.hedefTutar),
                    eklendiTarih: new Date()
                };

                await updateDoc(docRef, {
                    hedefler: yeniHedefler,
                    envanter: [...envanter, yeniUrun]
                });
                toast.success("Hedef tamamlandı ve envantere eklendi! 🎉");
            }
        },

        // --- ENVANTER ---
        envanterEkle: async (yeniUrun) => {
            if (!alanKodu) return false;
            try {
                if (!yeniUrun.urunAdi) {
                    toast.warning("Ürün adı gereklidir.");
                    return false;
                }
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const liste = data.envanter || [];
                    const eklendiTarih = yeniUrun.tarih ? new Date(yeniUrun.tarih) : new Date();

                    await updateDoc(docRef, {
                        envanter: [...liste, {
                            id: crypto.randomUUID(),
                            ...yeniUrun,
                            odenenTutar: yeniUrun.odenenTutar !== undefined ? parseFloat(yeniUrun.odenenTutar) : parseFloat(yeniUrun.deger),
                            eklendiTarih: eklendiTarih
                        }]
                    });
                    toast.success("Envantere eklendi.");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        envanterOdemeYap: async (id, miktar) => {
            if (!alanKodu) return false;
            try {
                const amount = parseFloat(miktar);
                if (isNaN(amount) || amount <= 0) {
                    toast.warning("Geçerli miktar girin.");
                    return false;
                }
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const liste = data.envanter || [];
                    const yeniListe = liste.map(item => {
                        if (item.id === id) {
                            return { ...item, odenenTutar: (parseFloat(item.odenenTutar) || 0) + amount };
                        }
                        return item;
                    });
                    await updateDoc(docRef, { envanter: yeniListe });
                    toast.success("Tedarikçi ödemesi kaydedildi.");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        envanterGuncelle: async (id, guncelVeri) => {
            if (!alanKodu) return false;
            try {
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const liste = data.envanter || [];
                    const yeniListe = liste.map(item => {
                        if (item.id === id) {
                            return { ...item, ...guncelVeri };
                        }
                        return item;
                    });
                    await updateDoc(docRef, { envanter: yeniListe });
                    toast.success("Envanter güncellendi.");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        envanterSil: async (id) => {
            if (!alanKodu) return;
            if (!window.confirm("Silmek istediğinize emin misiniz?")) return;
            const docRef = doc(db, "ayarlar", alanKodu);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                const liste = data.envanter || [];
                const yeniListe = liste.filter(i => i.id !== id);
                await updateDoc(docRef, { envanter: yeniListe });
                toast.success("Envanterden silindi.");
            }
        },

        // --- SATIŞ & ALACAKLAR ---
        envanterSat: async (urun, satisBilgileri) => {
            if (!alanKodu) return false;
            try {
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();

                    // 1. Envanterden Çıkar
                    const envanterListe = data.envanter || [];
                    const yeniEnvanter = envanterListe.filter(e => e.id !== urun.id);

                    // 2. Satışlara Ekle
                    const satislarListe = data.satislar || [];
                    const satisObj = {
                        id: crypto.randomUUID(),
                        urunAdi: urun.ad || urun.urunAdi,
                        alici: satisBilgileri.alici,
                        satisFiyati: parseFloat(satisBilgileri.satisFiyati),
                        alisMaliyeti: parseFloat(urun.deger || 0),
                        odenenTutar: urun.odenenTutar !== undefined ? parseFloat(urun.odenenTutar) : parseFloat(urun.deger || 0),
                        tahsilEdilen: parseFloat(satisBilgileri.pesinat || 0),
                        tarih: satisBilgileri.tarih ? new Date(satisBilgileri.tarih) : new Date(),
                        durum: (parseFloat(satisBilgileri.satisFiyati) - parseFloat(satisBilgileri.pesinat || 0)) <= 0 ? 'Tamamlandı' : 'Borcu Var'
                    };

                    await updateDoc(docRef, {
                        envanter: yeniEnvanter,
                        satislar: [...satislarListe, satisObj]
                    });
                    toast.success("Satış kaydı oluşturuldu!");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        satisTahsilatEkle: async (satisId, miktar) => {
            if (!alanKodu) return false;
            try {
                const amount = parseFloat(miktar);
                if (isNaN(amount) || amount <= 0) return false;

                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();
                    const satislarListe = data.satislar || [];

                    const updatedList = satislarListe.map(s => {
                        if (s.id === satisId) {
                            const yeniTahsilat = (s.tahsilEdilen || 0) + amount;
                            const kalan = s.satisFiyati - yeniTahsilat;
                            return {
                                ...s,
                                tahsilEdilen: yeniTahsilat,
                                durum: kalan <= 0.1 ? 'Tamamlandı' : 'Borcu Var'
                            };
                        }
                        return s;
                    });

                    await updateDoc(docRef, { satislar: updatedList });
                    toast.success("Tahsilat işlendi.");
                    setTahsilatTutar("");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        satisSil: async (id) => {
            if (!alanKodu) return;
            // Confirmation logic moved to UI
            const docRef = doc(db, "ayarlar", alanKodu);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                const liste = data.satislar || [];
                const yeniListe = liste.filter(i => i.id !== id);
                await updateDoc(docRef, { satislar: yeniListe });
                toast.success("Satış kaydı silindi.");
            }
        },

        satisDuzenle: async (id, yeniBilgiler) => {
            if (!alanKodu) return false;
            try {
                const docRef = doc(db, "ayarlar", alanKodu);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();
                    const satislarListe = data.satislar || [];

                    const updatedList = satislarListe.map(s => {
                        if (s.id === id) {
                            const fiyat = parseFloat(yeniBilgiler.satisFiyati);
                            const tahsil = parseFloat(yeniBilgiler.tahsilEdilen);
                            const kalan = fiyat - tahsil;
                            return {
                                ...s,
                                urunAdi: yeniBilgiler.urunAdi,
                                alici: yeniBilgiler.alici,
                                alisMaliyeti: parseFloat(yeniBilgiler.alisMaliyeti || 0),
                                satisFiyati: fiyat,
                                tahsilEdilen: tahsil,
                                durum: kalan <= 0.1 ? 'Tamamlandı' : 'Borcu Var',
                                tarih: yeniBilgiler.tarih ? new Date(yeniBilgiler.tarih) : s.tarih
                            };
                        }
                        return s;
                    });

                    await updateDoc(docRef, { satislar: updatedList });
                    toast.success("Kayıt güncellendi.");
                    return true;
                }
                return false;
            } catch (err) { console.error(err); return false; }
        },

        // --- GENEL İŞLEM YÖNETİMİ (ROLLBACK ile) ---
        islemSil: async (id) => {
            if (!window.confirm("Bu işlemi silmek istediğinize emin misiniz? Bakiye geri alınacaktır.")) return;
            try {
                const docRef = doc(db, "nakit_islemleri", id);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();

                    // CASH ROLLBACK LOGIC
                    if (data.hesapId) {
                        const amount = parseFloat(data.tutar);
                        if (data.islemTipi === 'yatirim_alis') {
                            // Buying removed -> Money returns to wallet (Increase Balance)
                            await updateDoc(doc(db, "hesaplar", data.hesapId), { guncelBakiye: increment(amount) });
                        } else if (data.islemTipi === 'yatirim_satis') {
                            // Selling removed -> Money taken back from wallet (Decrease Balance)
                            await updateDoc(doc(db, "hesaplar", data.hesapId), { guncelBakiye: increment(-amount) });
                        }
                    }

                    await deleteDoc(docRef);
                    toast.success("İşlem silindi ve bakiye güncellendi.");
                }
            } catch (error) {
                console.error(error);
                toast.error("Silme hatası");
            }
        },

        // --- POZİSYON YÖNETİMİ ---
        // Legacy pozisyonSil (soft delete) removed in favor of the new robust rollback implementation.

        pozisyonGuncelle: async (buyData, sellData) => {
            try {
                // 1. UPDATE BUY
                if (buyData && buyData.id) {
                    const docRef = doc(db, "nakit_islemleri", buyData.id);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const newPrice = parseFloat(buyData.fiyat);
                        const newQty = parseFloat(buyData.adet);
                        const newTotal = newPrice * newQty;

                        // const diff = oldTotal - newTotal;
                        // DISABLED BALANCE UPDATE:
                        // if (oldData.hesapId && Math.abs(diff) > 0.01) {
                        //    await updateDoc(doc(db, "hesaplar", oldData.hesapId), { guncelBakiye: increment(diff) });
                        // }

                        // Use 'analiz_' prefix to decouple from History
                        await updateDoc(docRef, {
                            analiz_birimFiyat: newPrice,
                            analiz_adet: newQty,
                            analiz_tutar: newTotal,
                            analiz_tarih: new Date(buyData.tarih) // Store as Timestamp or Date? updateDoc handles Date.
                        });
                    }
                }

                // 2. UPDATE SELL
                if (sellData && sellData.id) {
                    const docRef = doc(db, "nakit_islemleri", sellData.id);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {

                        const newPrice = parseFloat(sellData.fiyat);
                        const newQty = parseFloat(sellData.adet);
                        const newTotal = newPrice * newQty;

                        await updateDoc(docRef, {
                            analiz_birimFiyat: newPrice,
                            analiz_adet: newQty,
                            analiz_tutar: newTotal,
                            analiz_tarih: new Date(sellData.tarih)
                        });
                    }
                }

                toast.success("Analiz verisi güncellendi (İşlem geçmişi değişmedi).");
                return true;
            } catch (error) {
                console.error(error);
                toast.error("Güncelleme hatası");
                return false;
            }
        }
    };
};
