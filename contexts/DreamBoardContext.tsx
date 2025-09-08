import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { DreamBoardImage } from '../types';
import { useAuth } from './AuthContext';
import { db, storage } from '../services/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

interface DreamBoardState {
  images: DreamBoardImage[];
  loading: boolean;
  uploading: { [key: string]: boolean }; // Track uploads per group
}

interface DreamBoardContextType extends DreamBoardState {
  addImage: (file: File, projectGroupId: string) => Promise<void>;
  deleteImage: (image: DreamBoardImage) => Promise<void>;
}

const DreamBoardContext = createContext<DreamBoardContextType | undefined>(undefined);

export const DreamBoardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [images, setImages] = useState<DreamBoardImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (user) {
            setLoading(true);
            const q = query(collection(db, `users/${user.id}/dreamBoardImages`), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const userImages = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as DreamBoardImage));
                setImages(userImages);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching dream board images:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        } else {
            setImages([]);
            setLoading(false);
        }
    }, [user]);

    const addImage = useCallback(async (file: File, projectGroupId: string) => {
        if (!user) return;

        setUploading(prev => ({ ...prev, [projectGroupId]: true }));
        try {
            const storagePath = `users/${user.id}/dreamBoard/${Date.now()}-${file.name}`;
            const storageRef = ref(storage, storagePath);
            
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, `users/${user.id}/dreamBoardImages`), {
                url: downloadURL,
                projectGroupId,
                storagePath,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Could not upload image. Please try again.");
        } finally {
            setUploading(prev => ({ ...prev, [projectGroupId]: false }));
        }
    }, [user]);

    const deleteImage = useCallback(async (image: DreamBoardImage) => {
        if (!user) return;

        try {
            // Delete Firestore document
            await deleteDoc(doc(db, `users/${user.id}/dreamBoardImages`, image.id));
            
            // Delete file from Storage
            const storageRef = ref(storage, image.storagePath);
            await deleteObject(storageRef);
        } catch (error) {
            console.error("Error deleting image:", error);
            alert("Could not delete image. Please try again.");
        }
    }, [user]);

    const contextValue = useMemo(() => ({
        images,
        loading,
        uploading,
        addImage,
        deleteImage,
    }), [images, loading, uploading, addImage, deleteImage]);

    return (
        <DreamBoardContext.Provider value={contextValue}>
            {children}
        </DreamBoardContext.Provider>
    );
};

export const useDreamBoard = (): DreamBoardContextType => {
  const context = useContext(DreamBoardContext);
  if (context === undefined) {
    throw new Error('useDreamBoard must be used within a DreamBoardProvider');
  }
  return context;
};