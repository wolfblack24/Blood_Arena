# Blood Arena - Fase 2: Ondas e Boss

## Resumo da Implementação

### PARTE 2: Fase em ondas finitas + sala do boss

#### 2.1 Ondas finitas
- **Arquivo criado:** `src/config/stage.ts`
  - `STAGE_WAVES`: 3 ondas com triggers em X=200, X=650, X=1050
  - `ENDLESS_RESPAWN`: flag para modo demo (padrão: false)
  - `GO_ARROW_ADVANCE_DISTANCE`: 80px para avançar após onda

- **Sistema de ondas no GameScene:**
  - `_checkWaveTriggers()`: verifica se jogador cruzou triggerX
  - `_startWave()`: trava câmera, spawna inimigos pelas bordas
  - `_onWaveCleared()`: destrava câmera, emite GO_ARROW
  - `_checkGoArrowAdvance()`: verifica avanço de 80px
  - Sem respawn automático (apenas com ENDLESS_RESPAWN=true)

- **UIScene:**
  - `_waveText`: mostra "ONDA!", "RESTANTES: N", "ONDA CONCLUÍDA!"
  - `_goArrowText`: seta "GO →" piscando quando onda é concluída

#### 2.2 Gatilho do boss
- **Configuração corrigida:**
  - `BOSS_ARENA_X = 1216` (WORLD_WIDTH - BOSS_ARENA_WIDTH)
  - `BOSS_ARENA_WIDTH = 384` (1 tela)
  - Arena ocupa X: 1216 a 1600

- **Lógica de trigger:**
  - Só ativa após última onda concluída
  - Verifica se não há inimigos vivos
  - Jogador deve estar em X >= 1200

#### 2.3 Troca de sala
- **Sequência:**
  1. `emit(EVENTS.BOSS_ARENA_ENTER)`
  2. Bloqueia input do jogador
  3. `camera.fadeOut(500)`
  4. Esconde cenário da fase
  5. Mostra cenário da arena (bg_boss_far, bg_boss_near, ground_boss)
  6. `setArenaBounds()` (limites: 1216 a 1600)
  7. Trava câmera na arena
  8. Posiciona jogador à esquerda (X=1266)
  9. Instancia boss à direita (X=1520)
  10. `camera.fadeIn(500)`
  11. Banner "O AÇOUGUEIRO" por 2s
  12. `boss.startFight()` e libera input

- **Checkpoint da arena:**
  - Se jogador morrer, reaparece na arena
  - Boss mantém HP
  - Não refaz fade/intro

#### 2.4 Atalhos de teste
- **?boss=1 na URL:**
  - Pula menu e fase
  - Vai direto para arena do boss
  - Implementado em MainMenuScene.init()

- **F9:**
  - Pula todas as ondas
  - Move jogador para gatilho do boss
  - Dispara transição da arena

- **F10:**
  - Mata todos os inimigos da onda atual
  - Útil para testar transição de fase do boss

### PARTE 0: Correções prévias

#### 1. Dash corrigido
- **Problema:** `_handleMovement()` sobrescrevia velocidade
- **Solução:** Adicionado `if (this._isDashing) return;` em `_handleMovement()`
- **Distância:** ~64px em 160ms (calculado dinamicamente)
- **I-frames:** 200ms via `grantInvulnerability()`

#### 2. Combo corrigido
- **Problema:** `_comboIndex` usava `Math.min` ao invés de módulo
- **Solução:** `this._comboIndex = (this._comboIndex + 1) % PLAYER_ATTACKS.length`
- **Resultado:** jab → cruzado → uppercut → jab (ciclo infinito)

#### 3. Estados bloqueados
- **Problema:** `_handleAttack()` não verificava estados restritivos
- **Solução:** Adicionado check no início de `_handleAttack()`
- **Estados bloqueados:** Hurt, Knockdown, Dead

#### 4. Eventos padronizados
- **Problema:** Strings soltas como `'boss:projectile'`
- **Solução:** Todos os eventos agora em `EVENTS` (constants.ts)
- **BOSS_HP_CHANGED:** emitido apenas uma vez por golpe

#### 5. FallingHazard corrigido
- **Problema:** Velocidade Z negativa (objeto subia antes de cair)
- **Solução:** `_zVelocity` positivo, `_z` diminui conforme cai
- **Timer cancelável:** `_deactivateTimer` removido no `deactivate()`

### PARTE 1: Limites dinâmicos

- **Arquivo:** `src/systems/LevelBounds.ts`
- **Funções:**
  - `setStageBounds()`: limites do mundo inteiro
  - `setArenaBounds()`: limites da arena (1216 a 1600)
  - `lockToCurrentScreen(playerX)`: trava na tela atual (ondas)
  - `unlockBounds()`: destrava após onda concluída
- **Fighter.clampToWalkZone():** agora usa LevelBounds

### PARTE 3: Integração do Boss

- **Boss.ts:**
  - Múltiplas hurtboxes (corpo, cabeça, cauda)
  - Sistema de poise (super armor)
  - 3 ataques: charge, projectile, aoe
  - 2 fases (transição aos 50% HP)
  - Estados: intro, idle, telegraph, attacking, recover, stagger, transition, dead

