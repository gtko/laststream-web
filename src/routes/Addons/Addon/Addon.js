// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { useTranslation } = require('react-i18next');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button, Image } = require('stremio/components');
const styles = require('./styles');

const Addon = ({ className, id, name, version, logo, description, types, behaviorHints, installed, reorderable, canMoveUp, canMoveDown, dragging, dropTarget, onInstall, onUninstall, onConfigure, onOpen, onShare, onMoveUp, onMoveDown, onDragStart, onDragOver, onDrop, onDragEnd, dataset }) => {
    const { t } = useTranslation();
    const onInstallClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onInstall === 'function') {
            onInstall({
                type: 'install',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onInstall, dataset]);
    const onUninstallClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onUninstall === 'function') {
            onUninstall({
                type: 'uninstall',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onUninstall, dataset]);
    const onOpenClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onOpen === 'function') {
            onOpen({
                type: 'open',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onOpen, dataset]);
    const configureButtonOnClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onConfigure === 'function') {
            onConfigure({
                type: 'configure',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onConfigure, dataset]);
    const shareButtonOnClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onShare === 'function') {
            onShare({
                type: 'share',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onShare, dataset]);
    const onKeyDown = React.useCallback((event) => {
        if (event.key === 'Enter') {
            onOpenClick(event);
        }
    }, [onOpenClick]);
    const onMoveUpClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onMoveUp === 'function') {
            onMoveUp({
                type: 'moveUp',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onMoveUp, dataset]);
    const onMoveDownClick = React.useCallback((event) => {
        event.stopPropagation();
        if (typeof onMoveDown === 'function') {
            onMoveDown({
                type: 'moveDown',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onMoveDown, dataset]);
    const onReorderKeyDown = React.useCallback((event) => {
        // Enter on a move button must not open the addon details through the row
        if (event.key === 'Enter') {
            event.stopPropagation();
        }
    }, []);
    const onReorderMouseDownCapture = React.useCallback((event) => {
        // The row Button cancels the default of mousedown, which would stop the drag handle from starting a drag
        event.nativeEvent.buttonBlurPrevented = true;
    }, []);
    const onRowDragStart = React.useCallback((event) => {
        // FileDrop cancels every dragstart reaching window, which would cancel the row drag
        event.stopPropagation();
        if (typeof onDragStart === 'function') {
            onDragStart({
                type: 'dragstart',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onDragStart, dataset]);
    const onRowDragOver = React.useCallback((event) => {
        if (typeof onDragOver === 'function') {
            onDragOver({
                type: 'dragover',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onDragOver, dataset]);
    const onRowDrop = React.useCallback((event) => {
        if (typeof onDrop === 'function') {
            onDrop({
                type: 'drop',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onDrop, dataset]);
    const onRowDragEnd = React.useCallback((event) => {
        if (typeof onDragEnd === 'function') {
            onDragEnd({
                type: 'dragend',
                nativeEvent: event.nativeEvent,
                reactEvent: event,
                dataset: dataset
            });
        }
    }, [onDragEnd, dataset]);
    const renderLogoFallback = React.useCallback(() => (
        <Icon className={styles['icon']} name={'addons'} />
    ), []);
    return (
        <Button
            className={classnames(className, styles['addon-container'], { [styles['dragging']]: dragging, [styles['drop-target']]: dropTarget })}
            draggable={reorderable === true}
            onKeyDown={onKeyDown}
            onClick={onOpenClick}
            onDragStart={onRowDragStart}
            onDragOver={onRowDragOver}
            onDrop={onRowDrop}
            onDragEnd={onRowDragEnd}
        >
            {
                reorderable === true ?
                    <div className={styles['reorder-container']} onKeyDown={onReorderKeyDown} onMouseDownCapture={onReorderMouseDownCapture}>
                        <button
                            type={'button'}
                            className={styles['move-button']}
                            title={t('ADDON_MOVE_UP', { defaultValue: 'Move up' })}
                            aria-label={t('ADDON_MOVE_UP', { defaultValue: 'Move up' })}
                            disabled={!canMoveUp}
                            onClick={onMoveUpClick}
                        >
                            <Icon className={styles['icon']} name={'chevron-up'} />
                        </button>
                        <div className={styles['drag-handle']} title={t('ADDON_DRAG_TO_REORDER', { defaultValue: 'Drag to reorder' })} aria-hidden={true}>
                            <Icon className={styles['icon']} name={'drag-handle'} />
                        </div>
                        <button
                            type={'button'}
                            className={styles['move-button']}
                            title={t('ADDON_MOVE_DOWN', { defaultValue: 'Move down' })}
                            aria-label={t('ADDON_MOVE_DOWN', { defaultValue: 'Move down' })}
                            disabled={!canMoveDown}
                            onClick={onMoveDownClick}
                        >
                            <Icon className={styles['icon']} name={'chevron-down'} />
                        </button>
                    </div>
                    :
                    null
            }
            <div className={styles['logo-container']}>
                <Image
                    className={styles['logo']}
                    src={logo}
                    alt={' '}
                    renderFallback={renderLogoFallback}
                />
            </div>
            <div className={styles['info-container']}>
                <div className={styles['name-container']} title={typeof name === 'string' && name.length > 0 ? name : id}>
                    {typeof name === 'string' && name.length > 0 ? name : id}
                </div>
                {
                    typeof version === 'string' && version.length > 0 ?
                        <div className={styles['version-container']} title={t('ADDON_VERSION_SHORT', {version})}>{t('ADDON_VERSION_SHORT', {version})}</div>
                        :
                        null
                }
                {
                    Array.isArray(types) && types.length > 0 ?
                        <div className={styles['types-container']}>
                            {
                                types.length === 1 ?
                                    types.join('')
                                    :
                                    types.slice(0, -1).join(', ') + ' & ' + types[types.length - 1]
                            }
                        </div>
                        :
                        null
                }
                {
                    typeof description === 'string' && description.length > 0 ?
                        <div className={styles['description-container']} title={description}>{description}</div>
                        :
                        null
                }
            </div>
            <div className={styles['buttons-container']}>
                <div className={styles['action-buttons-container']}>
                    {
                        !behaviorHints.configurationRequired && behaviorHints.configurable ?
                            <Button className={styles['configure-button-container']} title={t('ADDON_CONFIGURE')} tabIndex={-1} onClick={configureButtonOnClick}>
                                <Icon className={styles['icon']} name={'settings'} />
                            </Button>
                            :
                            null
                    }
                    <Button
                        className={installed ? styles['uninstall-button-container'] : styles['install-button-container']}
                        title={installed ? t('ADDON_UNINSTALL') : behaviorHints.configurationRequired ? t('ADDON_CONFIGURE') : t('ADDON_INSTALL')}
                        tabIndex={-1}
                        onClick={installed ? onUninstallClick : behaviorHints.configurationRequired ? configureButtonOnClick : onInstallClick}
                    >
                        <div className={styles['label']}>{installed ? t('ADDON_UNINSTALL') : behaviorHints.configurationRequired ? t('ADDON_CONFIGURE') : t('ADDON_INSTALL')}</div>
                    </Button>
                </div>
                <Button className={styles['share-button-container']} title={t('SHARE_ADDON')} tabIndex={-1} onClick={shareButtonOnClick}>
                    <Icon className={styles['icon']} name={'share'} />
                    <div className={styles['label']}>{ t('SHARE_ADDON') }</div>
                </Button>
            </div>
        </Button>
    );
};

Addon.propTypes = {
    className: PropTypes.string,
    id: PropTypes.string,
    name: PropTypes.string,
    version: PropTypes.string,
    logo: PropTypes.string,
    description: PropTypes.string,
    types: PropTypes.arrayOf(PropTypes.string),
    behaviorHints: PropTypes.shape({
        adult: PropTypes.bool,
        configurable: PropTypes.bool,
        configurationRequired: PropTypes.bool,
        p2p: PropTypes.bool,
    }),
    installed: PropTypes.bool,
    reorderable: PropTypes.bool,
    canMoveUp: PropTypes.bool,
    canMoveDown: PropTypes.bool,
    dragging: PropTypes.bool,
    dropTarget: PropTypes.bool,
    onToggle: PropTypes.func,
    onInstall: PropTypes.func,
    onUninstall: PropTypes.func,
    onConfigure: PropTypes.func,
    onOpen: PropTypes.func,
    onShare: PropTypes.func,
    onMoveUp: PropTypes.func,
    onMoveDown: PropTypes.func,
    onDragStart: PropTypes.func,
    onDragOver: PropTypes.func,
    onDrop: PropTypes.func,
    onDragEnd: PropTypes.func,
    dataset: PropTypes.object
};

module.exports = Addon;
