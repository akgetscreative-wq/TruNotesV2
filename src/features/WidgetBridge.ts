import { registerPlugin } from '@capacitor/core';

interface WidgetBridgePlugin {
    refreshWidgets(): Promise<{ refreshed: boolean; todoWidgets: number; hourlyWidgets: number }>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export { WidgetBridge };
export type { WidgetBridgePlugin };