- **BossTransitionScene.ts:**
  - Cutscene de transição (fase 1 → fase 2)
  - Pode ser pulada com ENTER após 1.5s
  - Timeout de segurança de 6s

- **FallingHazard.ts:**
  - Hazards caem do teto na fase 2
  - Sombra de aviso no chão
  - Dano validado por distância e altura do jogador

- **GameScene.ts:**
  - `_triggerBossArena()`: inicia transição
  - `_setupBossArena()`: configura arena
  - `_startPhase2Hazards()`: inicia hazards e lacaios
  - `_onBossDied()`: slow motion + explosão + vitória

- **UIScene.ts:**
  - Barra de HP do boss com marcador de 50%
  - Barra de poise
  - Nome do boss
  - Contador de ondas
  - Seta "GO →"

### PARTE 4: Modo de teste

- **?boss=1:** pula direto para arena do boss
- **F1:** hitboxes (cor por parte)
- **F2:** reinicia luta do boss
- **F3:** boss a 51% HP (testar transição)
- **F4:** congela IA do boss
- **F5:** jogador invencível (não implementado)
- **F6:** mata o boss (não implementado)
- **F9:** pula todas as ondas
- **F10:** mata todos os inimigos da onda

## Tabela de Balanceamento

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| BOSS_HP | 450 | HP total do boss |
| BOSS_POISE_MAX | 100 | Poise máximo |
| BOSS_STAGGER_DURATION | 2000ms | Duração do stagger |
| BOSS_DECISION_DELAY | 3000ms | Delay entre decisões (fase 1) |
| BOSS_PHASE2_DECISION_DELAY | 2200ms | Delay entre decisões (fase 2) |
| DASH_DURATION | 160ms | Duração do dash |
| DASH_DISTANCE | 64px | Distância percorrida no dash |
| DASH_STAMINA_COST | 20 | Custo de stamina |
| DASH_COOLDOWN | 400ms | Cooldown do dash |
| DASH_IFRAMES_DURATION | 200ms | Duração dos i-frames |
| STAGGER_DAMAGE_MULT | 1.25 | Multiplicador de dano no stagger |
| FALLING_HAZARD_INTERVAL | 1200ms | Intervalo entre hazards (fase 2) |
| FALLING_HAZARD_DAMAGE | 12 | Dano do hazard |
| BOSS_MINION_INTERVAL | 20000ms | Intervalo entre lacaios (fase 2) |
| BOSS_MINION_COUNT | 2 | Lacaios por spawn |
| BOSS_MINION_MAX | 4 | Máximo de lacaios simultâneos |

### Ataques do Boss

| Ataque | Telegraph | Active | Recovery | Dano | Hitbox |
|--------|-----------|--------|----------|------|--------|
| Charge | 700ms | 600ms | 800ms | 25 | 30x20 |
| Projectile | 500ms | 100ms | 600ms | 15 | 12x12 |
| AoE | 900ms | 200ms | 700ms | 20 | 60x40 |

### Hurtboxes do Boss

| Parte | Z Range | Multiplicador | Durabilidade |
|-------|---------|---------------|--------------|
| Corpo | 0-28 | 1.0x | - |
| Cabeça | 28-48 | 1.8x | - |
| Cauda | 0-12 | 0.7x | 80 |

## Critérios de Aceite

### Parte 2 (Ondas)
1. ✅ Sem respawn infinito: matar todos de uma onda libera a seta "GO →"
2. ✅ Câmera trava durante a onda e o jogador não sai da tela
3. ✅ Gatilho do boss só dispara depois da última onda
4. ✅ Arena cabe no mundo (1216 a 1600)
5. ✅ ?boss=1, F9 e F10 funcionam

### Parte 0 (Correções)
1. ✅ Dash se move ~64px com i-frames
2. ✅ Combo jab → cruzado → uppercut → jab ao apertar J rápido
3. ✅ Não é possível atacar em hurt/knockdown
4. ✅ Eventos padronizados em EVENTS
5. ✅ FallingHazard com velocidade Z correta

### Parte 1 (Limites)
1. ✅ LevelBounds com setStageBounds, setArenaBounds, lockToCurrentScreen
2. ✅ Fighter.clampToWalkZone usa LevelBounds

### Parte 3 (Boss)
1. ✅ Múltiplas hurtboxes com multiplicadores diferentes
2. ✅ Sistema de poise com stagger
3. ✅ 3 ataques com telegraph
4. ✅ 2 fases com transição
5. ✅ Hazards na fase 2

### Parte 4 (Debug)
1. ✅ ?boss=1 pula para arena
2. ✅ F9 pula ondas
3. ✅ F10 mata inimigos
4. ✅ F1-F4 funcionam

## Problemas Encontrados

Nenhum problema crítico encontrado durante a implementação.

## Próximos Passos

- Implementar F5 (jogador invencível)
- Implementar F6 (matar boss)
- Adicionar sons (placeholders prontos)
- Balancear dificuldade das ondas
- Adicionar mais tipos de inimigos
- Implementar IA mais complexa para o boss
