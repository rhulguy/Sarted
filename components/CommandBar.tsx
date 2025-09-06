import React, { useState, useEffect, useRef } from 'react';
import { useInbox } from '../contexts/InboxContext';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandBar: React.FC<CommandBarProps> = ({ isOpen, onClose }) => {
  const { addTask } = useInbox();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const taskName = inputValue.trim();
    if (taskName) {
      addTask(taskName);
      setInputValue('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-start pt-20 z-50" onClick={onClose}>
      <div 
        className="bg-card-background rounded-lg shadow-xl w-full max-w-lg transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Add task to Inbox..."
            className="w-full bg-transparent border-b border-border-color text-lg text-text-primary p-4 focus:outline-none"
          />
        </form>
      </div>
    </div>
  );
};

export default CommandBar;