import { registerPlugin } from '@capacitor/core';

export interface AIBridgePlugin {
    loadModel(options: { path: string, use_mmap?: boolean, threads?: number }): Promise<{ status: string, path: string }>;
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
    }): Promise<{ response: string }>;
    stopGenerate(): Promise<void>;
    unloadModel(): Promise<void>;
    addListener(eventName: 'token', listenerFunc: (data: { token: string }) => void): Promise<any>;
}

const AIBridge = registerPlugin<AIBridgePlugin>('AIBridge');

export default AIBridge;
