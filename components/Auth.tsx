import React, { useEffect, useRef, useState } from 'react';
import firebase from 'firebase/compat/app';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { GoogleIcon } from './IconComponents';
import { useNotification } from '../contexts/NotificationContext';

const Auth: React.FC = () => {
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleGoogleSignIn = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        // Using signInWithPopup as signInWithRedirect is not supported in this environment.
        auth.signInWithPopup(provider)
            .catch((error) => {
                // Handle Errors here.
                console.error("Error during Google sign-in popup:", error);
                let message = "An unknown error occurred during sign-in.";
                if (error.code === 'auth/popup-closed-by-user') {
                    // This is a common case and can be handled silently.
                    return;
                } else if (error.code === 'auth/account-exists-with-different-credential') {
                    message = "An account already exists with the same email. Please sign in with your original method.";
                } else if (error.code === 'auth/popup-blocked') {
                    message = "Popup blocked by browser. Please allow popups for this site to sign in.";
                }
                showNotification({ message, type: 'error' });
            });
    };

    const handleLogout = () => {
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