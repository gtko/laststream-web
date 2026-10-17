// Copyright (C) 2017-2026 Smart code 203358507

const useModelState = require('stremio/common/useModelState');

const map = (ctx) => ctx.libraryStats;

const useLibraryStats = () => {
    return useModelState({ model: 'ctx', map });
};

module.exports = useLibraryStats;
