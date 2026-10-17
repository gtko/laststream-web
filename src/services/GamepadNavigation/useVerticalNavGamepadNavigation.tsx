// Copyright (C) 2017-2026 Smart code 203358507

import { useEffect } from 'react';
import { useGamepad } from '../GamepadContext';

// Visual order of the vertical nav bar, used for LT/RT.
const ROUTES = ['search', 'board', 'discover', 'library', 'stats', 'calendar', 'addons', 'settings'];
// Digit shortcuts per route (see NAVIGATE_TABS_ROUTES in App.js and shortcuts.json), kept stable when tabs are added.
const ROUTE_DIGITS: Record<string, number> = { search: 0, board: 1, discover: 2, library: 3, calendar: 4, addons: 5, settings: 6, stats: 7 };

const useVerticalGamepadNavigation = (_sectionRef: React.RefObject<HTMLDivElement>, currentRoute: string) => {
    const gamepad = useGamepad();

    useEffect(() => {
        const navigate = (direction: 'prev' | 'next') => {
            const currentIndex = ROUTES.indexOf(currentRoute);
            if (currentIndex === -1) return;

            let nextIndex = currentIndex;
            if (direction === 'next') nextIndex = Math.min(currentIndex + 1, ROUTES.length - 1);
            if (direction === 'prev') nextIndex = Math.max(currentIndex - 1, 0);

            if (nextIndex !== currentIndex) {
                const digit = ROUTE_DIGITS[ROUTES[nextIndex]];
                document.dispatchEvent(new KeyboardEvent('keydown', { key: String(digit), code: `Digit${digit}`, bubbles: true }));
            }
        };

        gamepad?.on('buttonLT', currentRoute, () => navigate('prev'));
        gamepad?.on('buttonRT', currentRoute, () => navigate('next'));

        return () => {
            gamepad?.off('buttonLT', currentRoute);
            gamepad?.off('buttonRT', currentRoute);
        };
    }, [gamepad, currentRoute]);
};

export default useVerticalGamepadNavigation;
