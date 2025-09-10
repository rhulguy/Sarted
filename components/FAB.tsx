import React from 'react';
import { PlusIcon } from './IconComponents';

interface FABProps {
    onClick: () => void;
}

const FAB: React.FC<FABProps> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 bg-accent-blue text-white w-14 h-14 rounded-full shadow-lg hover:bg-blue-500 active:scale-95 transition-all duration-200 flex items-center justify-center z-40"
            aria-label="Add new task"
        >
            <PlusIcon className="w-7 h-7" />
        </button>
    );
};

export default FAB;