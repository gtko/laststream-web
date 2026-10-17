// Copyright (C) 2017-2026 Smart code 203358507

import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe } from './config';
import type { LastAddonSnapshot } from './types';

/** État LastAddon courant ({ configured, base, config }). Se met à jour à chaque setBase / setConfig. */
export const useLastAddon = (): LastAddonSnapshot => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
