// Copyright (C) 2017-2026 Smart code 203358507

import React from 'react';

type IconProps = {
    className?: string,
};

export const PlayIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M7 4l13 8-13 8z" />
    </svg>
);

export const SoundIcon = ({ muted, className }: IconProps & { muted: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {muted ? (
            <path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6" />
        ) : (
            <path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />
        )}
    </svg>
);

export const InfoIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
    </svg>
);

export const ChevronIcon = ({ className }: IconProps) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
    </svg>
);
