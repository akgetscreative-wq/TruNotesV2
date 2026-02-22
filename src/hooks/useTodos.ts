import { useState, useEffect, useCallback } from 'react';
import type { Todo } from '../types';
import { storage } from '../lib/storage';
import { format, addDays } from 'date-fns';

let globalRefreshInProgress = false;

export function useTodos() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);

    const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');
    const getTomorrowStr = () => format(addDays(new Date(), 1), 'yyyy-MM-dd');

    const refreshTodos = useCallback(async () => {
        if (globalRefreshInProgress) return;
        setLoading(true);
        globalRefreshInProgress = true;
        try {
            const allTodos = await storage.getAllTodos();

            // --- Auto-generate Daily Tasks ---
            const dailyTemplates = allTodos.filter(t => t.targetDate === 'daily' && !t.deleted);
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const newDailyTodos: Todo[] = [];

            for (const template of dailyTemplates) {
                // Check if we already generated a task for this daily template today
                // Also check if we just generated it in this loop (to avoid duplicates from templates)
                const alreadyGenerated = allTodos.some(t => t.dailyParentId === template.id && t.targetDate === todayStr && !t.deleted) ||
                    newDailyTodos.some(t => t.dailyParentId === template.id);

                if (!alreadyGenerated) {
                    const newDailyTodo: Todo = {
                        id: crypto.randomUUID(),
                        text: template.text,
                        completed: false,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        targetDate: todayStr, // Lock it to today
                        dailyParentId: template.id // Link to original template
                    };
                    newDailyTodos.push(newDailyTodo);
                }
            }

            if (newDailyTodos.length > 0) {
                await storage.saveTodos(newDailyTodos);
                allTodos.push(...newDailyTodos);
            }

            setTodos(allTodos.sort((a, b) => {
                if (a.completed === b.completed) return b.createdAt - a.createdAt;
                return a.completed ? 1 : -1;
            }));
        } catch (err) {
            console.error('Failed to load todos:', err);
        } finally {
            setLoading(false);
            globalRefreshInProgress = false;
        }
    }, []);

    useEffect(() => {
        refreshTodos();
        // Subscribe to changes (Sync merges, etc)
        const unsubscribe = storage.onDataChange(() => {
            console.log("useTodos: Data change detected, refreshing...");
            refreshTodos();
        });
        return unsubscribe;
    }, [refreshTodos]);

    const addTodo = async (text: string, targetDate: string) => {
        const newTodo: Todo = {
            id: crypto.randomUUID(),
            text: text.trim(),
            completed: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            targetDate
        };
        await storage.saveTodo(newTodo);
        await refreshTodos();
    };

    const toggleTodo = async (todo: Todo) => {
        const updated: Todo = { ...todo, completed: !todo.completed, updatedAt: Date.now() };
        await storage.saveTodo(updated);
        await refreshTodos();
    };

    const deleteTodo = async (id: string) => {
        await storage.deleteTodo(id);
        await refreshTodos();
    };

    const deleteDateHistory = async (dateStr: string) => {
        await storage.deleteTodosByDate(dateStr);
        await refreshTodos();
    };

    const getTodosByDate = (dateStr: string) => {
        return todos.filter(t => t.targetDate === dateStr);
    };

    return {
        todos,
        loading,
        addTodo,
        toggleTodo,
        deleteTodo,
        deleteDateHistory,
        getTodosByDate,
        getTodayStr,
        getTomorrowStr,
        refreshTodos
    };
}
