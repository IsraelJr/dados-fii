"use client";

export default function GoogleAdsBlock({ onClose }: { onClose?: () => void }) {
    return (
        <button
            type="button"
            autoFocus
            onFocus={onClose}
            onClick={onClose}
            aria-hidden="true"
            className="sr-only"
        >
            continuar
        </button>
    );
}
