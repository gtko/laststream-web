// Copyright (C) 2017-2026 Smart code 203358507

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'stremio/components';
import { tvImport } from 'stremio/common/lastAddon';
import type { TvImportRequest } from 'stremio/common/lastAddon';
import { clearPlaylist, readPlaylist, writePlaylist } from './tvStorage';
import styles from './TvLive.less';

type Props = {
    onSaved: () => void,
};

type Kind = 'm3u' | 'xtream';

// Les identifiants Xtream restent dans ce formulaire et dans le stockage local : aucun message ni journal ne les contient.
const TvPlaylistForm = ({ onSaved }: Props) => {
    const { t } = useTranslation();
    const saved = readPlaylist();
    const [kind, setKind] = useState<Kind>(saved?.type ?? 'm3u');
    const [url, setUrl] = useState(saved?.type === 'm3u' ? saved.url : '');
    const [server, setServer] = useState(saved?.type === 'xtream' ? saved.server : '');
    const [username, setUsername] = useState(saved?.type === 'xtream' ? saved.username : '');
    const [password, setPassword] = useState(saved?.type === 'xtream' ? saved.password : '');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const buildRequest = (): TvImportRequest => (kind === 'xtream'
        ? { type: 'xtream', server: server.trim(), username: username.trim(), password }
        : { type: 'm3u', url: url.trim() });

    const runImport = async (request: TvImportRequest): Promise<number | null> => {
        try {
            const response = await tvImport(request);
            return response.count;
        } catch {
            return null;
        }
    };

    const onTest = async () => {
        setBusy(true);
        setMessage(t('TV_PLAYLIST_TESTING', { defaultValue: 'Test en cours…' }));
        const count = await runImport(buildRequest());
        setBusy(false);
        setMessage(count === null
            ? t('TV_PLAYLIST_REFUSED', { defaultValue: 'Playlist inaccessible ou refusée. Vérifie l’adresse et tes identifiants.' })
            : t('TV_PLAYLIST_COUNT', { defaultValue: '{{count}} chaîne(s) trouvée(s).', count }));
    };

    const onSave = async (event: React.FormEvent) => {
        event.preventDefault();
        const request = buildRequest();
        setBusy(true);
        const count = await runImport(request);
        setBusy(false);
        if (count === null) {
            setMessage(t('TV_PLAYLIST_REFUSED', { defaultValue: 'Playlist inaccessible ou refusée. Vérifie l’adresse et tes identifiants.' }));
            return;
        }
        writePlaylist(request);
        setMessage(t('TV_PLAYLIST_SAVED', { defaultValue: '{{count}} chaîne(s) enregistrée(s) dans ce navigateur.', count }));
        onSaved();
    };

    const onClear = () => {
        clearPlaylist();
        setUrl('');
        setServer('');
        setUsername('');
        setPassword('');
        setMessage(t('TV_PLAYLIST_CLEARED', { defaultValue: 'Playlist oubliée : elle est retirée de ce navigateur.' }));
        onSaved();
    };

    return (
        <form className={styles['playlist-form']} autoComplete={'off'} onSubmit={onSave}>
            <h2 className={styles['section-title']}>{t('TV_MY_PLAYLIST', { defaultValue: 'Ma playlist' })}</h2>
            <div className={styles['radios']} role={'radiogroup'} aria-label={t('TV_PLAYLIST_TYPE', { defaultValue: 'Type de playlist' })}>
                <label>
                    <input type={'radio'} name={'tv-playlist-type'} value={'m3u'} checked={kind === 'm3u'} onChange={() => setKind('m3u')} />
                    {t('TV_PLAYLIST_M3U', { defaultValue: 'Lien M3U' })}
                </label>
                <label>
                    <input type={'radio'} name={'tv-playlist-type'} value={'xtream'} checked={kind === 'xtream'} onChange={() => setKind('xtream')} />
                    {t('TV_PLAYLIST_XTREAM', { defaultValue: 'Xtream Codes' })}
                </label>
            </div>
            {
                kind === 'm3u' ?
                    <label className={styles['field']}>
                        <span>{t('TV_PLAYLIST_URL', { defaultValue: 'URL de la playlist M3U' })}</span>
                        <input type={'url'} name={'url'} value={url} placeholder={'https://exemple.fr/playlist.m3u'} onChange={(event) => setUrl(event.target.value)} />
                    </label>
                    :
                    <React.Fragment>
                        <label className={styles['field']}>
                            <span>{t('TV_XTREAM_SERVER', { defaultValue: 'Serveur' })}</span>
                            <input type={'text'} name={'server'} value={server} placeholder={'http://serveur:8080'} onChange={(event) => setServer(event.target.value)} />
                        </label>
                        <label className={styles['field']}>
                            <span>{t('TV_XTREAM_USERNAME', { defaultValue: 'Identifiant' })}</span>
                            <input type={'text'} name={'username'} value={username} onChange={(event) => setUsername(event.target.value)} />
                        </label>
                        <label className={styles['field']}>
                            <span>{t('TV_XTREAM_PASSWORD', { defaultValue: 'Mot de passe' })}</span>
                            <input type={'password'} name={'password'} value={password} onChange={(event) => setPassword(event.target.value)} />
                        </label>
                    </React.Fragment>
            }
            <div className={styles['form-actions']}>
                <Button className={styles['form-button']} onClick={onTest}>
                    {t('TV_PLAYLIST_TEST', { defaultValue: 'Tester' })}
                </Button>
                <button type={'submit'} className={styles['form-button-primary']} disabled={busy}>
                    {t('TV_PLAYLIST_SAVE', { defaultValue: 'Enregistrer et charger' })}
                </button>
                <Button className={styles['form-button']} onClick={onClear}>
                    {t('TV_PLAYLIST_CLEAR', { defaultValue: 'Oublier ma playlist' })}
                </Button>
            </div>
            <p className={styles['form-message']} role={'status'}>{message}</p>
            <p className={styles['form-note']}>
                {t('TV_PLAYLIST_NOTE', { defaultValue: 'Enregistrée uniquement dans ce navigateur. Les identifiants sont transmis à LastAddon, seulement pour lire la playlist.' })}
            </p>
        </form>
    );
};

export default TvPlaylistForm;
