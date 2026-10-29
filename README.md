# BLOOD ARENA - Beat 'em Up 2.5D

Jogo de luta 2.5D no navegador usando Phaser 4, TypeScript e Vite.

## 🎮 Controles

- **WASD / Setas**: Mover
- **ESPAÇO**: Pular
- **J**: Atacar (combo de 3 golpes)
- **H**: Debug (causa dano ao jogador)
- **G**: Toggle inimigos agressivos
- **F1**: Toggle debug de hitboxes

## 🚀 Como Rodar

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Build de produção
npm run build

# Verificar tipos TypeScript
npm run typecheck
```

## 📁 Estrutura do Projeto

```
src/
├── config/
│   ├── constants.ts       # Constantes globais (resolução, velocidades, eventos)
│   ├── attacks.ts         # Dados dos ataques (startup, active, recovery, dano)
│   └── gameConfig.ts      # Configuração do Phaser
├── entities/
│   ├── Fighter.ts         # Classe base para lutadores
│   ├── Player.ts          # Jogador (herda de Fighter)
│   └── Enemy.ts           # Inimigo/Dummy (herda de Fighter)
├── scenes/
│   ├── BootScene.ts       # Carregamento inicial
│   ├── PreloadScene.ts    # Geração de texturas placeholder
│   ├── MainMenuScene.ts   # Menu principal
│   ├── GameScene.ts       # Cena do jogo (combate, câmera, debug)
│   └── UIScene.ts         # HUD (HP, stamina, combo, vidas)
├── state/
│   └── PlayerState.ts     # Estado do jogador (HP, vidas, score)
└── systems/
    └── AnimationManager.ts # Animações e texturas placeholder
```

## ✅ Funcionalidades Implementadas

### Parte A - Correções
- ✅ Fluxo completo de morte/respawn (morrer → animação → respawn com i-frames)
- ✅ Game Over após última vida com ENTER para voltar ao menu
- ✅ Origem do sprite nos pés (setOrigin 0.5, 1)
- ✅ Drag zero no ar (mantém momentum do pulo)
- ✅ Listeners nomeados e removidos no shutdown (sem vazamento)
- ✅ Texturas geradas uma única vez (protegidas com textures.exists)
- ✅ Pulo desacoplado da física (body sempre no chão, sprite desenhado em y-z)
- ✅ Classe base Fighter compartilhada entre Player e Enemy
- ✅ Máquina de estados real (idle, walk, jump, attack, hurt, knockdown, dead)
- ✅ Regeneração de stamina ao longo do tempo

### Parte B - Sistema de Combate
- ✅ Hitboxes de ataque com Zone + physics body
- ✅ Detecção de dano com overlap + validação de profundidade (lane + z)
- ✅ Combo de 3 golpes (J) com janela de encadeamento (300ms)
- ✅ Ataque aéreo (voadora) durante o pulo
- ✅ Hitstop (congelamento de 2-4 frames ao acertar)
- ✅ Screen shake proporcional ao dano
- ✅ Knockback com impulso em X
- ✅ Knockdown no 3º golpe (derruba o inimigo por 700ms)
- ✅ Flash de impacto (faísca branca no ponto de impacto)
- ✅ I-Frames (invulnerabilidade de 1200ms com piscar visual)
- ✅ Inimigo Dummy com HP próprio e barra de vida
- ✅ Modo agressivo (tecla G) para testar dano ao jogador
- ✅ Contador de combo na HUD
- ✅ Debug com F1 (hitboxes verdes, hurtboxes azuis)

## 🎯 Sistema de Combate

### Ataques do Jogador
1. **Jab** (8 dano, rápido)
2. **Cruzado** (8 dano, médio)
3. **Uppercut** (14 dano, causa knockdown)

### Dados dos Ataques
Cada ataque tem:
- `startup`: tempo antes da hitbox ativar (ms)
- `active`: tempo em que a hitbox fica ativa (ms)
- `recovery`: tempo de recovery após a hitbox (ms)
- `damage`: dano causado
- `hitstop`: frames de congelamento ao acertar
- `knockback`: força do empurrão
- `knockdown`: se derruba o alvo
- `hitboxWidth/Height`: dimensões da hitbox
- `zTolerance`: tolerância de profundidade para acertar

### Detecção de Dano
- Validação de faixa (lane tolerance: 15px)
- Validação de altura (z tolerance: varia por ataque)
- Cada golpe atinge cada alvo UMA vez por swing
- Alvos em knockdown ou dead não são atingíveis

### Game Feel
- **Hitstop**: congela a simulação por 2-4 frames
- **Screen shake**: intensidade proporcional ao dano
- **Flash de impacto**: faísca branca no ponto de impacto
- **Knockback**: impulso horizontal ao levar dano
- **I-Frames**: invulnerabilidade de 1200ms com piscar visual

## 🔧 Debug

- **F1**: Mostra hitboxes (verde = hitbox do jogador, vermelho = hitbox do inimigo) e hurtboxes (azul = hurtbox do jogador, laranja = hurtbox do inimigo)
- **G**: Toggle modo agressivo dos inimigos (atacam a cada 2s)
- **H**: Causa 15 de dano ao jogador (para testar HUD e i-frames)

## 🎨 Próximas Fases

### Fase 3 - IA de Inimigos
- Inimigos com comportamento (patrulha, perseguição, ataque)
- Diferentes tipos de inimigos (melee, ranged, boss)
- Sistema de aggro e targeting

### Fase 4 - Gore e Efeitos
- Partículas de sangue ao acertar
- Efeitos de impacto mais elaborados
- Animações de morte mais dramáticas

### Fase 5 - Progressão
- Sistema de níveis/fases
- Power-ups e itens
- Save/load de progresso

## 📝 Notas Técnicas

- **Phaser 4**: Usando a versão mais recente (4.2.1)
- **WebGL forçado**: `type: Phaser.WEBGL`
- **Pixel art**: `pixelArt: true`, `roundPixels: true`
- **Resolução interna**: 384x224 (escalada com FIT)
- **Física**: Arcade Physics sem gravidade global (2.5D manual)
- **Comunicação**: Eventos via `game.events` (sem acoplamento direto)
- **Estado**: PlayerState separado da entidade (fonte de verdade)

## 🐛 Problemas Conhecidos

- Sons não implementados (placeholders prontos para adicionar assets de áudio)
- Texturas placeholder (retângulos coloridos) - pronto para trocar por spritesheets
- Balanceamento de combate pode precisar de ajustes finos

## 📄 Licença

Projeto educacional/demonstração.
