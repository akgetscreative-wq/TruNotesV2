import { useState, useEffect, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import AIBridge from './AIBridge';

export interface Model {
    id: string;
    name: string;
    description: string;
    size: string;
    status: 'idle' | 'downloading' | 'downloaded' | 'loading' | 'loaded' | 'failed';
    progress?: number;
    downloadStatus?: number;
    bytesDownloaded?: number;
    bytesTotal?: number;
    reason?: number;
    queuedAt?: number;
    queueAlerted?: boolean;
    queryFailures?: number;
    url?: string;
    actualPath?: string;
    downloadId?: number;
    errorMessage?: string;
}

const DEFAULT_MODELS: Model[] = [
    { id: 'qwen-2.5-0.5b', name: 'Qwen 2.5 0.5B', description: 'Tiny but incredibly smart', size: '0.4 GB', status: 'idle', url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf' },
    { id: 'qwen-2.5-1.5b', name: 'Qwen 2.5 1.5B', description: 'Exceptional 1.5B all-rounder', size: '1.2 GB', status: 'idle', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' },
    { id: 'qwen-2.5-3b', name: 'Qwen 2.5 3B', description: 'Powerful 3B reasoning model', size: '1.9 GB', status: 'idle', url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf' },
];

const DOWNLOAD_STATUS = {
    pending: 1,
    running: 2,
    paused: 4,
    successful: 8,
    failed: 16
} as const;

const PAUSED_REASONS: Record<number, string> = {
    1: 'Waiting to retry download',
    2: 'Waiting for network connection',
    3: 'Queued for Wi-Fi by system policy',
    4: 'Download paused by system'
};

const FAILED_REASONS: Record<number, string> = {
    1000: 'Unknown download error',
    1001: 'File error while writing model',
    1002: 'Unhandled HTTP issue from source server',
    1004: 'Server did not provide file',
    1005: 'Too many redirects from source',
    1006: 'Insufficient storage on device',
    1007: 'No external storage available',
    1008: 'Device storage write issue',
    1009: 'Cannot resume this download',
    1010: 'Too many redirects'
};

const SELECTED_MODEL_KEY = 'ai_selected_model_id';

const EXPECTED_MODEL_BYTES: Record<string, number> = {
    'qwen-2.5-0.5b': 400 * 1024 * 1024,
    'qwen-2.5-1.5b': 1200 * 1024 * 1024,
    'qwen-2.5-3b': 1900 * 1024 * 1024,
};

function isLikelyCompleteModel(id: string, sizeBytes: number): boolean {
    const expected = EXPECTED_MODEL_BYTES[id];
    if (!expected) return sizeBytes > 120 * 1024 * 1024;
    return sizeBytes >= Math.floor(expected * 0.82);
}

function getReasonLabel(status: number, reason?: number): string {
    if (!reason) return '';
    if (status === DOWNLOAD_STATUS.paused) return PAUSED_REASONS[reason] || `Paused (reason ${reason})`;
    if (status === DOWNLOAD_STATUS.failed) return FAILED_REASONS[reason] || `Failed (reason ${reason})`;
    return `Reason ${reason}`;
}

export const useAIModels = (setError: (err: string | null) => void) => {
    const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
    const [loadedModel, setLoadedModel] = useState<string | null>(null);
    const [isDetecting, setIsDetecting] = useState(true);
    const [lastLoadedModelPath, setLastLoadedModelPath] = useState<string | null>(null);
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const lastToastRef = useRef<{ message: string; at: number } | null>(null);

    const reportError = (message: string) => {
        setError(message);
        const now = Date.now();
        if (lastToastRef.current && lastToastRef.current.message === message && now - lastToastRef.current.at < 8000) {
            return;
        }
        lastToastRef.current = { message, at: now };
        try {
            (window as any).showToast?.(message, 'error');
        } catch {
            // non-fatal on platforms without toast bridge
        }
    };

    const reportSuccess = (message: string) => {
        try {
            (window as any).showToast?.(message, 'success');
        } catch {
            // non-fatal on platforms without toast bridge
        }
    };

    const persistSelectedModelId = async (modelId: string | null) => {
        setSelectedModelId(modelId);
        if (!modelId) {
            await Preferences.remove({ key: SELECTED_MODEL_KEY });
            return;
        }
        await Preferences.set({ key: SELECTED_MODEL_KEY, value: modelId });
    };

    useEffect(() => {
        if (!isDetecting) {
            Preferences.set({
                key: 'ai_models_state',
                value: JSON.stringify(models)
            });
        }
    }, [models, isDetecting]);

    const refreshModels = async () => {
        setIsDetecting(true);
        try {
            const last = await AIBridge.getLastModelPath();
            if (last.path) setLastLoadedModelPath(last.path);
            const selected = await Preferences.get({ key: SELECTED_MODEL_KEY });
            if (selected.value) setSelectedModelId(selected.value);

            const saved = await Preferences.get({ key: 'ai_models_state' });
            let currentModels = DEFAULT_MODELS;
            if (saved.value) {
                try {
                    const parsed = JSON.parse(saved.value);
                    currentModels = DEFAULT_MODELS.map(def => {
                        const s = parsed.find((p: any) => p.id === def.id);
                        return s ? { ...def, ...s } : def;
                    });
                } catch {
                    // ignore broken saved model state
                }
            }

            const refreshed = await Promise.all(currentModels.map(async (m) => {
                try {
                    const info = await AIBridge.getModelPath({ filename: `${m.id}.gguf` });
                    if (info.exists && isLikelyCompleteModel(m.id, info.size)) {
                        return {
                            ...m,
                            status: 'downloaded' as const,
                            actualPath: info.path,
                            progress: 1,
                            downloadStatus: DOWNLOAD_STATUS.successful,
                            bytesDownloaded: info.size,
                            bytesTotal: info.size,
                            reason: undefined,
                            queuedAt: undefined,
                            queueAlerted: false,
                            queryFailures: 0,
                            errorMessage: undefined
                        };
                    }
                    if (m.status === 'downloaded' || m.status === 'loaded' || m.status === 'failed' || info.exists) {
                        return {
                            ...m,
                            status: 'idle' as const,
                            progress: 0,
                            downloadStatus: undefined,
                            bytesDownloaded: 0,
                            bytesTotal: 0,
                            actualPath: undefined,
                            downloadId: undefined,
                            reason: undefined,
                            queuedAt: undefined,
                            queueAlerted: false,
                            queryFailures: 0,
                            errorMessage: undefined
                        };
                    }
                } catch {
                    // ignore single-model filesystem check errors
                }
                return m;
            }));

            setModels(refreshed);
        } finally {
            setIsDetecting(false);
        }
    };

    useEffect(() => {
        refreshModels();
    }, []);

    useEffect(() => {
        const statusListener = AIBridge.addListener('modelStatus', (data: { status: string, path?: string, message?: string }) => {
            if (data.status === 'loaded') {
                setModels(prev => prev.map(m => (
                    (data.path?.includes(m.id) || m.status === 'loading')
                        ? { ...m, status: 'loaded', progress: 1, actualPath: data.path, downloadStatus: DOWNLOAD_STATUS.successful, errorMessage: undefined }
                        : { ...m, status: m.status === 'loaded' ? 'downloaded' : m.status }
                )));

                const matched = models.find(m => data.path?.includes(m.id) || m.status === 'loading');
                if (matched) {
                    setLoadedModel(matched.id);
                    setLastLoadedModelPath(data.path || null);
                }
            } else if (data.status === 'error') {
                reportError(data.message || 'Model load error');
                setModels(prev => prev.map(m => m.status === 'loading' ? { ...m, status: 'downloaded' } : m));
            }
        });

        const interval = setInterval(async () => {
            const downloadingModels = models.filter(m => m.status === 'downloading' && m.downloadId !== undefined);
            for (const downloadingModel of downloadingModels) {
                try {
                    const prog = await AIBridge.getDownloadProgress({
                        downloadId: downloadingModel.downloadId!,
                        filename: `${downloadingModel.id}.gguf`
                    });

                    if (prog.status === DOWNLOAD_STATUS.successful) {
                        setModels(prev => prev.map(m => m.id === downloadingModel.id ? {
                            ...m,
                            status: 'downloaded',
                            progress: 1,
                            actualPath: prog.path,
                            downloadStatus: prog.status,
                            bytesDownloaded: prog.bytesTotal ?? prog.bytesDownloaded,
                            bytesTotal: prog.bytesTotal ?? prog.bytesDownloaded,
                            reason: prog.reason,
                            queuedAt: undefined,
                            queueAlerted: false,
                            queryFailures: 0,
                            errorMessage: undefined
                        } : m));
                        reportSuccess(`${downloadingModel.name} downloaded`);
                        continue;
                    }

                    if (prog.status === DOWNLOAD_STATUS.failed) {
                        const reasonLabel = getReasonLabel(prog.status, prog.reason);
                        const errorMessage = `Model download failed: ${reasonLabel || `Reason ${prog.reason ?? 'unknown'}`}`;
                        reportError(errorMessage);
                        setModels(prev => prev.map(m => m.id === downloadingModel.id ? {
                            ...m,
                            status: 'failed',
                            progress: 0,
                            downloadStatus: prog.status,
                            bytesDownloaded: prog.bytesDownloaded ?? 0,
                            bytesTotal: prog.bytesTotal ?? 0,
                            reason: prog.reason,
                            queuedAt: undefined,
                            queueAlerted: false,
                            queryFailures: 0,
                            errorMessage
                        } : m));
                        continue;
                    }

                    setModels(prev => prev.map(m => {
                        if (m.id !== downloadingModel.id) return m;

                        const pendingOrPaused = prog.status === DOWNLOAD_STATUS.pending || prog.status === DOWNLOAD_STATUS.paused;
                        const nextQueuedAt = pendingOrPaused ? (m.queuedAt ?? Date.now()) : undefined;
                        const isStuckQueued = !!nextQueuedAt && (Date.now() - nextQueuedAt > 20000);

                        if (isStuckQueued && !m.queueAlerted) {
                            const reasonLabel = getReasonLabel(prog.status, prog.reason);
                            reportError(`Download still queued: ${reasonLabel || 'System has not started transfer yet'}`);
                        }

                        return {
                            ...m,
                            progress: prog.progress,
                            downloadStatus: prog.status,
                            bytesDownloaded: prog.bytesDownloaded ?? 0,
                            bytesTotal: prog.bytesTotal ?? 0,
                            reason: prog.reason,
                            queuedAt: nextQueuedAt,
                            queueAlerted: isStuckQueued ? true : m.queueAlerted,
                            queryFailures: 0,
                            errorMessage: undefined
                        };
                    }));
                } catch {
                    let healed = false;
                    try {
                        const info = await AIBridge.getModelPath({ filename: `${downloadingModel.id}.gguf` });
                        if (info.exists && isLikelyCompleteModel(downloadingModel.id, info.size)) {
                            healed = true;
                            setModels(prev => prev.map(m => m.id === downloadingModel.id ? {
                                ...m,
                                status: 'downloaded',
                                progress: 1,
                                actualPath: info.path,
                                downloadStatus: DOWNLOAD_STATUS.successful,
                                bytesDownloaded: info.size,
                                bytesTotal: info.size,
                                reason: undefined,
                                queuedAt: undefined,
                                queueAlerted: false,
                                queryFailures: 0,
                                errorMessage: undefined
                            } : m));
                            reportSuccess(`${downloadingModel.name} downloaded`);
                        }
                    } catch {
                        // ignore secondary probe errors
                    }

                    if (!healed) {
                        setModels(prev => prev.map(m => {
                            if (m.id !== downloadingModel.id) return m;
                            const failures = (m.queryFailures ?? 0) + 1;
                            if (failures >= 5) {
                                reportError('Download status is temporarily unavailable. Keeping download alive and retrying.');
                            }
                            return {
                                ...m,
                                status: 'downloading',
                                downloadStatus: m.downloadStatus ?? DOWNLOAD_STATUS.pending,
                                queuedAt: m.queuedAt ?? Date.now(),
                                queryFailures: failures,
                                errorMessage: undefined
                            };
                        }));
                    }
                }
            }
        }, 1000);

        return () => {
            statusListener.then(h => h.remove());
            clearInterval(interval);
        };
    }, [models]);

    const handleLoadModel = async (model: Model, config?: any) => {
        try {
            await persistSelectedModelId(model.id);
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'loading', errorMessage: undefined } : m));
            await AIBridge.loadModel({
                path: model.actualPath || `${model.id}.gguf`,
                threads: config?.threads || 6,
                n_gpu_layers: config?.n_gpu_layers ?? 0,
                n_ctx: config?.n_ctx ?? 1280,
                use_mmap: config?.use_mmap !== undefined ? config.use_mmap : true
            });
        } catch (err) {
            reportError('Failed to load model: ' + err);
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloaded' } : m));
        }
    };

    const handleAutoLoad = async (config?: any) => {
        if (loadedModel) return;

        const selectedDownloaded = selectedModelId
            ? models.find(m => m.id === selectedModelId && m.status === 'downloaded')
            : undefined;
        if (selectedDownloaded) {
            console.log('Auto-loading selected model:', selectedDownloaded.name);
            await handleLoadModel(selectedDownloaded, config);
            return;
        }

        const modelToLoad = models.find(m => m.actualPath && m.actualPath === lastLoadedModelPath);
        if (modelToLoad && modelToLoad.status === 'downloaded') {
            console.log('Auto-loading last used model:', modelToLoad.name);
            await handleLoadModel(modelToLoad, config);
        }
    };

    const handleDownload = async (model: Model) => {
        if (!model.url) return;
        try {
            const otherActive = models.filter(m => m.id !== model.id && m.status === 'downloading');
            for (const active of otherActive) {
                try {
                    await AIBridge.deleteModel({ filename: `${active.id}.gguf`, downloadId: active.downloadId });
                } catch {
                    // keep going; we still want selected model download to start
                }
            }
            if (otherActive.length > 0) {
                setModels(prev => prev.map(m => {
                    if (!otherActive.find(a => a.id === m.id)) return m;
                    return {
                        ...m,
                        status: 'idle',
                        progress: 0,
                        actualPath: undefined,
                        downloadId: undefined,
                        downloadStatus: undefined,
                        bytesDownloaded: 0,
                        bytesTotal: 0,
                        reason: undefined,
                        queuedAt: undefined,
                        queueAlerted: false,
                        queryFailures: 0,
                        errorMessage: undefined
                    };
                }));
            }

            const info = await AIBridge.getModelPath({ filename: `${model.id}.gguf` });
            if (info.exists && isLikelyCompleteModel(model.id, info.size)) {
                setModels(prev => prev.map(m => m.id === model.id ? {
                    ...m,
                    status: 'downloaded',
                    progress: 1,
                    actualPath: info.path,
                    downloadStatus: DOWNLOAD_STATUS.successful,
                    bytesDownloaded: info.size,
                    bytesTotal: info.size,
                    reason: undefined,
                    queuedAt: undefined,
                    queueAlerted: false,
                    queryFailures: 0,
                    errorMessage: undefined
                } : m));
                reportSuccess(`${model.name} already downloaded`);
                return;
            }

            setModels(prev => prev.map(m => m.id === model.id ? {
                ...m,
                status: 'downloading',
                progress: 0,
                downloadStatus: DOWNLOAD_STATUS.pending,
                bytesDownloaded: 0,
                bytesTotal: 0,
                reason: undefined,
                queuedAt: Date.now(),
                queueAlerted: false,
                queryFailures: 0,
                errorMessage: undefined
            } : m));

            const res = await AIBridge.downloadModel({
                url: model.url,
                filename: `${model.id}.gguf`
            });

            if (res.alreadyExists) {
                await persistSelectedModelId(model.id);
                setModels(prev => prev.map(m => m.id === model.id ? {
                    ...m,
                    status: 'downloaded',
                    progress: 1,
                    actualPath: res.path,
                    downloadStatus: DOWNLOAD_STATUS.successful,
                    queuedAt: undefined,
                    queueAlerted: false,
                    queryFailures: 0,
                    errorMessage: undefined
                } : m));
                reportSuccess(`${model.name} downloaded`);
            } else {
                setModels(prev => prev.map(m => m.id === model.id ? {
                    ...m,
                    downloadId: res.downloadId,
                    progress: 0,
                    downloadStatus: DOWNLOAD_STATUS.pending,
                    bytesDownloaded: 0,
                    bytesTotal: 0,
                    queuedAt: Date.now(),
                    queueAlerted: false,
                    queryFailures: 0,
                    errorMessage: undefined
                } : m));
            }
        } catch (err) {
            reportError('Download failed to start: ' + err);
            setModels(prev => prev.map(m => m.id === model.id ? {
                ...m,
                status: 'failed',
                progress: 0,
                downloadStatus: DOWNLOAD_STATUS.failed,
                bytesDownloaded: 0,
                bytesTotal: 0,
                reason: undefined,
                queuedAt: undefined,
                queueAlerted: false,
                queryFailures: 0,
                errorMessage: String(err)
            } : m));
        }
    };

    const handleCancelDownload = async (model: Model) => {
        if (model.status !== 'downloading') return;
        try {
            await AIBridge.deleteModel({ filename: `${model.id}.gguf`, downloadId: model.downloadId });
            setModels(prev => prev.map(m => m.id === model.id ? {
                ...m,
                status: 'idle',
                progress: 0,
                actualPath: undefined,
                downloadId: undefined,
                downloadStatus: undefined,
                bytesDownloaded: 0,
                bytesTotal: 0,
                reason: undefined,
                queuedAt: undefined,
                queueAlerted: false,
                queryFailures: 0,
                errorMessage: undefined
            } : m));
            reportSuccess(`Cancelled ${model.name} download`);
        } catch (err) {
            reportError('Cancel failed: ' + err);
        }
    };

    const handleDelete = async (model: Model) => {
        try {
            if (model.status === 'downloading' && model.downloadId !== undefined) {
                await AIBridge.deleteModel({ filename: `${model.id}.gguf`, downloadId: model.downloadId });
            } else {
                await AIBridge.deleteModel({ filename: `${model.id}.gguf` });
            }
            setModels(prev => prev.map(m => m.id === model.id ? {
                ...m,
                status: 'idle',
                progress: 0,
                actualPath: undefined,
                downloadId: undefined,
                downloadStatus: undefined,
                bytesDownloaded: 0,
                bytesTotal: 0,
                reason: undefined,
                queuedAt: undefined,
                queueAlerted: false,
                queryFailures: 0,
                errorMessage: undefined
            } : m));
            if (loadedModel === model.id) {
                setLoadedModel(null);
                setLastLoadedModelPath(null);
            }
            if (selectedModelId === model.id) {
                await persistSelectedModelId(null);
            }
        } catch (err) {
            reportError('Delete failed: ' + err);
        }
    };

    const handleOffload = async () => {
        try {
            await AIBridge.stopGenerate();
            await AIBridge.unloadModel();
            setModels(prev => prev.map(m => m.status === 'loaded' ? { ...m, status: 'downloaded' } : m));
            setLoadedModel(null);
            setLastLoadedModelPath(null);
        } catch (err) {
            reportError('Offload failed: ' + err);
        }
    };

    return {
        models, setModels,
        loadedModel, setLoadedModel,
        isDetecting, refreshModels,
        handleLoadModel, handleAutoLoad, handleDownload, handleCancelDownload, handleDelete, handleOffload
    };
};
