import React, { useEffect } from 'react';
import { OverlayWindow } from './components/Overlay/OverlayWindow';

export const App: React.FC = () => {
  useEffect(() => {
    document.body.classList.remove('bg-dark-900');
    document.body.classList.add('bg-transparent');
    document.title = '';
  }, []);

  return <OverlayWindow />;
};

export default App;

