import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Board from './components/Board';
import PlayerDashboard from './components/PlayerDashboard';
import Chat from './components/Chat';

const socket = io('https://monopoly-fcqp.onrender.com');

function App() {
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('room_update', (room) => {
      setGameState(room);
      setError('');
    });

    socket.on('error', (msg) => setError(msg));
    socket.on('dice_rolled', () => { }); // handled via room_update

    return () => {
      socket.off('room_update');
      socket.off('error');
      socket.off('dice_rolled');
    };
  }, []);

  const handleJoin = (roomId, playerInfo) => {
    socket.emit('join_room', { roomId, playerInfo });
  };

  const handleStart = () => {
    if (gameState) socket.emit('start_game', gameState.roomId);
  };

  const handleRespondTrade = (accept) => {
    socket.emit('respond_trade', { roomId: gameState.roomId, accept });
  };

  const handleSell = (pid) => {
    socket.emit('sell_property', { roomId: gameState.roomId, propertyId: pid });
  };

  const handleBankruptcy = () => {
    socket.emit('declare_bankruptcy', gameState.roomId);
  };

  const handleUpdateSettings = (settings) => {
    socket.emit('update_settings', { roomId: gameState.roomId, settings });
  };

  if (!gameState || gameState.status === 'LOBBY') {
    return (
      <Lobby gameState={gameState} onJoin={handleJoin} onStart={handleStart}
        error={error} socketId={socket.id} onSettingsUpdate={handleUpdateSettings} />
    );
  }

  // Global Trade Modal
  const trade = gameState.pendingTrade;
  const tradeForMe = trade && trade.toId === socket.id;

  // Debt/Bankruptcy Modal
  const me = gameState.players.find(p => p.id === socket.id);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socket.id;
  const inDebt = me && me.money < 0 && !me.isBankrupt;

  return (
    <div className="game-layout">
      {/* Trade Modal */}
      {tradeForMe && (
        <div className="modal-overlay">
          <div className="global-modal">
            <h2 className="modal-title">🤝 Propozycja Wymiany</h2>
            <p style={{ textAlign: 'center', color: 'var(--text2)', marginBottom: 24 }}>
              Gracz <strong>{gameState.players.find(p => p.id === trade.fromId)?.name}</strong> przesyła ofertę:
            </p>
            <div className="trade-summary" style={{ gap: 24, marginBottom: 32 }}>
              <div className="trade-col" style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 20 }}>
                <span className="trade-col-label">Oferuje Tobie:</span>
                <div style={{ marginTop: 12 }}>
                  {trade.offerMoney > 0 && <span className="trade-item money" style={{ fontSize: 24, padding: '12px 20px' }}>${trade.offerMoney}</span>}
                  {trade.offerProps.map(pid => <span key={pid} className="trade-item" style={{ fontSize: 14, padding: '10px 16px' }}>{gameState.board[pid].name}</span>)}
                  {trade.offerMoney === 0 && trade.offerProps.length === 0 && <span className="trade-item dim">Nic</span>}
                </div>
              </div>
              <div className="trade-col" style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 20 }}>
                <span className="trade-col-label">Chce od Ciebie:</span>
                <div style={{ marginTop: 12 }}>
                  {trade.requestMoney > 0 && <span className="trade-item money" style={{ fontSize: 24, padding: '12px 20px' }}>${trade.requestMoney}</span>}
                  {trade.requestProps.map(pid => <span key={pid} className="trade-item" style={{ fontSize: 14, padding: '10px 16px' }}>{gameState.board[pid].name}</span>)}
                  {trade.requestMoney === 0 && trade.requestProps.length === 0 && <span className="trade-item dim">Nic</span>}
                </div>
              </div>
            </div>
            <div className="btn-row" style={{ gap: 16 }}>
              <button className="btn btn-primary" style={{ padding: 20 }} onClick={() => handleRespondTrade(true)}>AKCEPTUJ OFERTĘ</button>
              <button className="btn btn-ghost" style={{ padding: 20 }} onClick={() => handleRespondTrade(false)}>ODRZUĆ</button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Modal */}
      {inDebt && (
        <div className="modal-overlay">
          <div className="global-modal debt-modal" style={{ borderColor: 'var(--red)' }}>
            <h2 className="modal-title" style={{ color: 'var(--red)' }}>⚠️ BRAK ŚRODKÓW!</h2>
            <div className="debt-amount">TWOJE SALDO: <span className="negative">${me.money}</span></div>
            <p style={{ textAlign: 'center', color: 'var(--text2)', marginBottom: 24 }}>
              Musisz spłacić zadłużenie, aby kontynuować grę.
            </p>

            {me.properties.length > 0 ? (
              <div className="forced-sell-list">
                <p className="modal-sublabel">Wybierz posiadłość do sprzedaży (otrzymasz 50% wartości):</p>
                <div className="sell-items">
                  {me.properties.map(pid => {
                    const field = gameState.board[pid];
                    const sellPrice = Math.floor(field.price * 0.5);
                    return (
                      <div key={pid} className="sell-item">
                        <div className="sell-item-info">
                          <span className="sell-item-name">{field.name}</span>
                          <span className="sell-item-price">+${sellPrice}</span>
                        </div>
                        <button className="btn btn-red" onClick={() => handleSell(pid)}>SPRZEDAJ</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bankruptcy-notice">
                <p>Nie masz już żadnych posiadłości, które mógłbyś sprzedać.</p>
                <button className="btn btn-red" style={{ width: '100%', padding: 20, fontSize: 18 }} onClick={handleBankruptcy}>
                  OGŁOŚ BANKRUCTWO
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.status === 'FINISHED' && (
        <div className="modal-overlay">
          <div className="global-modal">
            <h2 className="modal-title">🏆 KONIEC GRY</h2>
            <p style={{ fontSize: 24, textAlign: 'center', marginBottom: 32 }}>Zwycięzca: <strong>{gameState.players.find(p => !p.isBankrupt)?.name}</strong></p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>WRÓĆ DO MENU</button>
          </div>
        </div>
      )}

      <PlayerDashboard gameState={gameState} socketId={socket.id} socket={socket} />
      <div className="board-column">
        <Board gameState={gameState} />
        <Chat gameState={gameState} socket={socket} socketId={socket.id} />
      </div>
    </div>
  );
}

export default App;
