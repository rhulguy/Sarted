import React, { useState, useRef } from 'react';
import Spinner from './Spinner';

interface DataManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'import' | 'export';
    onExport: () => void;
    onImport: (file: File) => void;
    isImporting: boolean;
}

const DataManagementModal: React.FC<DataManagementModalProps> = ({ isOpen, onClose, mode, onExport, onImport, isImporting }) => {
    const [importConfirmation, setImportConfirmation] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileImport = () => {
        const file = fileInputRef.current?.files?.[0];
        if (file) {
            onImport(file);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-card-background rounded-2xl shadow-soft p-6 md:p-8 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-text-primary">
                        {mode === 'export' ? 'Export All Data' : 'Import Data'}
                    </h2>
                    <button onClick={onClose} className="text-3xl text-text-secondary hover:text-text-primary">&times;</button>
                </div>
                
                {mode === 'export' ? (
                    <div>
                        <p className="text-text-secondary mb-4">
                            This will download a full backup of all your projects, tasks, habits, and resources as a single JSON file.
                        </p>
                        <button 
                            onClick={() => { onExport(); onClose(); }}
                            className="w-full px-4 py-3 bg-accent-blue text-white font-semibold rounded-lg hover:opacity-90"
                        >
                            Download Backup
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-text-secondary"><strong className="text-accent-red">Warning:</strong> Importing a backup file will permanently delete and overwrite all current data in your account. This action cannot be undone.</p>
                        <div className="flex items-center gap-2">
                           <input type="file" ref={fileInputRef} accept=".json" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-app-background file:text-text-primary hover:file:bg-border-color"/>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-text-secondary">To confirm, type <strong className="text-accent-red">OVERWRITE</strong> below:</label>
                           <input type="text" value={importConfirmation} onChange={e => setImportConfirmation(e.target.value)} className="mt-1 w-full max-w-xs bg-app-background border border-border-color rounded-lg px-3 py-2" />
                        </div>
                        <button onClick={handleFileImport} disabled={importConfirmation !== 'OVERWRITE' || isImporting || !fileInputRef.current?.files?.length} className="mt-3 w-full flex items-center justify-center px-4 py-3 bg-accent-red text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isImporting && <Spinner />}
                            {isImporting ? 'Importing...' : 'Import and Overwrite All Data'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataManagementModal;
