import React, { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import QuickTransactionForm from './QuickTransactionForm';

const toLocalDateTimeValue = (date = new Date()) => {
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 16);
};

const toLocalDateValue = (date = new Date()) => {
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 10);
};

const isTypingTarget = (target) => {
    const tagName = target?.tagName?.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable;
};

const GlobalQuickTransaction = ({ isOpen, onOpen, onClose, quickFormProps }) => {
    const quickFormPropsRef = useRef(quickFormProps);

    useEffect(() => {
        quickFormPropsRef.current = quickFormProps;
    }, [quickFormProps]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const isShortcut = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n';
            if (!isShortcut || isTypingTarget(event.target)) return;
            event.preventDefault();
            onOpen?.();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleEscape = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const props = quickFormPropsRef.current;
        const defaultAccountId = props?.defaultPaymentAccountId || '';
        const nowDateTime = toLocalDateTimeValue();
        const today = toLocalDateValue();

        props?.setFormTab?.('islem');
        props?.setSecilenHesapId?.(defaultAccountId);
        props?.setIslemTipi?.('gider');
        props?.setKategori?.('');
        props?.setIslemAciklama?.('');
        props?.setIslemTutar?.('');
        props?.setIslemTarihi?.(nowDateTime);
        props?.setIslemGelirTuru?.('Diğer Gelir');
        props?.setIslemBagliMaasId?.('');
        props?.setIslemMaasDonemi?.('');

        props?.setTransferKaynakId?.(defaultAccountId);
        props?.setTransferHedefId?.('');
        props?.setTransferTutar?.('');
        props?.setTransferUcreti?.('');
        props?.setTransferAciklama?.('');
        props?.setTransferTarihi?.(nowDateTime);

        props?.setTaksitHesapId?.(defaultAccountId);
        props?.setTaksitBaslik?.('');
        props?.setTaksitToplamTutar?.('');
        props?.setTaksitSayisi?.('');
        props?.setTaksitKategori?.('');
        props?.setTaksitAlisTarihi?.(today);

        props?.setSecilenTanimId?.('');
        props?.setFaturaGirisTutar?.('');
        props?.setFaturaGirisTarih?.(today);
        props?.setFaturaGirisAciklama?.('');
    }, [isOpen]);

    return (
        <>
            <button type="button" className="global-quick-fab" onClick={onOpen} aria-label="Hızlı işlem aç">
                <Plus size={20} strokeWidth={2.6} />
                <span>Hızlı İşlem</span>
            </button>

            {isOpen && (
                <div className="global-quick-layer" role="presentation">
                    <div className="global-quick-overlay" onClick={onClose} aria-hidden="true" />
                    <aside className="global-quick-panel" role="dialog" aria-modal="true" aria-labelledby="global-quick-title">
                        <div className="global-quick-handle" aria-hidden="true" />
                        <header className="global-quick-header">
                            <div>
                                <h2 id="global-quick-title">Hızlı İşlem</h2>
                                <p>İşlem, transfer, taksit veya fatura kaydı ekle.</p>
                            </div>
                            <button type="button" className="qw-mini-icon-button" onClick={onClose} aria-label="Kapat">
                                <X size={18} />
                            </button>
                        </header>
                        <div className="global-quick-content">
                            <QuickTransactionForm {...quickFormProps} onSuccess={onClose} />
                        </div>
                    </aside>
                </div>
            )}
        </>
    );
};

export default GlobalQuickTransaction;
