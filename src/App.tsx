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

  if (isOverlay) {
    return <OverlayWindow />;
  }

  return <DashboardPage />;
};

export default App;

