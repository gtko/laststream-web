// Copyright (C) 2017-2026 Smart code 203358507

// Vrai pendant qu’une rangée est glissée à la souris : les aperçus au survol restent fermés.
let rowDragging = false;

export const setRowDragging = (value: boolean): void => {
    rowDragging = value;
};

export const isRowDragging = (): boolean => rowDragging;
