import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useDreamBoard } from '../contexts/DreamBoardContext';
import { useProject } from '../contexts/ProjectContext';
import { PlusIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon, UploadIcon } from './IconComponents';
import Spinner from './Spinner';
import { DreamBoardImage } from '../types';

const DreamBoardView: React.FC = () => {
    const { images, loading, uploading, addImage } = useDreamBoard();
    const { projectGroups } = useProject();
    const [draggingOverGroup, setDraggingOverGroup] = useState<string | null>(null);
    const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
    const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

    const imagesByGroup = useMemo(() => {
        const grouped: { [key: string]: DreamBoardImage[] } = {};
        images.forEach(image => {
            if (!grouped[image.projectGroupId]) {
                grouped[image.projectGroupId] = [];
            }
            grouped[image.projectGroupId].push(image);
        });
        return grouped;
    }, [images]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, groupId: string) => {
        const file = e.target.files?.[0];
        if (file) {
            addImage(file, groupId);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, groupId: string) => {
        e.preventDefault();
        setDraggingOverGroup(groupId);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDraggingOverGroup(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, groupId: string) => {
        e.preventDefault();
        setDraggingOverGroup(null);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                addImage(file, groupId);
            }
            e.dataTransfer.clearData();
        }
    };

    const openSlideshow = (image: DreamBoardImage) => {
        const index = images.findIndex(i => i.id === image.id);
        if (index > -1) {
            setSlideshowIndex(index);
        }
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            <header className="mb-6">
                <h1 className="text-3xl font-bold">Dream Board</h1>
                <p className="text-text-secondary">Visualize your goals and inspiration for each project group.</p>
            </header>
            <div className="flex-grow overflow-y-auto space-y-8">
                {projectGroups.map(group => (
                    <div key={group.id}>
                        <h2 className="flex items-center text-xl font-semibold text-text-primary mb-3">
                            <span className="text-2xl mr-3">{group.icon || '📁'}</span>
                            {group.name}
                        </h2>
                        <div
                            onDragOver={(e) => handleDragOver(e, group.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, group.id)}
                            className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 rounded-2xl border-2 border-dashed transition-colors ${
                                draggingOverGroup === group.id ? 'border-accent-blue bg-blue-50' : 'border-border-color'
                            }`}
                        >
                            {(imagesByGroup[group.id] || []).map(image => (
                                <div key={image.id} className="aspect-square bg-app-background rounded-lg overflow-hidden cursor-pointer group relative" onClick={() => openSlideshow(image)}>
                                    <img src={image.url} alt="Dream board inspiration" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                            <input
                                type="file"
                                accept="image/*"
                                // FIX: Correctly handle ref callback for multiple elements
                                ref={el => {
                                    if (el) {
                                        fileInputRefs.current.set(group.id, el);
                                    } else {
                                        fileInputRefs.current.delete(group.id);
                                    }
                                }}
                                onChange={(e) => handleFileSelect(e, group.id)}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRefs.current.get(group.id)?.click()}
                                className="aspect-square border-2 border-dashed border-border-color rounded-lg flex flex-col items-center justify-center text-text-secondary hover:bg-card-background hover:border-accent-blue transition-colors"
                                disabled={uploading[group.id]}
                            >
                                {uploading[group.id] ? (
                                    <Spinner />
                                ) : (
                                    <>
                                        <PlusIcon className="w-8 h-8 mb-2" />
                                        <span className="font-semibold text-sm">Add Image</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
                {loading && <div className="text-center p-8"><Spinner /></div>}
            </div>

            {slideshowIndex !== null && (
                <SlideshowModal
                    images={images}
                    startIndex={slideshowIndex}
                    onClose={() => setSlideshowIndex(null)}
                />
            )}
        </div>
    );
};

const SlideshowModal: React.FC<{ images: DreamBoardImage[], startIndex: number, onClose: () => void }> = ({ images, startIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const { deleteImage } = useDreamBoard();

    const goToPrevious = () => setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    const goToNext = () => setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
    
    const handleDelete = () => {
        if(window.confirm('Are you sure you want to delete this image?')) {
            const imageToDelete = images[currentIndex];
            deleteImage(imageToDelete);
            if (images.length === 1) {
                onClose();
            } else {
                // Move to the next image, or the new last one if deleting the last
                setCurrentIndex(prev => prev >= images.length - 1 ? 0 : prev);
            }
        }
    }

    // FIX: Add useEffect import to use this hook
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goToPrevious();
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [images.length]);

    if (images.length === 0) return null;
    
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
            <div className="relative w-full h-full p-4 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <img src={images[currentIndex].url} alt="Dream board image" className="max-w-full max-h-full object-contain rounded-lg" />

                <button onClick={onClose} className="absolute top-4 right-4 text-white text-4xl hover:opacity-75">&times;</button>
                <button onClick={handleDelete} className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded-full hover:bg-red-500"><TrashIcon className="w-6 h-6"/></button>
                
                <button onClick={goToPrevious} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-white/30"><ChevronLeftIcon className="w-8 h-8"/></button>
                <button onClick={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-white/30"><ChevronRightIcon className="w-8 h-8"/></button>
            </div>
        </div>
    );
};

export default DreamBoardView;