import { registerPlugin } from '@capacitor/core';

export interface AIBridgePlugin {
    loadModel(options: { path: string, use_mmap?: boolean, threads?: number, n_gpu_layers?: number, n_ctx?: number }): Promise<{ status: string, path: string, cached?: boolean }>;
    downloadModel(options: { url: string, filename: string }): Promise<{ downloadId: number, path: string, alreadyExists?: boolean }>;
    getLastModelPath(): Promise<{ path: string | null }>;
    getModelPath(options: { filename: string }): Promise<{ path: string, exists: boolean, size: number }>;
    getDownloadProgress(options: { downloadId: number, filename?: string }): Promise<{ progress: number, status: number, reason?: number, path?: string }>;
    deleteModel(options: { filename: string, downloadId?: number }): Promise<{ deleted: boolean }>;
    generate(options: {
        prompt: string,
        n_predict?: number,
        threads?: number,
        temperature?: number,
        top_k?: number,
        top_p?: number,
        penalty?: number,
        stop?: string[]
    }): Promise<{ started: boolean }>;
    stopGenerate(): Promise<void>;
    unloadModel(): Promise<void>;
    embed(options: { text: string }): Promise<{ vector: number[] }>;
    pickModel(): Promise<{ name: string, path: string }>;
    addListener(eventName: 'token', listenerFunc: (data: { token: string }) => void): Promise<any>;
    addListener(eventName: 'modelStatus', listenerFunc: (data: { status: string, path?: string, message?: string }) => void): Promise<any>;
    addListener(eventName: 'done', listenerFunc: (data: { fullResponse: string }) => void): Promise<any>;
}

interface AIBridgeWithSync extends AIBridgePlugin {
    generateSync(options: any): Promise<{ response: string }>;
}

const AIBridgeBase = registerPlugin<AIBridgePlugin>('AIBridge');

const AIBridge: AIBridgeWithSync = {
    // Explicitly delegate native methods because registerPlugin returns a Proxy
    // Spreading a Proxy does NOT copy its methods
    loadModel: (options) => AIBridgeBase.loadModel(options),
    downloadModel: (options) => AIBridgeBase.downloadModel(options),
    getLastModelPath: () => AIBridgeBase.getLastModelPath(),
    getModelPath: (options) => AIBridgeBase.getModelPath(options),
    getDownloadProgress: (options) => AIBridgeBase.getDownloadProgress(options),
    deleteModel: (options) => AIBridgeBase.deleteModel(options),
    generate: (options) => AIBridgeBase.generate(options),
    stopGenerate: () => AIBridgeBase.stopGenerate(),
    unloadModel: () => AIBridgeBase.unloadModel(),
    embed: (options) => AIBridgeBase.embed(options),
    pickModel: () => AIBridgeBase.pickModel(),
    addListener: (eventName: any, listenerFunc: any) => AIBridgeBase.addListener(eventName, listenerFunc),

    /**
     * Helper to use the generator in a blocking Promise way (for one-shot tasks like Polish)
     */
    async generateSync(options: any): Promise<{ response: string }> {
        return new Promise((resolve) => {
            let doneHandle: any = null;

            AIBridgeBase.addListener('done', (data) => {
                if (doneHandle) doneHandle.remove();
                resolve({ response: data.fullResponse });
            }).then(h => doneHandle = h);

            AIBridgeBase.generate(options).catch(() => {
                if (doneHandle) doneHandle.remove();
                resolve({ response: "Error: Generation failed" });
            });
        });
    }
};

export default AIBridge;
