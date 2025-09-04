import { useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    html2canvas: any;
  }
}

// Singleton to manage script loading state
let scriptLoadingPromise: Promise<void> | null = null;
const SCRIPT_URL = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

const loadHtml2Canvas = (): Promise<void> => {
  // If script is already available, return resolved promise
  if (typeof window.html2canvas !== 'undefined') {
    return Promise.resolve();
  }

  // If script is already loading, return existing promise
  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }
  
  // Start loading the script
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      scriptLoadingPromise = null; // Reset for potential retries
      if (typeof window.html2canvas !== 'undefined') {
        resolve();
      } else {
        reject(new Error('html2canvas script loaded but not defined on window.'));
      }
    };
    script.onerror = () => {
      scriptLoadingPromise = null; // Reset for potential retries
      reject(new Error(`Failed to load script: ${SCRIPT_URL}. Check network connection and ad blockers.`));
    };
    document.head.appendChild(script);
  });
  
  return scriptLoadingPromise;
};

export const useDownloadImage = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadImage = useCallback(async (imageName = 'download.png') => {
    const element = ref.current;
    if (!element) {
      console.error('Element for download not found.');
      return;
    }

    setIsDownloading(true);
    try {
      await loadHtml2Canvas();
      
      // Temporarily change background for capture if it's transparent, like in Mind Maps
      const originalBg = element.style.backgroundColor;
      if (!originalBg || originalBg === 'transparent') {
          element.style.backgroundColor = '#0D1117'; // primary bg color
      }

      const canvas = await window.html2canvas(element, {
          useCORS: true,
          allowTaint: true,
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
          backgroundColor: '#0D1117' // Ensure background is not transparent
      });
      
      // Restore original background color
      element.style.backgroundColor = originalBg;

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = imageName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      const errorMsg = 'Could not export image. Please check your internet connection and ensure ad blockers are not interfering with cdnjs.cloudflare.com, then try again.';
      console.error('Failed to download image:', error);
      alert(errorMsg);
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { ref, downloadImage, isDownloading };
};