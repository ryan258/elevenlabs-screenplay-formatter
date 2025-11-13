import React, { useId } from 'react';
import { CloseIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const headingId = useId();

  if (!isOpen) {
    return null;
  }

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        aria-labelledby={headingId}
    >
      <div 
        className="bg-secondary rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-accent">
          <h2 id={headingId} className="text-xl font-bold text-highlight">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 bg-accent hover:bg-highlight rounded-md transition-colors"
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>
        </header>
        <main className="flex-grow p-4 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Modal;
