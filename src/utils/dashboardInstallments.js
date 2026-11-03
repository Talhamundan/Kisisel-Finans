import { getAllInstallmentStatuses } from './definitions.js';

// Payment history includes completed and reconstructed plans; the dashboard
// should only show plans that still have installments to pay.
export const getActiveDashboardInstallmentStatuses = (installments = [], transactions = []) => (
    getAllInstallmentStatuses(installments, transactions).filter((status) => {
        const installment = status.installment;
        const completionStatus = String(installment.status || installment.durum || '').toLowerCase();
        const isCompleted = installment.paid === true
            || installment.isPaid === true
            || Boolean(installment.paidAt)
            || ['paid', 'completed', 'complete', 'odendi', 'tamamlandi'].includes(completionStatus);
        const remainingCount = parseInt(installment.remainingInstallments);
        return !isCompleted
            && status.remainingCount > 0
            && status.remainingAmount > 0
            && !(Number.isFinite(remainingCount) && remainingCount <= 0);
    })
);
