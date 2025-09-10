import React, { useState, useRef, useEffect } from 'react';
import { DownloadIcon, ChevronDownIcon, ImageIcon, ViewGridIcon, DocumentTextIcon } from './IconComponents';

const useClickOutside = (ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent) => void) => {
    useEffect(() => {
        const listener = (event: MouseEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
        };
    }, [ref, handler]);
};

interface ExportDropdownProps {
    onExportImage: () => void;
    onExportCsv: () => void;
    onExportDoc: () => void;
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({ onExportImage, onExportCsv, onExportDoc }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    useClickOutside(wrapperRef, () => setIsOpen(false));

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-app-background text-text-secondary rounded-lg hover:bg-border-color transition-colors"
            >
                <DownloadIcon className="w-4 h-4" />
                <span>Export</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-card-background border border-border-color rounded-xl shadow-soft z-20 p-1">
                    <button onClick={() => { onExportImage(); setIsOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-app-background rounded-lg"><ImageIcon className="w-4 h-4"/>As Image (.png)</button>
                    <button onClick={() => { onExportCsv(); setIsOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-app-background rounded-lg"><ViewGridIcon className="w-4 h-4"/>As CSV (Excel)</button>
                    <button onClick={() => { onExportDoc(); setIsOpen(false); }} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-app-background rounded-lg"><DocumentTextIcon className="w-4 h-4"/>As Word (.doc)</button>
                </div>
            )}
        </div>
    );
};

export default ExportDropdown;
