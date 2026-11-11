import React, { useState, useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { OverlayWindow } from './components/Overlay/OverlayWindow';

export const App: React.FC = () => {
  const [isOverlay, setIsOverlay] = useState(
    window.location.hash.includes('overlay')
  );

  useEffect(() => {
    const handleHashChange = () => {
      setIsOverlay(window.location.hash.includes('overlay'));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isOverlay) {
      document.body.classList.remove('bg-dark-900');
      document.body.classList.add('bg-transparent');
    } else {
      document.body.classList.add('bg-dark-900');
      document.body.classList.remove('bg-transparent');
    }
  }, [isOverlay]);

  if (isOverlay) {
    return <OverlayWindow />;
  }

  return <DashboardPage />;
};

export default App;

