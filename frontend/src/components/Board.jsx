import React, { useState, useEffect, useRef } from 'react';

const COLOR_MAP = {
  BROWN: '#92400e', LIGHTBLUE: '#38bdf8', PINK: '#f472b6', ORANGE: '#fb923c',
  RED: '#ef4444', YELLOW: '#facc15', GREEN: '#4ade80', DARKBLUE: '#3b82f6'
};

function Board({ gameState }) {
  const [isRolling, setIsRolling] = useState(false);
  const [visualPositions, setVisualPositions] = useState({});
  const [selectedField, setSelectedField] = useState(null);
  const prevDice = useRef([0, 0]);
  const animationIntervals = useRef({});

  useEffect(() => {
    const d = gameState?.diceResult;
    if (d && (d[0] !== prevDice.current[0] || d[1] !== prevDice.current[1]) && d[0] > 0) {
      prevDice.current = [...d];
      setIsRolling(true);
      const t = setTimeout(() => setIsRolling(false), 600);
      return () => clearTimeout(t);
    }
  }, [gameState?.diceResult?.[0], gameState?.diceResult?.[1]]);

  useEffect(() => {
    if (!gameState?.players) return;
    gameState.players.forEach(p => {
      const targetPos = p.position;
      const currentVisual = visualPositions[p.id] ?? targetPos;
      if (currentVisual !== targetPos) {
        if (animationIntervals.current[p.id]) clearInterval(animationIntervals.current[p.id]);
        const diff = (targetPos - currentVisual + 40) % 40;
        if (diff > 12) {
          setVisualPositions(prev => ({ ...prev, [p.id]: targetPos }));
        } else {
          animationIntervals.current[p.id] = setInterval(() => {
            setVisualPositions(prev => {
              const current = prev[p.id] ?? currentVisual;
              if (current === targetPos) {
                clearInterval(animationIntervals.current[p.id]);
                return prev;
              }
              const next = (current + 1) % 40;
              if (next === targetPos) clearInterval(animationIntervals.current[p.id]);
              return { ...prev, [p.id]: next };
            });
          }, 300);
        }
      }
    });
    return () => Object.values(animationIntervals.current).forEach(clearInterval);
  }, [gameState?.players]);

  if (!gameState?.board) return null;

  return (
    <div className="monopoly-board">
      {gameState.board.map(field => {
        const playersHere = gameState.players.filter(p => (visualPositions[p.id] ?? p.position) === field.id);
        return (
          <div key={field.id} className={`board-cell cell-${field.id}`} onClick={() => setSelectedField(field)}>
            {field.type === 'PROPERTY' && (
              <div className="cell-color-bar" style={{ background: COLOR_MAP[field.colorGroup] }} />
            )}
            <div className="cell-info">
              <span className="cell-name">{field.name}</span>
              {field.ownerId ? (
                <span className="cell-rent" style={{ color: 'var(--green)', fontWeight: 'bold' }}>
                  ${gameState.worldCup?.fieldId === field.id ?
                    (field.rentConfig ? field.rentConfig[field.buildings || 0] * gameState.worldCup.multiplier : 0) :
                    (field.rentConfig ? field.rentConfig[field.buildings || 0] : 0)}
                </span>
              ) : field.price != null && (
                <span className="cell-price">${field.price}</span>
              )}

              {gameState.worldCup?.fieldId === field.id && (
                <div className="world-cup-badge">🏆 x{gameState.worldCup.multiplier}</div>
              )}

              {(field.buildings || 0) > 0 && (
                <div className="cell-buildings">
                  {Array.from({ length: field.buildings }).map((_, i) => <span key={i}>🏠</span>)}
                </div>
              )}
            </div>
            <div className="pawns-container">
              {playersHere.map(p => (
                <div key={p.id} className="pawn" style={{ background: p.color }}>{p.avatar}</div>
              ))}
            </div>
            {field.ownerId && (() => {
              const owner = gameState.players.find(p => p.id === field.ownerId);
              return owner ? (
                <>
                  <div className="cell-owner-bar" style={{ background: owner.color }} />
                  <div className="cell-owner-icon" style={{ borderColor: owner.color }}>
                    {owner.avatar}
                  </div>
                </>
              ) : null;
            })()}
          </div>
        );
      })}

      {/* Center */}
      <div className="board-center">
        <span className="board-center-title">BUSINESS TOUR</span>

        {gameState.announcement && (
          <div className="announcement-overlay">
            <div className={`announcement-text ${gameState.announcement.type?.toLowerCase()}`}>
              {gameState.announcement.text}
            </div>
          </div>
        )}

        <div className="dice-area">
          {isRolling ? (
            <div className="dice-row">
              <div className="die-rolling" /><div className="die-rolling" />
            </div>
          ) : gameState.diceResult?.[0] > 0 ? (
            <>
              <div className="dice-row"><Die value={gameState.diceResult[0]} /><Die value={gameState.diceResult[1]} /></div>
              {gameState.doublesCount > 0 && <div className="double-badge">Dublet x{gameState.doublesCount}</div>}
            </>
          ) : (
            <div className="dice-waiting">Czekam na rzut...</div>
          )}
        </div>
      </div>

      {/* Property Details Modal */}
      {selectedField && (
        <div className="modal-overlay" onClick={() => setSelectedField(null)}>
          <div className="global-modal property-details" onClick={e => e.stopPropagation()}>
            <div className="property-header" style={{ background: COLOR_MAP[selectedField.colorGroup] || '#334155' }}>
              <div className="property-title">KARTA WŁASNOŚCI</div>
              <div className="property-name">{selectedField.name}</div>
            </div>
            <div className="property-body">
              {selectedField.description && (
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: 16, borderRadius: 12, marginBottom: 16, fontSize: 13, lineHeight: 1.5, borderLeft: '3px solid var(--accent)' }}>
                  {selectedField.description}
                </div>
              )}
              {selectedField.rentConfig ? (
                selectedField.type === 'PROPERTY' ? (
                  <>
                    <div className="rent-row base"><span>Czynsz (bez domów)</span> <strong>${selectedField.rentConfig[0]}</strong></div>
                    <div className="rent-row"><span>Z 1 domem</span> <strong>${selectedField.rentConfig[1]}</strong></div>
                    <div className="rent-row"><span>Z 2 domami</span> <strong>${selectedField.rentConfig[2]}</strong></div>
                    <div className="rent-row"><span>Z 3 domami</span> <strong>${selectedField.rentConfig[3]}</strong></div>
                    <div className="rent-row"><span>Z 4 domami</span> <strong>${selectedField.rentConfig[4]}</strong></div>
                    <div className="rent-row hotel"><span>Z HOTELEM</span> <strong>${selectedField.rentConfig[5]}</strong></div>
                    <div className="property-divider" />
                    <div className="rent-row info"><span>Cena zakupu</span> <span>${selectedField.price}</span></div>
                    <div className="rent-row info"><span>Cena budowy domu</span> <span>${selectedField.colorGroup ? { BROWN: 50, LIGHTBLUE: 50, PINK: 100, ORANGE: 100, RED: 150, YELLOW: 150, GREEN: 200, DARKBLUE: 200 }[selectedField.colorGroup] : 100}</span></div>
                  </>
                ) : selectedField.type === 'STATION' ? (
                  <>
                    <div className="rent-row base"><span>Czynsz (1 stacja)</span> <strong>${selectedField.rentConfig[0]}</strong></div>
                    <div className="rent-row"><span>Czynsz (2 stacje)</span> <strong>${selectedField.rentConfig[1]}</strong></div>
                    <div className="rent-row"><span>Czynsz (3 stacje)</span> <strong>${selectedField.rentConfig[2]}</strong></div>
                    <div className="rent-row"><span>Czynsz (4 stacje)</span> <strong>${selectedField.rentConfig[3]}</strong></div>
                    <div className="property-divider" />
                    <div className="rent-row info"><span>Cena zakupu</span> <span>${selectedField.price}</span></div>
                  </>
                ) : null
              ) : !selectedField.description && (
                <p style={{ textAlign: 'center', padding: 20 }}>To pole nie posiada czynszu opartego na budynkach.</p>
              )}
            </div>
            <button className="btn btn-ghost" onClick={() => setSelectedField(null)} style={{ marginTop: 20 }}>ZAMKNIJ</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Die({ value }) {
  return <div className="die">{Array.from({ length: value }).map((_, i) => <div key={i} className="dot" />)}</div>;
}

export default Board;
