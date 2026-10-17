// Copyright (C) 2017-2023 Smart code 203358507

const Addons = require('./Addons');
const Board = require('./Board');
const Discover = require('./Discover');
const Library = require('./Library');
const Stats = require('./Stats').default;
const Calendar = require('./Calendar').default;
const MetaDetails = require('./MetaDetails');
const NotFound = require('./NotFound');
const Search = require('./Search');
const { default: Settings } = require('./Settings');
const Player = require('./Player');
const Intro = require('./Intro');
const Person = require('./Person').default;
const Services = require('./Services').default;
const TvLive = require('./TvLive').default;

module.exports = {
    Addons,
    Person,
    Services,
    TvLive,
    Board,
    Discover,
    Library,
    Stats,
    Calendar,
    MetaDetails,
    NotFound,
    Search,
    Settings,
    Player,
    Intro
};
