import React from 'react';

interface FooterProps {
    onExportClick: () => void;
    onImportClick: () => void;
}

const Footer: React.FC<FooterProps> = ({ onExportClick, onImportClick }) => {
    return (
        <footer className="shrink-0 bg-sidebar-background border-t border-border-color p-2 flex justify-end items-center gap-4">
            <button
                onClick={onExportClick}
                className="text-xs text-text-secondary hover:text-text-primary hover:underline"
            >
                Export All Data
            </button>
            <button
                onClick={onImportClick}
                className="text-xs text-text-secondary hover:text-text-primary hover:underline"
            >
                Import Data
            </button>
        </footer>
    );
};

export default Footer;
