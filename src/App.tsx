/**
 * App.tsx
 * ─────────────────────────────────────────────────────────
 * Componente React que monta o jogo Phaser no DOM.
 * O jogo é inicializado uma vez (useEffect) e limpo na desmontagem.
 */

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './config/gameConfig';

function App() {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameContainerRef.current && !gameRef.current) {
      const config = createGameConfig(gameContainerRef.current);
      gameRef.current = new Phaser.Game(config);
    }

    // Cleanup: destroi o jogo ao desmontar o componente
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        overflow: 'hidden',
      }}
    >
      <div
        ref={gameContainerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </div>
  );
}

export default App;
