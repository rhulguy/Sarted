import React from 'react';
import { useLoading } from '../contexts/LoadingContext';

const GlobalLoader: React.FC = () => {
  const { isLoading } = useLoading();

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center z-[100]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-blue"></div>
      <p className="text-accent-blue text-lg mt-4">Processing...</p>
    </div>
  );
};

export default GlobalLoader;