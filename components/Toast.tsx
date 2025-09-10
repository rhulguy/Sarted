import React from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { Notification, NotificationType } from '../types';

const getIcon = (type: NotificationType) => {
    switch(type) {
        case 'success':
            return (
                <svg className="w-6 h-6 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        case 'error':
             return (
                <svg className="w-6 h-6 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        case 'info':
        default:
             return (
                <svg className="w-6 h-6 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
    }
};

const Toast: React.FC<{ notification: Notification }> = ({ notification }) => {
    return (
        <div className="flex items-start bg-card-background shadow-soft rounded-lg p-4 w-full max-w-sm border border-border-color animate-fade-in">
            <div className="shrink-0">
                {getIcon(notification.type)}
            </div>
            <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-text-primary">{notification.message}</p>
            </div>
        </div>
    );
};

const ToastContainer: React.FC = () => {
    const { notifications } = useNotification();

    return (
        <div className="fixed top-4 right-4 z-[100] space-y-2 w-full max-w-sm">
            {notifications.map(notification => (
                <Toast key={notification.id} notification={notification} />
            ))}
        </div>
    );
};

export default ToastContainer;