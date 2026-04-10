import { useState, useEffect, useCallback, useRef } from "react";
import { type BattleUnit, type StatusEffect } from "../types/game";
import { characters } from "../data/characters";
import { enemies } from "../data/enemies";

function createUnit(
  char: (typeof characters)[0],
  team: "player" | "enemy"
): BattleUnit {
  return {
    ...char,
    currentHp: char.hp,
    isAlive: true,
    team,
    statusEffects: [],
  };
}

export default function BattlePage() {
  const [playerTeam, setPlayerTeam] = useState<BattleUnit[]>([
    createUnit(characters[0], "player"),
    createUnit(characters[1], "player"),
    createUnit(characters[2], "player"),
  ]);

  const [enemyTeam, setEnemyTeam] = useState<BattleUnit[]>([
    createUnit(enemies[0], "enemy"),
    createUnit(enemies[1], "enemy"),
    createUnit(enemies[2], "enemy"),
  ]);

  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [selectedAbility, setSelectedAbility] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  
  // Use refs to track state without triggering re-renders
  const processingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerTeamRef = useRef(playerTeam);
  const enemyTeamRef = useRef(enemyTeam);
  const currentTurnIndexRef = useRef(currentTurnIndex);

  // Keep refs in sync with state
  useEffect(() => {
    playerTeamRef.current = playerTeam;
  }, [playerTeam]);

  useEffect(() => {
    enemyTeamRef.current = enemyTeam;
  }, [enemyTeam]);

  useEffect(() => {
    currentTurnIndexRef.current = currentTurnIndex;
  }, [currentTurnIndex]);

  const getCurrentUnit = useCallback(() => {
    const allAliveUnits = [...playerTeamRef.current, ...enemyTeamRef.current]
      .filter((u) => u.isAlive)
      .sort((a, b) => b.speed - a.speed);
    
    if (allAliveUnits.length === 0) return null;
    return allAliveUnits[currentTurnIndexRef.current % allAliveUnits.length];
  }, []);

  const advanceToNextTurn = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const allAliveUnits = [...playerTeamRef.current, ...enemyTeamRef.current].filter(u => u.isAlive);
    
    if (allAliveUnits.length === 0) {
      checkGameOver();
      return;
    }
    
    setCurrentTurnIndex((prev) => {
      const next = prev + 1;
      return next >= allAliveUnits.length ? 0 : next;
    });
    
    setIsProcessingTurn(false);
    processingRef.current = false;
    setIsPaused(false);
    setWaitingForPlayer(false);
  }, []);

  const checkGameOver = useCallback(() => {
    const playersAlive = playerTeamRef.current.some((u) => u.isAlive);
    const enemiesAlive = enemyTeamRef.current.some((u) => u.isAlive);
    
    if (!playersAlive) {
      setGameOver("💀 Derrota");
      setIsProcessingTurn(false);
      processingRef.current = false;
      setIsPaused(false);
      setWaitingForPlayer(false);
      return true;
    }
    if (!enemiesAlive) {
      setGameOver("🏆 Victoria");
      setIsProcessingTurn(false);
      processingRef.current = false;
      setIsPaused(false);
      setWaitingForPlayer(false);
      return true;
    }
    return false;
  }, []);

  const applyStatus = useCallback((target: BattleUnit, effect: StatusEffect) => {
    return {
      ...target,
      statusEffects: [...target.statusEffects, effect],
    };
  }, []);

  const processStatusEffects = useCallback((unit: BattleUnit): BattleUnit => {
    let updated = { ...unit };

    updated.statusEffects.forEach((effect) => {
      if (effect.type === "infected") {
        updated.currentHp -= effect.value;
        setLog((prev) => [
          `${unit.name} sufre ${effect.value} de virus`,
          ...prev,
        ]);
      }
    });

    updated.statusEffects = updated.statusEffects
      .map((e) => ({ ...e, duration: e.duration - 1 }))
      .filter((e) => e.duration > 0);

    updated.isAlive = updated.currentHp > 0;

    return updated;
  }, []);

  const executeEnemyTurn = useCallback((enemy: BattleUnit) => {
    const alivePlayers = playerTeamRef.current.filter((p) => p.isAlive);
    if (alivePlayers.length === 0) {
      checkGameOver();
      return;
    }
    
    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const index = playerTeamRef.current.findIndex((p) => p.id === target.id);
    
    // Enemy attacks
    let damage = enemy.abilities[0].power;
    const shield = target.statusEffects.find((e) => e.type === "shield");
    if (shield) damage -= shield.value;
    damage = Math.max(damage, 1);

    setPlayerTeam(prev => {
      const updated = [...prev];
      updated[index] = {
        ...target,
        currentHp: target.currentHp - damage,
        isAlive: target.currentHp - damage > 0,
      };
      return updated;
    });

    setLog((prev) => [
      `${enemy.name} ataca a ${target.name} (${damage})`,
      ...prev,
    ]);

    // Pause then advance
    setIsPaused(true);
    timeoutRef.current = setTimeout(() => {
      const isGameOver = checkGameOver();
      if (!isGameOver) {
        advanceToNextTurn();
      }
    }, 1500);
  }, [advanceToNextTurn, checkGameOver]);

  const handlePlayerAction = useCallback((
    ability: any,
    attacker: BattleUnit,
    targetIndex: number
  ) => {
    if (!ability) return;

    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Player attacks enemies
    if (ability.target === "enemy") {
      const target = enemyTeamRef.current[targetIndex];
      if (!target?.isAlive) return;

      let damage = ability.power;
      const shield = target.statusEffects.find((e) => e.type === "shield");
      if (shield) damage -= shield.value;
      damage = Math.max(damage, 1);

      setEnemyTeam(prev => {
        const updated = [...prev];
        updated[targetIndex] = {
          ...target,
          currentHp: target.currentHp - damage,
          isAlive: target.currentHp - damage > 0,
        };

        if (ability.effect) {
          updated[targetIndex] = applyStatus(updated[targetIndex], ability.effect);
        }

        return updated;
      });

      setLog((prev) => [
        `${attacker.name} usa ${ability.name} (${damage})`,
        ...prev,
      ]);
    }
    
    // Player heals/buffs allies
    if (ability.target === "ally") {
      const target = playerTeamRef.current[targetIndex];
      if (!target) return;

      setPlayerTeam(prev => {
        const updated = [...prev];

        if (ability.type === "heal") {
          updated[targetIndex] = {
            ...target,
            currentHp: Math.min(target.currentHp + ability.power, target.hp),
          };
        }

        if (ability.effect) {
          updated[targetIndex] = applyStatus(updated[targetIndex], ability.effect);
        }

        return updated;
      });

      setLog((prev) => [
        `${attacker.name} usa ${ability.name} en ${target.name}`,
        ...prev,
      ]);
    }

    setSelectedAbility(null);
    setWaitingForPlayer(false);
    
    // Pause then advance
    setIsPaused(true);
    timeoutRef.current = setTimeout(() => {
      const isGameOver = checkGameOver();
      if (!isGameOver) {
        advanceToNextTurn();
      }
    }, 1500);
  }, [applyStatus, advanceToNextTurn, checkGameOver]);

  // Main turn processing effect
  useEffect(() => {
    if (gameOver) return;
    if (processingRef.current) return;
    if (isPaused) return;

    const currentUnit = getCurrentUnit();
    if (!currentUnit) return;

    // Mark as processing
    processingRef.current = true;
    setIsProcessingTurn(true);

    // Process status effects first
    const processTurn = () => {
      let unitAfterStatus = currentUnit;
      let unitDied = false;

      // Apply status effects
      if (currentUnit.team === "player") {
        const index = playerTeamRef.current.findIndex((p) => p.id === currentUnit.id);
        if (index !== -1) {
          unitAfterStatus = processStatusEffects(currentUnit);
          
          setPlayerTeam(prev => {
            const newTeam = [...prev];
            newTeam[index] = unitAfterStatus;
            return newTeam;
          });

          if (!unitAfterStatus.isAlive) {
            unitDied = true;
          }
        }
      } else {
        const index = enemyTeamRef.current.findIndex((e) => e.id === currentUnit.id);
        if (index !== -1) {
          unitAfterStatus = processStatusEffects(currentUnit);
          
          setEnemyTeam(prev => {
            const newTeam = [...prev];
            newTeam[index] = unitAfterStatus;
            return newTeam;
          });

          if (!unitAfterStatus.isAlive) {
            unitDied = true;
          }
        }
      }

      // If unit died from status, pause and advance
      if (unitDied) {
        setLog((prev) => [`${currentUnit.name} ha muerto`, ...prev]);
        setIsPaused(true);
        timeoutRef.current = setTimeout(() => {
          const isGameOver = checkGameOver();
          if (!isGameOver) {
            advanceToNextTurn();
          }
        }, 1500);
        return;
      }

      // Check if stunned
      if (unitAfterStatus.statusEffects.some((e) => e.type === "stunned")) {
        setLog((prev) => [`${currentUnit.name} está aturdido`, ...prev]);
        setIsPaused(true);
        timeoutRef.current = setTimeout(() => {
          advanceToNextTurn();
        }, 1500);
        return;
      }

      // Handle turn based on team
      if (unitAfterStatus.team === "enemy") {
        // Enemy turn - add small delay before action
        timeoutRef.current = setTimeout(() => {
          executeEnemyTurn(unitAfterStatus);
        }, 500);
      } else {
        // Player turn - wait for input
        setIsProcessingTurn(false);
        processingRef.current = false;
        setWaitingForPlayer(true);
      }
    };

    // Small delay before processing to make transitions visible
    timeoutRef.current = setTimeout(processTurn, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [currentTurnIndex, gameOver, isPaused, getCurrentUnit, processStatusEffects, checkGameOver, advanceToNextTurn, executeEnemyTurn]);

  const currentUnit = getCurrentUnit();

  const renderHp = (unit: BattleUnit) => {
    const percent = (unit.currentHp / unit.hp) * 100;

    return (
      <div style={{ width: "100px", background: "#333", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
        <div
          style={{
            width: `${percent}%`,
            height: "8px",
            background: unit.team === "player" ? "#4CAF50" : "#ff4444",
            transition: "width 0.3s ease"
          }}
        />
      </div>
    );
  };

  // Get the selected ability details
  const selectedAbilityDetails = selectedAbility !== null && currentUnit 
    ? currentUnit.abilities[selectedAbility] 
    : null;

  return (
    <div style={{ padding: "20px", color: "white", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>⚔️ System Battle</h1>

      {gameOver && (
        <div style={{ 
          textAlign: "center", 
          padding: "20px", 
          background: gameOver.includes("Victoria") ? "#4CAF50" : "#ff4444",
          borderRadius: "10px",
          marginBottom: "20px",
          fontSize: "24px",
          fontWeight: "bold"
        }}>
          {gameOver}
        </div>
      )}

      <div style={{ 
        textAlign: "center", 
        marginBottom: "20px",
        padding: "10px",
        background: "#2a2a2a",
        borderRadius: "5px"
      }}>
        <h3 style={{ margin: 0 }}>
          Turno: {currentUnit?.name} ({currentUnit?.team === "player" ? "⚔️ Player" : "👾 Enemy"})
          {isPaused && <span style={{ marginLeft: "10px", color: "#ffd700" }}>⏳ Pausa...</span>}
        </h3>
      </div>

      {/* ENEMY TEAM */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ borderBottom: "2px solid #ff4444", paddingBottom: "10px" }}>👾 Enemies</h2>
        <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
          {enemyTeam.map((e, i) => (
            <div 
              key={i} 
              style={{ 
                border: e.isAlive ? "2px solid #ff4444" : "2px solid #666", 
                padding: "15px",
                borderRadius: "8px",
                background: e.isAlive ? "#1a1a1a" : "#2a2a2a",
                opacity: e.isAlive ? 1 : 0.5,
                minWidth: "150px",
                transition: "all 0.3s ease"
              }}
            >
              <p style={{ fontWeight: "bold", fontSize: "18px", margin: "0 0 10px 0" }}>{e.name}</p>
              <p style={{ margin: "5px 0" }}>{e.isAlive ? `${e.currentHp}/${e.hp}` : "💀 KO"}</p>
              {renderHp(e)}

              {/* Status Effects */}
              {e.statusEffects.length > 0 && (
                <div style={{ fontSize: "11px", marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "3px" }}>
                  {e.statusEffects.map((s, j) => (
                    <span 
                      key={j} 
                      style={{ 
                        background: s.type === "shield" ? "#2196F3" : 
                                    s.type === "stunned" ? "#FFC107" : 
                                    s.type === "infected" ? "#9C27B0" : "#757575",
                        padding: "3px 6px",
                        borderRadius: "12px",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: "bold"
                      }}
                    >
                      {s.type} {s.duration}
                    </span>
                  ))}
                </div>
              )}

              {/* Enemy Targeting Button */}
              {waitingForPlayer && 
               currentUnit?.team === "player" && 
               selectedAbilityDetails?.target === "enemy" && 
               e.isAlive && !isPaused && !gameOver && (
                <button
                  onClick={() => handlePlayerAction(selectedAbilityDetails, currentUnit, i)}
                  style={{ 
                    marginTop: "15px", 
                    width: "100%",
                    background: "#ff4444",
                    color: "white",
                    border: "none",
                    padding: "8px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    transition: "transform 0.2s ease"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  🎯 Attack
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* BATTLE LOG */}
      <div style={{ 
        border: "1px solid #444", 
        padding: "15px", 
        height: "150px", 
        overflow: "auto",
        background: "#1a1a1a",
        marginBottom: "30px",
        borderRadius: "8px"
      }}>
        <h4 style={{ margin: "0 0 10px 0", color: "#aaa" }}>📜 Battle Log</h4>
        {log.map((l, i) => (
          <p key={i} style={{ margin: "3px 0", fontSize: "14px", color: "#ddd" }}>{l}</p>
        ))}
      </div>

      {/* PLAYER TEAM */}
      <div style={{ marginTop: "20px" }}>
        <h2 style={{ borderBottom: "2px solid #4CAF50", paddingBottom: "10px" }}>⚔️ Your Team</h2>
        <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
          {playerTeam.map((p, i) => (
            <div 
              key={i} 
              style={{ 
                border: p.isAlive ? "2px solid #4CAF50" : "2px solid #666", 
                padding: "15px",
                borderRadius: "8px",
                background: p.isAlive ? "#1a1a1a" : "#2a2a2a",
                opacity: p.isAlive ? 1 : 0.5,
                minWidth: "150px",
                transition: "all 0.3s ease"
              }}
            >
              <p style={{ fontWeight: "bold", fontSize: "18px", margin: "0 0 10px 0" }}>{p.name}</p>
              <p style={{ margin: "5px 0" }}>{p.isAlive ? `${p.currentHp}/${p.hp}` : "💀 KO"}</p>
              {renderHp(p)}

              {/* Status Effects */}
              {p.statusEffects.length > 0 && (
                <div style={{ fontSize: "11px", marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "3px" }}>
                  {p.statusEffects.map((s, j) => (
                    <span 
                      key={j} 
                      style={{ 
                        background: s.type === "shield" ? "#2196F3" : 
                                    s.type === "stunned" ? "#FFC107" : 
                                    s.type === "infected" ? "#9C27B0" : "#757575",
                        padding: "3px 6px",
                        borderRadius: "12px",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: "bold"
                      }}
                    >
                      {s.type} {s.duration}
                    </span>
                  ))}
                </div>
              )}

              {/* Player Targeting Button */}
              {waitingForPlayer && 
               currentUnit?.team === "player" && 
               selectedAbilityDetails?.target === "ally" && 
               p.isAlive && !isPaused && !gameOver && (
                <button
                  onClick={() => handlePlayerAction(selectedAbilityDetails, currentUnit, i)}
                  style={{ 
                    marginTop: "15px", 
                    width: "100%",
                    background: "#4CAF50",
                    color: "white",
                    border: "none",
                    padding: "8px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    transition: "transform 0.2s ease"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  ✨ Select
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ABILITY MENU */}
      <div style={{ marginTop: "30px", textAlign: "center" }}>
        {waitingForPlayer && currentUnit?.team === "player" && currentUnit.isAlive && !isPaused && !gameOver && (
          <>
            <h3>🎮 Select Ability</h3>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
              {currentUnit.abilities.map((ab, i) => (
                <button 
                  key={i} 
                  onClick={() => setSelectedAbility(i)}
                  style={{
                    padding: "15px 25px",
                    background: selectedAbility === i ? "#2196F3" : "#424242",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "16px",
                    transition: "all 0.2s ease",
                    transform: selectedAbility === i ? "scale(1.05)" : "scale(1)",
                    boxShadow: selectedAbility === i ? "0 4px 8px rgba(33, 150, 243, 0.3)" : "none"
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "5px" }}>{ab.name}</div>
                  <div style={{ fontSize: "13px", opacity: 0.9 }}>
                    {ab.type === "heal" ? `💚 Heal ${ab.power}` : `⚔️ Power ${ab.power}`}
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "3px" }}>
                    Target: {ab.target === "enemy" ? "👾 Enemy" : "⚔️ Ally"}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Show instruction based on selected ability */}
            {selectedAbilityDetails && (
              <div style={{ marginTop: "20px" }}>
                <p style={{ color: "#aaa", fontSize: "16px" }}>
                  {selectedAbilityDetails.target === "enemy" 
                    ? "👉 Click 'Attack' on an enemy to target them" 
                    : "👉 Click 'Select' on an ally to target them"}
                </p>
                
                {/* Cancel button */}
                <button
                  onClick={() => setSelectedAbility(null)}
                  style={{
                    marginTop: "10px",
                    padding: "8px 20px",
                    background: "#757575",
                    color: "white",
                    border: "none",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
        
        {currentUnit?.team === "enemy" && !isPaused && !gameOver && !waitingForPlayer && (
          <p style={{ color: "#ff4444", fontSize: "18px", animation: "pulse 1.5s infinite" }}>
            👾 Enemy turn in progress...
          </p>
        )}
        
        {isPaused && !gameOver && (
          <p style={{ color: "#ffd700", fontSize: "16px" }}>
            ⏳ Preparing next turn...
          </p>
        )}
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}