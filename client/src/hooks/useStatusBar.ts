// hooks/useStatusBar.ts
import { useEffect } from 'react';

export const useStatusBar = (): void => {
  useEffect(() => {
    // Create overlay for smooth transition (works on Android & some iOS browsers)
    const overlay = document.createElement('div');
    overlay.id = 'status-bar-fade';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 0px;
      z-index: 99999;
      pointer-events: none;
      transition: background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    document.body.appendChild(overlay);

    const updateStatusBar = (): void => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      const isScrolled = window.scrollY > 100;

      const colors = {
        light: { top: '#9DAFA1', scrolled: '#F6F1E7' },
        dark: { top: '#405245', scrolled: '#171410' },
      };

      const mode = isDarkMode ? 'dark' : 'light';
      const bgColor = isScrolled ? colors[mode].scrolled : colors[mode].top;

      // Update overlay (smooth fade for Android)
      overlay.style.backgroundColor = bgColor;
      overlay.style.height = 'env(safe-area-inset-top, 0px)';

      // Update Android meta tag
      const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (themeColor) {
        themeColor.content = bgColor;
      }

      // Update iOS body background (instant, but works)
      document.body.style.backgroundColor = bgColor;
      document.body.style.transition = 'background-color 0.5s ease';

      // Update iOS status bar style
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
      const overlayToRemove = document.getElementById('status-bar-fade');
      if (overlayToRemove) overlayToRemove.remove();
    };
  }, []);
};