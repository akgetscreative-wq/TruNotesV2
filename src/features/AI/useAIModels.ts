import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import AIBridge from './AIBridge';

export interface Model {
    id: string;
    name: string;
    description: string;
    size: string;
    status: 'idle' | 'downloading' | 'downloaded' | 'loading' | 'loaded';
    progress?: number;
    url?: string;
    actualPath?: string;
    downloadId?: number;
}

const DEFAULT_MODELS: Model[] = [
    { id: 'qwen-2.5-0.5b', name: 'Qwen 2.5 0.5B', description: 'Tiny but incredibly smart', size: '0.4 GB', status: 'idle', url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf' },
    { id: 'qwen-2.5-1.5b', name: 'Qwen 2.5 1.5B', description: 'Exceptional 1.5B all-rounder', size: '1.2 GB', status: 'idle', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' },
    { id: 'qwen-2.5-3b', name: 'Qwen 2.5 3B', description: 'Powerful 3B reasoning model', size: '1.9 GB', status: 'idle', url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf' },
];

export const useAIModels = (setError: (err: string | null) => void) => {
    const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
    const [loadedModel, setLoadedModel] = useState<string | null>(null);
    const [isDetecting, setIsDetecting] = useState(true);
    const [lastLoadedModelPath, setLastLoadedModelPath] = useState<string | null>(null);

    // Save models to Preferences
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
            // 1. Get last model path from bridge
            const last = await AIBridge.getLastModelPath();
            if (last.path) setLastLoadedModelPath(last.path);

            // 2. Load from Preferences first
            const saved = await Preferences.get({ key: 'ai_models_state' });
            let currentModels = DEFAULT_MODELS;
            if (saved.value) {
                try {
                    const parsed = JSON.parse(saved.value);
                    currentModels = DEFAULT_MODELS.map(def => {
                        const s = parsed.find((p: any) => p.id === def.id);
                        return s ? { ...def, ...s } : def;
                    });
                } catch (e) { }
            }

            // 3. Perform deep verification on filesystem
            const refreshed = await Promise.all(currentModels.map(async (m) => {
                try {
                    const info = await AIBridge.getModelPath({ filename: `${m.id}.gguf` });
                    if (info.exists) {
                        return { ...m, status: 'downloaded' as const, actualPath: info.path, progress: 1 };
                    } else if (m.status === 'downloaded' || m.status === 'loaded') {
                        return { ...m, status: 'idle' as const, progress: 0 };
                    }
                } catch (e) { }
                return m;
            }));

            setModels(refreshed);
        } finally {
            setIsDetecting(false);
        }
    };

    // Initial load and existence check
    useEffect(() => {
        refreshModels();
    }, []);

    // Model Status Listener
    useEffect(() => {
        const statusListener = AIBridge.addListener('modelStatus', (data: { status: string, path?: string, message?: string }) => {
            if (data.status === 'loaded') {
                setModels(prev => prev.map(m => (data.path?.includes(m.id) || (m.status === 'loading')) ? { ...m, status: 'loaded', progress: 1, actualPath: data.path } : { ...m, status: m.status === 'loaded' ? 'downloaded' : m.status }));
                const matched = models.find(m => data.path?.includes(m.id) || m.status === 'loading');
                if (matched) {
                    setLoadedModel(matched.id);
                    setLastLoadedModelPath(data.path || null);
                }
            } else if (data.status === 'error') {
                setError(data.message || "Model load error");
                setModels(prev => prev.map(m => m.status === 'loading' ? { ...m, status: 'downloaded' } : m));
            }
        });

        // Download Progress Polling
        const interval = setInterval(async () => {
            const downloadingModel = models.find(m => m.status === 'downloading');
            if (downloadingModel && downloadingModel.downloadId !== undefined) {
                try {
                    const prog = await AIBridge.getDownloadProgress({
                        downloadId: downloadingModel.downloadId,
                        filename: `${downloadingModel.id}.gguf`
                    });

                    if (prog.status === 8) { // STATUS_SUCCESSFUL
                        setModels(prev => prev.map(m => m.id === downloadingModel.id ? { ...m, status: 'downloaded', progress: 1, actualPath: prog.path } : m));
                    } else if (prog.status === 16) { // STATUS_FAILED
                        setError(`Download failed (Reason: ${prog.reason})`);
                        setModels(prev => prev.map(m => m.id === downloadingModel.id ? { ...m, status: 'idle', progress: 0 } : m));
                    } else {
                        setModels(prev => prev.map(m => m.id === downloadingModel.id ? { ...m, progress: prog.progress } : m));
                    }
                } catch (e) { }
            }
        }, 1000);

        return () => {
            statusListener.then(h => h.remove());
            clearInterval(interval);
        };
    }, [models, setError]);

    const handleLoadModel = async (model: Model, config?: any) => {
        try {
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'loading' } : m));
            await AIBridge.loadModel({
                path: model.actualPath || `${model.id}.gguf`,
                threads: config?.threads || 6,
                n_gpu_layers: config?.n_gpu_layers ?? 0,
                n_ctx: config?.n_ctx ?? 1280,
                use_mmap: config?.use_mmap !== undefined ? config.use_mmap : true
            });
        } catch (err) {
            setError("Failed to load model: " + err);
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloaded' } : m));
        }
    };

    const handleAutoLoad = async (config?: any) => {
        if (loadedModel) return; // Already loaded

        // Find if any model in our list matches the lastLoadedModelPath
        const modelToLoad = models.find(m => m.actualPath && m.actualPath === lastLoadedModelPath);
        if (modelToLoad && modelToLoad.status === 'downloaded') {
            console.log("Auto-loading last used model:", modelToLoad.name);
            handleLoadModel(modelToLoad, config);
        }
    };

    const handleDownload = async (model: Model) => {
        if (!model.url) return;
        try {
            const info = await AIBridge.getModelPath({ filename: `${model.id}.gguf` });
            if (info.exists && info.size > 10000000) {
                setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloaded', progress: 1, actualPath: info.path } : m));
                return;
            }

            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloading', progress: 0.01 } : m));
            const res = await AIBridge.downloadModel({
                url: model.url,
                filename: `${model.id}.gguf`
            });

            if (res.alreadyExists) {
                setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'downloaded', progress: 1, actualPath: res.path } : m));
            } else {
                setModels(prev => prev.map(m => m.id === model.id ? { ...m, downloadId: res.downloadId } : m));
            }
        } catch (err) {
            setError("Download failed to start: " + err);
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'idle' } : m));
        }
    };

    const handleDelete = async (model: Model) => {
        try {
            if (model.status === 'downloading' && model.downloadId !== undefined) {
                await AIBridge.deleteModel({ filename: `${model.id}.gguf`, downloadId: model.downloadId });
            } else {
                await AIBridge.deleteModel({ filename: `${model.id}.gguf` });
            }
            setModels(prev => prev.map(m => m.id === model.id ? { ...m, status: 'idle', progress: 0, actualPath: undefined, downloadId: undefined } : m));
            if (loadedModel === model.id) {
                setLoadedModel(null);
                setLastLoadedModelPath(null);
            }
        } catch (err) {
            setError("Delete failed: " + err);
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
            setError("Offload failed: " + err);
        }
    };

    return {
        models, setModels,
        loadedModel, setLoadedModel,
        isDetecting, refreshModels,
        handleLoadModel, handleAutoLoad, handleDownload, handleDelete, handleOffload
    };
};
