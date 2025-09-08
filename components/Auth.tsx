import React, { useEffect, useRef, useState } from 'react';
// FIX: Import firebase v8 compat library and remove modular auth imports to fix missing member errors.
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { GoogleIcon } from './IconComponents';

const Auth: React.FC = () => {
    const { user } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleGoogleSignIn = async () => {
        // FIX: Use v8 compat syntax for GoogleAuthProvider.
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            // FIX: Use v8 compat syntax for signInWithPopup.
            await auth.signInWithPopup(provider);
        } catch (error) {
            console.error("Error during Google sign-in:", error);
            alert("Failed to sign in. Please ensure popups are enabled and try again. Check the console for more details.");
        }
    };

    const handleLogout = () => {
        // FIX: Use v8 compat syntax for signOut.
        auth.signOut();
        setIsDropdownOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    if (user) {
        return (
            <div className="relative" ref={dropdownRef}>
                <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2">
                    <img src={user.picture || ''} alt={user.name || ''} className="w-8 h-8 rounded-full" />
                </button>
                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-card-background border border-border-color rounded-md shadow-lg z-10">
                        <div className="p-2 border-b border-border-color">
                            <p className="text-sm font-semibold text-text-primary">{user.name}</p>
                            <p className="text-xs text-text-secondary">{user.email}</p>
                        </div>
                        <button 
                            onClick={handleLogout} 
                            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-app-background"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <button
            onClick={handleGoogleSignIn}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-border-color rounded-lg hover:bg-app-background transition-colors"
        >
            <GoogleIcon className="w-5 h-5" />
            <span className="text-sm font-semibold text-text-primary">Sign in</span>
        </button>
    );
};

export default Auth;
