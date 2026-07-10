import React from 'react';
import { WalletCards } from 'lucide-react';

const sizeMap = {
    sm: 30,
    md: 38,
    lg: 46,
};

const iconSizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
};

const AppLogo = ({ size = 'md', showText = false, variant = 'default', className = '' }) => {
    const markSize = sizeMap[size] || sizeMap.md;
    const iconSize = iconSizeMap[size] || iconSizeMap.md;

    return (
        <div className={`app-logo app-logo--${size} app-logo--${variant} ${className}`.trim()}>
            <span
                className="app-logo__mark"
                style={{ width: markSize, height: markSize, borderRadius: Math.round(markSize * 0.38) }}
                aria-hidden="true"
            >
                <WalletCards size={iconSize} strokeWidth={2.45} />
            </span>
            {showText && <span className="app-logo__text">Kişisel Finans</span>}
        </div>
    );
};

export default AppLogo;
