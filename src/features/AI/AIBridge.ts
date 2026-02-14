import { registerPlugin } from '@capacitor/core';

export interface AIBridgePlugin {
    loadModel(options: { path: string, use_mmap?: boolean, threads?: number }): Promise<{ status: string, path: string, cached?: boolean }>;
    downloadModel(options: { url: string, filename: string }): Promise<{ downloadId: number, path: string }>;
    getLastModelPath(): Promise<{ path: string | null }>;
    getModelPath(options: { filename: string }): Promise<{ path: string, exists: boolean, size: number }>;
    getDownloadProgress(options: { downloadId: number }): Promise<{ progress: number, status: number, reason?: number, path?: string }>;
    deleteModel(options: { filename: string, downloadId?: number }): Promise<{ deleted: boolean }>;
    generate(options: {
        prompt: string,
        n_predict?: number,
        temperature?: number,
        top_k?: number,
        top_p?: number,
        penalty?: number
    }): Promise<{ started: boolean }>;
    stopGenerate(): Promise<void>;
    unloadModel(): Promise<void>;
    addListener(eventName: 'token', listenerFunc: (data: { token: string }) => void): Promise<any>;
    addListener(eventName: 'modelStatus', listenerFunc: (data: { status: string, path?: string, message?: string }) => void): Promise<any>;
    addListener(eventName: 'done', listenerFunc: (data: { fullResponse: string }) => void): Promise<any>;
}

const AIBridgeBase = registerPlugin<AIBridgePlugin>('AIBridge');

const AIBridge = {
    ...AIBridgeBase,

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
