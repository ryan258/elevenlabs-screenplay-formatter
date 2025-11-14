import React from 'react';
import useAppStore from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

const toneClasses: Record<'info' | 'success' | 'error', string> = {
  info: 'border-blue-400',
  success: 'border-green-400',
  error: 'border-red-400'
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useAppStore(useShallow(state => ({
    toasts: state.toasts,
    removeToast: state.removeToast
  })));

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`bg-secondary border ${toneClasses[toast.tone]} rounded-md shadow-lg px-4 py-2 text-sm text-text-primary min-w-[220px] max-w-xs`}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => removeToast(toast.id)}
              className="text-text-secondary hover:text-text-primary"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
