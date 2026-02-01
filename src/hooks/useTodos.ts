import { useState, useEffect, useCallback } from 'react';
import type { Todo } from '../types';
import { storage } from '../lib/storage';
import { format, addDays } from 'date-fns';

export function useTodos() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState(true);

    const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');
    const getTomorrowStr = () => format(addDays(new Date(), 1), 'yyyy-MM-dd');

    const refreshTodos = useCallback(async () => {
        setLoading(true);
        try {
            const allTodos = await storage.getAllTodos();

            // Check for outdated todos (migration/archive logic)
            // If a todo's targetDate is in the past AND it wasn't marked as 'archived' 
            // (In this simple version, we just display them by date).

            setTodos(allTodos.sort((a, b) => {
                if (a.completed === b.completed) return b.createdAt - a.createdAt;
                return a.completed ? 1 : -1;
            }));
        } catch (err) {
            console.error('Failed to load todos:', err);
        } finally {
            setLoading(false);
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

    const getTodosByDate = (dateStr: string) => {
        return todos.filter(t => t.targetDate === dateStr);
    };

    return {
        todos,
        loading,
        addTodo,
        toggleTodo,
        deleteTodo,
        getTodosByDate,
        getTodayStr,
        getTomorrowStr,
        refreshTodos
    };
}
