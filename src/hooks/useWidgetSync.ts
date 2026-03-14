import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { storage } from '../lib/storage';
import { format } from 'date-fns';
import type { Todo } from '../types';

export function useWidgetSync() {
    useEffect(() => {
        const syncFromNative = async () => {
            try {
                const { value: needsSync } = await Preferences.get({ key: 'needs_native_sync' });
                if (needsSync === 'true') {
                    console.log("WidgetSync: Pulling changes from native widgets...");
                    const today = format(new Date(), 'yyyy-MM-dd');

                    // 1. Sync Todos
                    const { value: todosJson } = await Preferences.get({ key: 'widget_todos' });
                    if (todosJson) {
                        const nativeTodos: Todo[] = JSON.parse(todosJson);
                        // Save each (storage.saveTodo handles merging/updates)
                        for (const todo of nativeTodos) {
                            // Keep the original targetDate (usually empty for widget-added tasks)
                            await storage.saveTodo(todo);
                        }
                    }

                    // 2. Sync Hourly Log
                    const { value: hourlyJson } = await Preferences.get({ key: 'widget_hourly' });
                    const { value: widgetDate } = await Preferences.get({ key: 'widget_hourly_date' });

                    if (hourlyJson && hourlyJson !== '{}') {
                        // Only sync if the widget's stored date matches today
                        if (widgetDate === today) {
                            try {
                                const nativeLogs = JSON.parse(hourlyJson);
                                const existing = await storage.getHourlyLog(today);
                                // Merge: native updates/additions win over local if they exist
                                const mergedLogs = existing ? { ...existing.logs, ...nativeLogs } : nativeLogs;

                                console.log("WidgetSync: Merging hourly logs for today", mergedLogs);
                                await storage.saveHourlyLog(today, mergedLogs);
                            } catch (e) {
                                console.error("WidgetSync: Hourly parse error", e);
                            }
                        } else {
                            // If the date is stale OR missing, we MUST treat it as old data and clear it
                            console.warn("WidgetSync: Stale widget date detected. Clearing native storage.", widgetDate, "vs today", today);
                            await Preferences.set({ key: 'widget_hourly', value: '{}' });
                            await Preferences.set({ key: 'widget_hourly_date', value: today });
                        }
                    } else if (!widgetDate) {
                        // Ensure we at least have a date if logs are empty
                        await Preferences.set({ key: 'widget_hourly_date', value: today });
                    }

                    // Clear flag
                    await Preferences.set({ key: 'needs_native_sync', value: 'false' });

                    // Force all hooks to refresh with the new data
                    storage.notifyListeners();

                    console.log("WidgetSync: Sync complete.");
                }

                // Always push the latest app data to widgets on resume
                // This ensures the widget shows up-to-date data even if needs_native_sync was false
                await storage.triggerWidgetSync();
            } catch (e) {
                console.error("WidgetSync: Sync failed", e);
            }
        };

        // Run on mount and on app resume
        syncFromNative();

        const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                syncFromNative();
            }
        });

        // ── Electron Desktop Widget Actions ──
        const electron = (window as any).electron;
        if (electron) {
            // Handle toggle-todo from widget
            electron.onWidgetToggleTodo?.(async (todoId: string) => {
                try {
                    const todos = await storage.getTodos();
                    const todo = todos.find(t => t.id === todoId);
                    if (todo) {
                        await storage.saveTodo({ ...todo, completed: !todo.completed, updatedAt: Date.now() });
                        await storage.triggerWidgetSync();
                    }
                } catch (e) {
                    console.error("WidgetSync: Toggle failed", e);
                }
            });

            // Handle add-todo from widget
            electron.onWidgetAddTodo?.(async (text: string) => {
                try {
                    const today = format(new Date(), 'yyyy-MM-dd');
                    const newTodo: Todo = {
                        id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        text,
                        completed: false,
                        targetDate: today,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };
                    await storage.saveTodo(newTodo);
                    await storage.triggerWidgetSync();
                } catch (e) {
                    console.error("WidgetSync: Add failed", e);
                }
            });
        }

        return () => {
            listener.then(h => h.remove());
        };
    }, []);
}
