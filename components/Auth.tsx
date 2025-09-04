import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: any) => void; }) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = '116829841158-5k18crbts8su25dn4ushh547ncd6da0p.apps.googleusercontent.com';

const Auth: React.FC = () => {
    const { user } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const signInButtonRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleCredentialResponse = async (response: any) => {
        // FIX: Removed check for placeholder GOOGLE_CLIENT_ID as it is configured.
        // This check was causing a compile error because it would always be false.
        try {
            const idToken = response.credential;
            const credential = GoogleAuthProvider.credential(idToken);
            await signInWithCredential(auth, credential);
        } catch (error) {
            console.error("Error signing in with Firebase:", error);
        }
    };

    const handleLogout = () => {
        signOut(auth);
        setIsDropdownOpen(false);
    };

    useEffect(() => {
        // Render the Google Sign-In button if the user is not logged in and the button exists
        if (!user && signInButtonRef.current && window.google) {
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID!,
                callback: handleCredentialResponse,
            });
            window.google.accounts.id.renderButton(
                signInButtonRef.current,
                { theme: "outline", size: "large", type: "standard", shape: "pill" }
            );
        }
    }, [user]);

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
                    <div className="absolute right-0 mt-2 w-48 bg-highlight border border-border-color rounded-md shadow-lg z-10">
                        <div className="p-2 border-b border-border-color">
                            <p className="text-sm font-semibold text-text-primary">{user.name}</p>
                            <p className="text-xs text-text-secondary">{user.email}</p>
                        </div>
                        <button 
                            onClick={handleLogout} 
                            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-secondary"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        );
    }
    
    // The container for the Google Sign-In button
    return <div ref={signInButtonRef} className={user === null ? '' : 'hidden'}></div>;
};

export default Auth;