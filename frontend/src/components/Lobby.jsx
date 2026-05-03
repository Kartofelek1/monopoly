import React, { useState } from 'react';

const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#ef4444'];

function Lobby({ gameState, onJoin, onStart, error, socketId, onSettingsUpdate }) {
  const [roomIdInput, setRoomIdInput] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomIdInput && name) onJoin(roomIdInput.toUpperCase(), { name, color });
  };

  const isHost = gameState?.players?.[0]?.id === socketId;

  return (
    <div className="lobby-wrapper">
      <div className="lobby-glow-1" />
      <div className="lobby-glow-2" />

      <div className="lobby-card">
        <h1 className="lobby-title">BUSINESS <span>TOUR</span></h1>
        <p className="lobby-subtitle">Strategiczna Gra Online</p>

        {error && <div className="error-bar">{error}</div>}

        {!gameState ? (
          <form onSubmit={handleJoin} style={{ marginTop: 32 }}>
            <div className="form-group">
              <label className="form-label">Kod Pokoju</label>
              <input className="form-input code" type="text" maxLength={6} value={roomIdInput}
                onChange={e => setRoomIdInput(e.target.value)} placeholder="ABC123" />
            </div>
            <div className="form-group">
              <label className="form-label">Twój Nick</label>
              <input className="form-input" type="text" value={name}
                onChange={e => setName(e.target.value)} placeholder="Podaj pseudonim..." />
            </div>
            <div className="form-group">
              <label className="form-label">Kolor Pionka</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <button key={c} type="button" className={`color-dot ${color === c ? 'active' : ''}`}
                    style={{ background: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Wejdź do gry ▶</button>
          </form>
        ) : (
          <div style={{ marginTop: 32 }}>
            <div className="room-code-display">
              <p className="form-label">Twój Pokój</p>
              <p className="code">{gameState.roomId}</p>
            </div>

            <div style={{ margin: '24px 0' }}>
              <p className="form-label">Gracze ({gameState.players.length}/4)</p>
              <div className="players-grid">
                {gameState.players.map(p => (
                  <div key={p.id} className="player-chip">
                    <div className="avatar" style={{ background: p.color }}>{p.avatar}</div>
                    <span className="name">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <div style={{ margin: '24px 0', background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12 }}>
                <p className="form-label" style={{ marginBottom: 10 }}>Ustawienia Pokoju</p>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 11 }}>Początkowa gotówka ($)</label>
                  <select className="form-input" value={gameState.settings?.startingMoney || 1500} 
                    onChange={e => onSettingsUpdate({ startingMoney: parseInt(e.target.value) })}>
                    <option value={1000}>$1000 (Szybka gra)</option>
                    <option value={1500}>$1500 (Klasyczna gra)</option>
                    <option value={2000}>$2000</option>
                    <option value={3000}>$3000</option>
                  </select>
                </div>
              </div>
            )}
            
            {!isHost && (
              <div style={{ margin: '24px 0', textAlign: 'center' }}>
                <p style={{ color: 'var(--text2)', fontSize: 13 }}>
                  Kapitał startowy: <strong>${gameState.settings?.startingMoney || 1500}</strong>
                </p>
              </div>
            )}

            {isHost ? (
              <button className="btn btn-primary" onClick={onStart}
                disabled={gameState.players.length < 2}>Rozpocznij Mecz</button>
            ) : (
              <p className="waiting-text">Czekam na start przez hosta...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
