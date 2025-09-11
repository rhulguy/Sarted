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
    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleGoogleSignIn = async () => {
        setIsSigningIn(true);
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        try {
            await auth.signInWithPopup(provider);
            // Successful sign-in is handled by the onAuthStateChanged listener in AuthContext.
        } catch (error: any) {
            if (error.code === 'auth/popup-closed-by-user') {
                // User closed the popup, this is not a critical error.
                console.log("Sign-in popup closed by user.");
            } else {
                console.error("Error during Google sign-in popup:", error);
                showNotification({ message: "An error occurred during sign-in.", type: 'error' });
            }
        } finally {
            setIsSigningIn(false);
        }
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
            disabled={isSigningIn}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-border-color rounded-lg hover:bg-app-background transition-colors disabled:opacity-50"
        >
            <GoogleIcon className="w-5 h-5" />
            <span className="text-sm font-semibold text-text-primary">{isSigningIn ? 'Signing in...' : 'Sign in'}</span>
        </button>
    );
};

export default Auth;