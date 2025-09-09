import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { useResource } from '../contexts/ProjectContext';
import { useHabit } from '../contexts/HabitContext';
import { useInbox } from '../contexts/InboxContext';
import { useLoading } from '../contexts/LoadingContext';
import { BackupData } from '../types';
import Spinner from './Spinner';
import { DownloadIcon, UploadIcon } from './IconComponents';

const SettingsView: React.FC = () => {
    const { user } = useAuth();
    const { projects, projectGroups, importAndOverwriteProjectsAndGroups } = useProject();
    const { resources, importAndOverwriteResources } = useResource();
    const { habits, importAndOverwriteHabits } = useHabit();
    const { tasks: inboxTasks, importAndOverwriteInbox } = useInbox();
    const { dispatch: loadingDispatch } = useLoading();

    const [isImporting, setIsImporting] = useState(false);
    const [importConfirmation, setImportConfirmation] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExportData = useCallback(() => {
        if (!user) {
            alert("Please sign in to export your data.");
            return;
        }
        try {
            const backupData: BackupData = {
                version: "1.0.0",
                exportedAt: new Date().toISOString(),
                projectGroups,
                projects,
                habits,
                resources,
                inboxTasks,
            };
            const jsonString = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `sarted-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export data:", error);
            alert("An error occurred while exporting your data. Please check the console for details.");
        }
    }, [user, projectGroups, projects, habits, resources, inboxTasks]);

    const handleImportData = useCallback(async () => {
        const file = fileInputRef.current?.files?.[0];
        if (!file || !user) {
          alert("Please select a file and sign in to import data.");
          return;
        }
        
        setIsImporting(true);
        loadingDispatch({ type: 'SET_LOADING', payload: true });

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const result = event.target?.result;
                if (typeof result !== 'string') throw new Error("File could not be read.");
                
                const data: BackupData = JSON.parse(result);

                if (!data.version || !Array.isArray(data.projects) || !Array.isArray(data.projectGroups) || !Array.isArray(data.habits) || !Array.isArray(data.resources) || !Array.isArray(data.inboxTasks)) {
                    throw new Error("Invalid backup file format.");
                }

                await Promise.all([
                    importAndOverwriteProjectsAndGroups({ projects: data.projects, projectGroups: data.projectGroups }),
                    importAndOverwriteHabits({ habits: data.habits }),
                    importAndOverwriteResources({ resources: data.resources }),
                    importAndOverwriteInbox({ inboxTasks: data.inboxTasks }),
                ]);

                alert("Data imported successfully! The application will now reload.");
                window.location.reload();
            } catch (error) {
                console.error("Failed to import data:", error);
                alert(`An error occurred during import: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setIsImporting(false);
                loadingDispatch({ type: 'SET_LOADING', payload: false });
            }
        };
        reader.onerror = () => {
            alert("Failed to read the backup file.");
            setIsImporting(false);
            loadingDispatch({ type: 'SET_LOADING', payload: false });
        };
        reader.readAsText(file);
    }, [user, importAndOverwriteProjectsAndGroups, importAndOverwriteHabits, importAndOverwriteResources, importAndOverwriteInbox, loadingDispatch]);

    return (
        <div className="h-full flex flex-col p-4 md:p-6 lg:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
                <p className="text-text-secondary">Manage your application data.</p>
            </header>

            <div className="flex-grow overflow-y-auto max-w-3xl mx-auto w-full space-y-8">
                {/* Export Section */}
                <div className="bg-card-background rounded-2xl shadow-card border border-border-color p-6">
                    <h2 className="text-xl font-semibold mb-2 text-text-primary">Export Data</h2>
                    <p className="text-text-secondary mb-4">
                        Download a full backup of all your projects, tasks, habits, and resources as a single JSON file. Keep this file in a safe place.
                    </p>
                    <button
                        onClick={handleExportData}
                        className="px-4 py-2 bg-accent-blue text-white font-semibold rounded-lg hover:opacity-90 transition-colors flex items-center gap-2"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        Download Backup
                    </button>
                </div>

                {/* Import Section */}
                <div className="bg-card-background rounded-2xl shadow-card border border-accent-red/50 p-6">
                    <h2 className="text-xl font-semibold text-accent-red mb-2">Import Data (Danger Zone)</h2>
                    <div className="space-y-4">
                        <p className="text-text-secondary"><strong className="text-accent-red">Warning:</strong> Importing a backup file will permanently delete and overwrite all current data in your account. This action cannot be undone.</p>
                        <div className="flex items-center gap-2">
                           <input type="file" ref={fileInputRef} accept=".json" className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-app-background file:text-text-primary hover:file:bg-border-color"/>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-text-secondary">To confirm, type <strong className="text-accent-red">OVERWRITE</strong> below:</label>
                           <input type="text" value={importConfirmation} onChange={e => setImportConfirmation(e.target.value)} className="mt-1 w-full max-w-xs bg-app-background border border-border-color rounded-lg px-3 py-2" />
                        </div>
                        <button onClick={handleImportData} disabled={importConfirmation !== 'OVERWRITE' || isImporting || !fileInputRef.current?.files?.length} className="mt-3 w-full flex items-center justify-center px-4 py-3 bg-accent-red text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed gap-2">
                            {isImporting ? <Spinner /> : <UploadIcon className="w-5 h-5" />}
                            {isImporting ? 'Importing...' : 'Import and Overwrite All Data'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
