import React, { useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { useNotification } from '../contexts/NotificationContext';
import { generateImage } from '../services/geminiService';
import { ApiError } from '../types';
import Spinner from './Spinner';
import { SparklesIcon, TrashIcon, DownloadIcon } from './IconComponents';

const DreamBoardView: React.FC = () => {
    const [images, setImages] = useLocalStorage<string[]>('sarted-dreamboard-images', []);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const { showNotification } = useNotification();

    const handleGenerateImage = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const imageUrl = await generateImage(prompt);
            setImages(prev => [imageUrl, ...prev]);
            setPrompt('');
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to generate image.';
            showNotification({ message, type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteImage = (index: number) => {
        if (window.confirm('Are you sure you want to delete this image?')) {
            setImages(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleDownload = (imgSrc: string, index: number) => {
        const link = document.createElement('a');
        link.href = imgSrc;
        link.download = `dreamboard-image-${index}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    return (
        <div className="h-full flex flex-col p-4 md:p-6">
            <header className="mb-6 shrink-0">
                <h1 className="text-3xl font-bold text-text-primary">Dream Board</h1>
                <p className="text-text-secondary">Visualize your goals and dreams by generating inspirational AI images.</p>
            </header>
            <div className="mb-4 flex flex-col md:flex-row gap-2">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the dream you want to visualize..."
                    className="flex-grow bg-card-background border border-border-color rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    rows={2}
                    disabled={isGenerating}
                />
                <button
                    onClick={handleGenerateImage}
                    disabled={!prompt.trim() || isGenerating}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                    {isGenerating ? <Spinner /> : <SparklesIcon className="w-5 h-5" />}
                    {isGenerating ? 'Generating...' : 'Generate Image'}
                </button>
            </div>
            <div className="flex-grow overflow-y-auto bg-app-background rounded-lg p-4">
                {images.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center text-text-secondary">
                        <p>Your dream board is empty. Generate your first image to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {images.map((imgSrc, index) => (
                            <div key={index} className="relative group aspect-video">
                                <img src={imgSrc} alt={`Generated art ${index}`} className="w-full h-full object-cover rounded-xl" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => handleDeleteImage(index)} className="p-2 bg-black/70 text-white rounded-full hover:bg-accent-red">
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                     <button onClick={() => handleDownload(imgSrc, index)} className="p-2 bg-black/70 text-white rounded-full hover:bg-accent-blue">
                                        <DownloadIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DreamBoardView;