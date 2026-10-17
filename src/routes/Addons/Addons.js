// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const { useParams } = require('react-router');
const { useSearchParams } = require('react-router-dom');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { useCore } = require('stremio/core');
const { usePlatform, useBinaryState, useProfile, withCoreSuspender } = require('stremio/common');
const { AddonDetailsModal, Button, Image, MainNavBars, ModalDialog, SearchBar, SharePrompt, TextInput, MultiselectMenu } = require('stremio/components');
const useToast = require('stremio/common/Toast/useToast');
const receivesWatchActivity = require('stremio/components/AddonDetailsModal/receivesWatchActivity');
const Addon = require('./Addon');
const useInstalledAddons = require('./useInstalledAddons');
const useRemoteAddons = require('./useRemoteAddons');
const useAddonDetailsTransportUrl = require('./useAddonDetailsTransportUrl');
const useSelectableInputs = require('./useSelectableInputs');
const styles = require('./styles');
const { AddonPlaceholder } = require('./AddonPlaceholder');

const Addons = () => {
    const { type, transportUrl, catalogId } = useParams();
    const [queryParams] = useSearchParams();
    const urlParams = React.useMemo(() => ({
        type,
        transportUrl,
        catalogId
    }), [type, transportUrl, catalogId]);
    const { t } = useTranslation();
    const platform = usePlatform();
    const core = useCore();
    const toast = useToast();
    const profile = useProfile();
    const installedAddons = useInstalledAddons(urlParams);
    const remoteAddons = useRemoteAddons(urlParams);
    const [addonDetailsTransportUrl, setAddonDetailsTransportUrl] = useAddonDetailsTransportUrl(urlParams);
    const selectInputs = useSelectableInputs(installedAddons, remoteAddons);
    const [filtersModalOpen, openFiltersModal, closeFiltersModal] = useBinaryState(false);
    const [addAddonModalOpen, openAddAddonModal, closeAddAddonModal] = useBinaryState(false);
    const addAddonUrlInputRef = React.useRef(null);
    const addAddonOnSubmit = React.useCallback(() => {
        if (addAddonUrlInputRef.current !== null) {
            try {
                let url = new URL(addAddonUrlInputRef.current.value).toString();
                setAddonDetailsTransportUrl(url);
            } catch (e) {
                toast.show({
                    type: 'error',
                    title: `Failed to parse addon url: ${addAddonUrlInputRef.current.value}`,
                    timeout: 10000
                });
                console.error('Failed to parse addon url:', e);
            }
        }
    }, [setAddonDetailsTransportUrl]);
    const addAddonModalButtons = React.useMemo(() => {
        return [
            {
                className: styles['cancel-button'],
                label: t('BUTTON_CANCEL'),
                props: {
                    onClick: closeAddAddonModal
                }
            },
            {
                label: t('ADDON_ADD'),
                props: {
                    onClick: addAddonOnSubmit
                }
            }
        ];
    }, [addAddonOnSubmit]);
    const [search, setSearch] = React.useState('');
    const searchInputOnChange = React.useCallback((event) => {
        setSearch(event.currentTarget.value);
    }, []);
    const [sharedAddon, setSharedAddon] = React.useState(null);
    const clearSharedAddon = React.useCallback(() => {
        setSharedAddon(null);
    }, []);
    const onAddonShare = React.useCallback((event) => {
        setSharedAddon(event.dataset.addon);
    }, []);
    const onAddonInstall = React.useCallback((event) => {
        if (receivesWatchActivity(event.dataset.addon.manifest)) {
            setAddonDetailsTransportUrl(event.dataset.addon.transportUrl);
            return;
        }
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'InstallAddon',
                args: event.dataset.addon,
            }
        });
    }, [setAddonDetailsTransportUrl]);
    const onAddonUninstall = React.useCallback((event) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'UninstallAddon',
                args: event.dataset.addon,
            }
        });
    }, []);
    // transportUrl of the dragged addon and of the row currently hovered: positions are resolved at drop time
    const [dragged, setDragged] = React.useState(null);
    const [dropTransportUrl, setDropTransportUrl] = React.useState(null);
    const moveInstalledAddon = React.useCallback((transportUrl, index) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'MoveAddon',
                args: {
                    transportUrl,
                    index,
                }
            }
        });
    }, [core]);
    const onAddonMoveUp = React.useCallback((event) => {
        moveInstalledAddon(event.dataset.addon.transportUrl, event.dataset.index - 1);
    }, [moveInstalledAddon]);
    const onAddonMoveDown = React.useCallback((event) => {
        moveInstalledAddon(event.dataset.addon.transportUrl, event.dataset.index + 1);
    }, [moveInstalledAddon]);
    const onAddonDragStart = React.useCallback((event) => {
        event.reactEvent.dataTransfer.effectAllowed = 'move';
        // Firefox does not start a drag without some data; an id rather than the URL, so a drop elsewhere cannot navigate to it
        event.reactEvent.dataTransfer.setData('text/plain', event.dataset.addon.manifest.id);
        setDragged(event.dataset.addon.transportUrl);
    }, []);
    const onAddonDragOver = React.useCallback((event) => {
        if (dragged === null) {
            return;
        }
        event.reactEvent.preventDefault();
        event.reactEvent.dataTransfer.dropEffect = 'move';
        setDropTransportUrl(event.dataset.addon.transportUrl);
    }, [dragged]);
    const onAddonDrop = React.useCallback((event) => {
        event.reactEvent.preventDefault();
        if (dragged !== null) {
            // The list may have been re-synced during the drag, so both positions are looked up now
            const fromIndex = installedAddons.catalog.findIndex((addon) => addon.transportUrl === dragged);
            const toIndex = installedAddons.catalog.findIndex((addon) => addon.transportUrl === event.dataset.addon.transportUrl);
            if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                moveInstalledAddon(dragged, toIndex);
            }
        }
        setDragged(null);
        setDropTransportUrl(null);
    }, [dragged, installedAddons.catalog, moveInstalledAddon]);
    const onAddonDragEnd = React.useCallback(() => {
        setDragged(null);
        setDropTransportUrl(null);
    }, []);
    const onAddonConfigure = React.useCallback((event) => {
        platform.openExternal(event.dataset.addon.transportUrl.replace('manifest.json', 'configure'));
    }, []);
    const onAddonOpen = React.useCallback((event) => {
        setAddonDetailsTransportUrl(event.dataset.addon.transportUrl);
    }, [setAddonDetailsTransportUrl]);
    const closeAddonDetails = React.useCallback(() => {
        setAddonDetailsTransportUrl(null);
    }, [setAddonDetailsTransportUrl]);
    const searchFilterPredicate = React.useCallback((addon) => {
        return search.length === 0 ||
            (
                (typeof addon.manifest.name === 'string' && addon.manifest.name.toLowerCase().includes(search.toLowerCase())) ||
                (typeof addon.manifest.description === 'string' && addon.manifest.description.toLowerCase().includes(search.toLowerCase()))
            );
    }, [search]);
    const renderLogoFallback = React.useCallback(() => (
        <Icon className={styles['icon']} name={'addons'} />
    ), []);
    React.useLayoutEffect(() => {
        closeAddAddonModal();
        setSearch('');
        clearSharedAddon();
    }, [urlParams, queryParams]);
    // Reordering is only offered on the full installed list: with a type filter or a search,
    // the rendered indices are not the positions in profile.addons. It is also off while the
    // addons are locked (the API addons could not be fetched, so the core refuses the move).
    const reorderable = installedAddons.selected !== null && installedAddons.selected.request.type === null && search.length === 0 && !profile.addonsLocked;
    return (
        <MainNavBars className={styles['addons-container']} route={'addons'}>
            <div className={styles['addons-content']}>
                <div className={styles['selectable-inputs-container']}>
                    {selectInputs.map((selectInput, index) => (
                        <MultiselectMenu
                            {...selectInput}
                            key={index}
                            className={styles['select-input-container']}
                        />
                    ))}
                    <div className={styles['spacing']} />
                    <Button className={styles['add-button-container']} title={t('ADD_ADDON')} onClick={openAddAddonModal}>
                        <Icon className={styles['icon']} name={'add'} />
                        <div className={styles['add-button-label']}>{t('ADD_ADDON')}</div>
                    </Button>
                    <SearchBar
                        className={styles['search-bar']}
                        title={t('ADDON_SEARCH')}
                        value={search}
                        onChange={searchInputOnChange}
                    />
                    <Button className={styles['filter-button']} title={t('ALL_FILTERS')} onClick={openFiltersModal}>
                        <Icon className={styles['filter-icon']} name={'filters'} />
                    </Button>
                </div>
                {
                    installedAddons.selected !== null ?
                        installedAddons.selectable.types.length === 0 ?
                            <div className={styles['message-container']}>
                                {t('NO_ADDONS')}
                            </div>
                            :
                            installedAddons.catalog.length === 0 ?
                                <div className={styles['message-container']}>
                                    {t('NO_ADDONS_FOR_TYPE')}
                                </div>
                                :
                                <div className={styles['addons-list-container']}>
                                    {
                                        installedAddons.catalog
                                            .filter(searchFilterPredicate)
                                            .map((addon, index) => (
                                                <Addon
                                                    key={index}
                                                    className={classnames(styles['addon'], 'animation-fade-in')}
                                                    id={addon.manifest.id}
                                                    name={addon.manifest.name}
                                                    version={addon.manifest.version}
                                                    logo={addon.manifest.logo}
                                                    description={addon.manifest.description}
                                                    types={addon.manifest.types}
                                                    behaviorHints={addon.manifest.behaviorHints}
                                                    installed={addon.installed}
                                                    reorderable={reorderable}
                                                    canMoveUp={index > 0}
                                                    canMoveDown={index < installedAddons.catalog.length - 1}
                                                    dragging={dragged === addon.transportUrl}
                                                    dropTarget={dragged !== null && dragged !== addon.transportUrl && dropTransportUrl === addon.transportUrl}
                                                    onInstall={onAddonInstall}
                                                    onUninstall={onAddonUninstall}
                                                    onConfigure={onAddonConfigure}
                                                    onOpen={onAddonOpen}
                                                    onShare={onAddonShare}
                                                    onMoveUp={onAddonMoveUp}
                                                    onMoveDown={onAddonMoveDown}
                                                    onDragStart={onAddonDragStart}
                                                    onDragOver={onAddonDragOver}
                                                    onDrop={onAddonDrop}
                                                    onDragEnd={onAddonDragEnd}
                                                    dataset={{ addon, index }}
                                                />
                                            ))
                                    }
                                </div>
                        :
                        remoteAddons.selected !== null ?
                            remoteAddons.catalog.content.type === 'Err' ?
                                <div className={styles['message-container']}>
                                    {remoteAddons.catalog.content.content}
                                </div>
                                :
                                remoteAddons.catalog.content.type === 'Loading' ?
                                    <div className={styles['addons-list-container']}>
                                        {Array.from({ length: 6 }).map((_, index) => (
                                            <AddonPlaceholder key={index} className={styles['addon']} />
                                        ))}
                                    </div>
                                    :
                                    <div className={styles['addons-list-container']}>
                                        {
                                            remoteAddons.catalog.content.content
                                                .filter(searchFilterPredicate)
                                                .map((addon, index) => (
                                                    <Addon
                                                        key={index}
                                                        className={classnames(styles['addon'], 'animation-fade-in')}
                                                        id={addon.manifest.id}
                                                        name={addon.manifest.name}
                                                        version={addon.manifest.version}
                                                        logo={addon.manifest.logo}
                                                        description={addon.manifest.description}
                                                        types={addon.manifest.types}
                                                        behaviorHints={addon.manifest.behaviorHints}
                                                        installed={addon.installed}
                                                        onInstall={onAddonInstall}
                                                        onUninstall={onAddonUninstall}
                                                        onConfigure={onAddonConfigure}
                                                        onOpen={onAddonOpen}
                                                        onShare={onAddonShare}
                                                        dataset={{ addon }}
                                                    />
                                                ))
                                        }
                                    </div>
                            :
                            <div className={styles['addons-list-container']}>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <AddonPlaceholder key={index} className={styles['addon']} />
                                ))}
                            </div>
                }
            </div>
            {
                filtersModalOpen ?
                    <ModalDialog title={t('ADDONS_FILTERS')} className={styles['filters-modal']} onCloseRequest={closeFiltersModal}>
                        {selectInputs.map((selectInput, index) => (
                            <MultiselectMenu
                                {...selectInput}
                                key={index}
                                className={styles['select-input-container']}
                            />
                        ))}
                    </ModalDialog>
                    :
                    null
            }
            {
                addAddonModalOpen ?
                    <ModalDialog
                        className={styles['add-addon-modal-container']}
                        title={t('ADD_ADDON')}
                        buttons={addAddonModalButtons}
                        onCloseRequest={closeAddAddonModal}>
                        <div className={styles['notice']}>{t('ADD_ADDON_DESCRIPTION')}</div>
                        <TextInput
                            ref={addAddonUrlInputRef}
                            className={styles['addon-url-input']}
                            type={'text'}
                            placeholder={t('PASTE_ADDON_URL')}
                            autoFocus={true}
                            onSubmit={addAddonOnSubmit}
                        />
                    </ModalDialog>
                    :
                    null
            }
            {
                sharedAddon !== null ?
                    <ModalDialog
                        className={styles['share-modal-container']}
                        title={t('SHARE_ADDON')}
                        onCloseRequest={clearSharedAddon}>
                        <div className={styles['title-container']}>
                            <Image
                                className={styles['logo']}
                                src={sharedAddon.manifest.logo}
                                alt={' '}
                                renderFallback={renderLogoFallback}
                            />
                            <div className={styles['name-container']}>
                                <span className={styles['name']}>{typeof sharedAddon.manifest.name === 'string' && sharedAddon.manifest.name.length > 0 ? sharedAddon.manifest.name : sharedAddon.manifest.id}</span>
                                {
                                    typeof sharedAddon.manifest.version === 'string' && sharedAddon.manifest.version.length > 0 ?
                                        <span className={styles['version']}>{t('ADDON_VERSION_SHORT', { version: sharedAddon.manifest.version })}</span>
                                        :
                                        null
                                }
                            </div>
                        </div>
                        <SharePrompt
                            className={styles['share-prompt-container']}
                            url={sharedAddon.transportUrl}
                        />
                    </ModalDialog>
                    :
                    null
            }
            {
                typeof addonDetailsTransportUrl === 'string' ?
                    <AddonDetailsModal
                        transportUrl={addonDetailsTransportUrl}
                        onCloseRequest={closeAddonDetails}
                    />
                    :
                    null
            }
        </MainNavBars>
    );
};

const AddonsFallback = () => (
    <MainNavBars className={styles['addons-container']} route={'addons'} />
);

module.exports = withCoreSuspender(Addons, AddonsFallback);
