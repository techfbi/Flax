// hooks/useStatusBar.ts
import { useEffect } from 'react';

interface StatusBarColors {
  light: {
    top: string;
    scrolled: string;
  };
  dark: {
    top: string;
    scrolled: string;
  };
}

export const useStatusBar = (): void => {
  useEffect(() => {
    const updateStatusBar = (): void => {
      const isDarkMode: boolean = document.documentElement.classList.contains('dark');
      const isScrolled: boolean = window.scrollY > 80;

      // Colors for different states
      const colors: StatusBarColors = {
        light: {
          top: '#9DAFA1',
          scrolled: '#FFFFFF',
        },
        dark: {
          top: '#405245',
          scrolled: '#171410',
        },
      };

      const mode: 'light' | 'dark' = isDarkMode ? 'dark' : 'light';
      const bgColor: string = isScrolled ? colors[mode].scrolled : colors[mode].top;

      // Update Android
      const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (themeColor) {
        themeColor.content = bgColor;
      }

      // Update iOS
      const statusBar = document.querySelector<HTMLMetaElement>(
        'meta[name="apple-mobile-web-app-status-bar-style"]'
      );
      if (statusBar) {
        statusBar.content = isDarkMode ? 'black-translucent' : 'default';
      }
    };

    updateStatusBar();
    window.addEventListener('scroll', updateStatusBar);
    
    const observer = new MutationObserver(updateStatusBar);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      window.removeEventListener('scroll', updateStatusBar);
      observer.disconnect();
    };
  }, []);
};