import React, { useEffect, useRef, useState } from 'react';
import { useAuth, User } from '../contexts/AuthContext';
import { auth } from '../services/firebase';
import Spinner from './Spinner';

// A helper component to display user avatar, with a fallback for users without a profile picture.
const UserAvatar: React.FC<{ user: User }> = ({ user }) => {
    if (user.picture) {
        return <img src={user.picture} alt={user.name || 'User'} className="w-8 h-8 rounded-full" />;
    }
    const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';
    
    // Generate a consistent color based on user ID
    const colors = ['bg-accent-blue', 'bg-accent-green', 'bg-accent-yellow', 'bg-accent-red', 'bg-brand-teal', 'bg-brand-orange', 'bg-brand-purple', 'bg-brand-pink'];
    const colorIndex = user.id.length > 0 ? user.id.charCodeAt(0) % colors.length : 0;
    const colorClass = colors[colorIndex];

    return (
        <div className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center text-white font-bold text-sm`}>
            {initial}
        </div>
    );
};


const Auth: React.FC = () => {
    const { user } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Form states for sign-in/sign-up
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');

    const handleLogout = () => {
        auth.signOut();
        setIsDropdownOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }
        setIsProcessing(true);
        setError('');

        try {
            if (isSignUp) {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            // onAuthStateChanged in AuthContext will handle setting the user state.
            setIsDropdownOpen(false);
        } catch (err: any) {
            let message = 'An unknown error occurred. Please try again.';
            switch (err.code) {
                case 'auth/invalid-email':
                    message = 'Please enter a valid email address.';
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    message = 'Invalid email or password.';
                    break;
                case 'auth/email-already-in-use':
                    message = 'An account with this email already exists.';
                    break;
                case 'auth/weak-password':
                    message = 'Password should be at least 6 characters.';
                    break;
                case 'auth/too-many-requests':
                    message = 'Too many attempts. Please try again later.';
                    break;
            }
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const resetForm = () => {
        setError('');
        setEmail('');
        setPassword('');
        setIsSignUp(false);
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

    useEffect(() => {
        // Reset form state when dropdown closes
        if (!isDropdownOpen) {
            resetForm();
        }
    }, [isDropdownOpen]);
    
    if (user) {
        return (
            <div className="relative" ref={dropdownRef}>
                <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center space-x-2">
                    <UserAvatar user={user} />
                </button>
                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-card-background border border-border-color rounded-md shadow-lg z-10">
                        <div className="p-2 border-b border-border-color">
                            <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
                            <p className="text-xs text-text-secondary truncate">{user.email}</p>
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
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsDropdownOpen(true)}
                className="px-4 py-2 border border-border-color rounded-lg hover:bg-app-background transition-colors"
            >
                <span className="text-sm font-semibold text-text-primary">Sign In</span>
            </button>
             {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-card-background border border-border-color rounded-lg shadow-lg z-10 p-4">
                    <h3 className="text-lg font-semibold text-center mb-4">{isSignUp ? 'Create an Account' : 'Sign In'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-text-secondary">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full mt-1 bg-app-background border border-border-color rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-text-secondary">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full mt-1 bg-app-background border border-border-color rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue"
                                required
                            />
                        </div>
                        {error && <p className="text-accent-red text-xs text-center pt-1">{error}</p>}
                        <button type="submit" disabled={isProcessing} className="w-full flex items-center justify-center mt-2 px-4 py-2 bg-accent-blue text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-50">
                            {isProcessing ? <Spinner /> : (isSignUp ? 'Sign Up' : 'Sign In')}
                        </button>
                    </form>
                    <p className="text-center text-xs text-text-secondary mt-4">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-accent-blue font-semibold ml-1 hover:underline focus:outline-none">
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </div>
            )}
        </div>
    );
};

export default Auth;
