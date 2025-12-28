/**
 * Toast notification system
 * Usage: toast.success('message') / toast.error('message') / toast.warning('message')
 */
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
    id: number;
    type: ToastType;
    message: string;
    duration: number;
}

interface ToastContextType {
    addToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, type, message, duration }]);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts, onRemove }: { toasts: ToastMessage[], onRemove: (id: number) => void }) {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage, onRemove: (id: number) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), toast.duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const bgColor = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        warning: 'bg-yellow-600',
        info: 'bg-blue-600'
    }[toast.type];

    const icon = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    }[toast.type];

    return (
        <div
            className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] animate-slide-in`}
            onClick={() => onRemove(toast.id)}
        >
            <span className="text-lg">{icon}</span>
            <span className="flex-1">{toast.message}</span>
            <button className="text-white/70 hover:text-white">×</button>
        </div>
    );
}

// Hook for using toasts
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

// Convenience object for imperative calls
class ToastHelper {
    private addToastFn: ((type: ToastType, message: string, duration?: number) => void) | null = null;

    setHandler(fn: (type: ToastType, message: string, duration?: number) => void) {
        this.addToastFn = fn;
    }

    success(message: string, duration?: number) {
        this.addToastFn?.('success', message, duration);
    }

    error(message: string, duration?: number) {
        this.addToastFn?.('error', message, duration ?? 6000);
    }

    warning(message: string, duration?: number) {
        this.addToastFn?.('warning', message, duration);
    }

    info(message: string, duration?: number) {
        this.addToastFn?.('info', message, duration);
    }
}

export const toast = new ToastHelper();

// Connector component - place inside ToastProvider
export function ToastConnector() {
    const { addToast } = useToast();

    useEffect(() => {
        toast.setHandler(addToast);
    }, [addToast]);

    return null;
}
