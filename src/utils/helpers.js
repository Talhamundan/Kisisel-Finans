// --- YARDIMCI FONSİYONLAR ---

export const formatCurrencyPlain = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

// Firestore Timestamp / JS Date / string -> Date
export const toDateSafe = (t) => {
    if (!t) return null;
    if (t instanceof Date) return isNaN(t.getTime()) ? null : t;
    if (typeof t === 'string' || typeof t === 'number') {
        const d = new Date(t);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof t?.toDate === 'function') {
        const d = t.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    }
    if (typeof t?.seconds === 'number') {
        const d = new Date(t.seconds * 1000);
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

export const tarihFormatla = (t) => {
    if (!t) return "";
    const d = toDateSafe(t);
    if (!d) return "";
    return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' });
};

export const tarihSadeceGunAyYil = (t) => {
    if (!t) return "";
    const d = toDateSafe(t);
    if (!d) return "";
    return d.toLocaleDateString("tr-TR");
};

export const ayIsmiGetir = (firebaseTarih) => {
    if (!firebaseTarih) return "Bilinmiyor";
    const date = toDateSafe(firebaseTarih);
    if (!date) return "Bilinmiyor";
    return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

export const sortTurkishText = (items = []) => {
    return [...items].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b), 'tr-TR', { sensitivity: 'base' }));
};

// --- STİL SABİTLERİ ---

export const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 'var(--radius-input, 12px)',
    border: '1px solid var(--border, rgba(15, 23, 42, 0.12))',
    backgroundColor: 'var(--surface-solid, #fff)',
    color: 'var(--text, #0f172a)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    appearance: 'none',
    boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06))'
};

export const cardStyle = {
    background: 'var(--surface, rgba(255, 255, 255, 0.92))',
    padding: '18px',
    borderRadius: 'var(--radius-card, 18px)',
    boxShadow: 'var(--shadow-md, 0 10px 30px rgba(15, 23, 42, 0.08))',
    border: '1px solid var(--border, rgba(15, 23, 42, 0.08))',
    color: 'var(--text, #0f172a)'
};

export const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919', '#e15fed', '#82ca9d'];
// RENK PALETLERİ
export const COLORS_GENEL = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308']; // Indigo-Rose scale
export const COLORS_PORTFOLIO = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']; // Blue-Green-Amber scale
