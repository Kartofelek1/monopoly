import React, { useState } from 'react';

const BUILD_COSTS = { BROWN: 50, LIGHTBLUE: 50, PINK: 100, ORANGE: 100, RED: 150, YELLOW: 150, GREEN: 200, DARKBLUE: 200 };

function PlayerDashboard({ gameState, socketId, socket }) {
  const [chatMessage, setChatMessage] = useState('');
  const [showTrade, setShowTrade] = useState(false);
  const [tradeTarget, setTradeTarget] = useState(null);
  const [tradeOfferMoney, setTradeOfferMoney] = useState(0);
  const [tradeRequestMoney, setTradeRequestMoney] = useState(0);
  const [tradeOfferProps, setTradeOfferProps] = useState([]);
  const [tradeRequestProps, setTradeRequestProps] = useState([]);

  if (!gameState?.players?.length || !gameState?.board) return null;

  const me = gameState.players.find(p => p.id === socketId);
  const isMyTurn = gameState.players[gameState.turnIndex]?.id === socketId;
  const turnPlayer = gameState.players[gameState.turnIndex] || { name: '...' };

  const handleRoll = () => socket.emit('roll_dice', gameState.roomId);
  const handleEnd = () => socket.emit('end_turn', gameState.roomId);
  const handleBuy = (housesCount = 0) => socket.emit('buy_property', { roomId: gameState.roomId, housesCount });
  const handleDecline = () => socket.emit('decline_property', gameState.roomId);
  const handleWorldCup = (pid) => socket.emit('host_world_cup', { roomId: gameState.roomId, propertyId: pid });
  const handleBuild = (pid) => socket.emit('build_house', { roomId: gameState.roomId, propertyId: pid });
  const handleSkipUpgrade = () => socket.emit('skip_upgrade', gameState.roomId);
  const handleBail = () => socket.emit('pay_jail_bail', gameState.roomId);
  const handleSell = (pid) => socket.emit('sell_property', { roomId: gameState.roomId, propertyId: pid });

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      socket.emit('send_message', { roomId: gameState.roomId, text: chatMessage, sender: me?.name || 'Anonim' });
      setChatMessage('');
    }
  };

  const handleSendTrade = () => {
    if (!tradeTarget) return;
    socket.emit('propose_trade', {
      roomId: gameState.roomId, toId: tradeTarget,
      offerMoney: tradeOfferMoney, offerProps: tradeOfferProps,
      requestMoney: tradeRequestMoney, requestProps: tradeRequestProps
    });
    setShowTrade(false);
    setTradeOfferMoney(0); setTradeRequestMoney(0);
    setTradeOfferProps([]); setTradeRequestProps([]);
  };

  const handleRespondTrade = (accept) => {
    socket.emit('respond_trade', { roomId: gameState.roomId, accept });
  };

  const toggleProp = (list, setList, pid) => {
    setList(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
  };

  const field = me ? gameState.board[me.position] : null;
  const canBuy = isMyTurn && field &&
    ['PROPERTY','STATION','UTILITY'].includes(field.type) &&
    !field.ownerId && me.money >= field.price;

  const auction = gameState.auctions?.active ? gameState.auctions : null;
  const auctionProp = auction ? gameState.board[auction.propertyId] : null;

  const upgrade = gameState.pendingUpgrade;
  const upgradeField = upgrade ? gameState.board[upgrade.fieldId] : null;
  const canUpgrade = upgrade && upgrade.playerId === socketId && upgradeField;

  const trade = gameState.pendingTrade;
  const tradeForMe = trade && trade.toId === socketId;

  const otherPlayers = gameState.players.filter(p => p.id !== socketId && !p.isBankrupt);

  return (
    <div className="side-panel">
      {/* Header */}
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <p className="turn-name">Aktualna Tura</p>
            <h2>{turnPlayer.name}</h2>
          </div>
          <div>
            <div className={`timer ${gameState.turnTimer < 10 ? 'danger' : ''}`}>{gameState.turnTimer}s</div>
            <p className="timer-label">Pozostały czas</p>
          </div>
        </div>
      </div>

      {/* Players */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {gameState.players.map((p, idx) => {
          const active = idx === gameState.turnIndex;
          return (
            <div key={p.id} className={`player-card ${active ? 'active' : ''}`}>
              <div className="p-avatar" style={{ background: p.color }}>
                {p.avatar}
                {active && <div className="ping" />}
              </div>
              <div className="p-info">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="p-name">
                    {p.name}
                    {p.id === socketId && <span className="badge badge-you">TY</span>}
                    {p.inJail && <span className="badge badge-jail">🔒</span>}
                  </span>
                  <span className="p-money">${p.money}</span>
                </div>
                <div className="p-stats">{p.properties.length} nieruchomości</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="panel-card actions-card">
        <div className="actions-title">⚡ Centrum Dowodzenia</div>
        <div className="actions-body">

          {isMyTurn ? (
            <>
              <div className="btn-row">
                <button className="btn btn-dice" onClick={handleRoll} disabled={gameState.hasRolled}>🎲 Rzuć Kośćmi</button>
                <button className="btn btn-end" onClick={handleEnd}>Zakończ</button>
              </div>

              {/* Upgrade prompt */}
              {canUpgrade && (
                <div className="buy-offer">
                  <div className="offer-header">
                    <span className="offer-label">🏗️ Ulepsz!</span>
                    <span className="offer-price">${BUILD_COSTS[upgradeField.colorGroup] || 100}</span>
                  </div>
                  <p className="offer-name">
                    {upgradeField.name} — aktualnie {upgradeField.buildings || 0}/5 budynków
                  </p>
                  <div className="btn-row">
                    <button className="btn btn-green" onClick={() => handleBuild(upgrade.fieldId)}>BUDUJ</button>
                    <button className="btn btn-ghost" onClick={handleSkipUpgrade}>POMIŃ</button>
                  </div>
                </div>
              )}

              {/* Buy prompt */}
              {canBuy && (() => {
                const buildCost = field.colorGroup ? (
                  field.colorGroup === 'BROWN' || field.colorGroup === 'LIGHTBLUE' ? 50 :
                  field.colorGroup === 'PINK' || field.colorGroup === 'ORANGE' ? 100 :
                  field.colorGroup === 'RED' || field.colorGroup === 'YELLOW' ? 150 : 200
                ) : 0;
                
                return (
                  <div className="buy-offer">
                    <div className="offer-header">
                      <span className="offer-label">🏠 Okazja!</span>
                      <span className="offer-price">${field.price}</span>
                    </div>
                    <p className="offer-name">Możesz kupić: <strong>{field.name}</strong></p>
                    <div className="btn-column" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button className="btn btn-green" onClick={() => handleBuy(0)}>KUP (${field.price})</button>
                      
                      {field.type === 'PROPERTY' && (
                        <>
                          <button className="btn btn-primary" onClick={() => handleBuy(1)} 
                            disabled={me.money < field.price + buildCost}>
                            KUP Z 1 DOMEM (${field.price + buildCost})
                          </button>
                          <button className="btn btn-primary" onClick={() => handleBuy(2)} 
                            disabled={me.money < field.price + buildCost * 2}>
                            KUP Z 2 DOMAMI (${field.price + buildCost * 2})
                          </button>
                        </>
                      )}
                      <button className="btn btn-ghost" onClick={handleDecline}>POMIŃ</button>
                    </div>
                  </div>
                );
              })()}

              {/* World Cup hosting */}
              {gameState.pendingWorldCup === socket.id && (
                <div className="buy-offer" style={{ border: '2px solid var(--gold)' }}>
                  <div className="offer-header">
                    <span className="offer-label" style={{ color: 'var(--gold)' }}>🏆 MISTRZOSTWA ŚWIATA</span>
                    <span className="offer-price">$200</span>
                  </div>
                  <p className="offer-name">Wybierz miasto, które ugości Mistrzostwa (mnożnik czynszu wzrośnie!):</p>
                  <div className="forced-sell-list" style={{ marginTop: 10 }}>
                    {me.properties.map(pid => (
                      <div key={pid} className="trade-prop-item" style={{ padding: '6px 10px' }}>
                        <span>{gameState.board[pid].name}</span>
                        <button className="btn btn-green" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => handleWorldCup(pid)}>WYBIERZ</button>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-ghost" style={{ marginTop: 10, width: '100%' }} onClick={handleDecline}>POMIŃ</button>
                </div>
              )}
              {/* Jail Bail */}
              {me.inJail && !gameState.hasRolled && (
                <div className="buy-offer" style={{ marginTop: 12 }}>
                  <p className="offer-name">Siedzisz w więzieniu!</p>
                  <button className="btn btn-primary" onClick={handleBail} disabled={me.money < 200}>
                    Wykup się ($200)
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="waiting-spinner">
              <div className="spinner-circle" />
              <p>Oczekiwanie na ruch {turnPlayer.name}...</p>
            </div>
          )}
        </div>
      </div>


      {/* Trade Modal */}
      {showTrade && (
        <div className="panel-card trade-modal">
          <div className="actions-title">🤝 Propozycja Wymiany</div>

          <div className="form-group">
            <label className="form-label">Gracz docelowy</label>
            <select className="form-input" value={tradeTarget || ''} onChange={e => setTradeTarget(e.target.value)}>
              <option value="">Wybierz gracza...</option>
              {otherPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="trade-columns">
            <div className="trade-col">
              <span className="trade-col-label">Oferujesz ($):</span>
              <input className="form-input" type="number" min="0" value={tradeOfferMoney}
                onChange={e => setTradeOfferMoney(parseInt(e.target.value) || 0)} />
              <span className="trade-col-label" style={{ marginTop: 8 }}>Twoje posiadłości:</span>
              {(me?.properties || []).map(pid => {
                const pr = gameState.board[pid];
                return (
                  <label key={pid} className={`trade-prop-item ${tradeOfferProps.includes(pid) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={tradeOfferProps.includes(pid)}
                      onChange={() => toggleProp(tradeOfferProps, setTradeOfferProps, pid)} />
                    {pr.name}
                  </label>
                );
              })}
            </div>
            <div className="trade-col">
              <span className="trade-col-label">Żądasz ($):</span>
              <input className="form-input" type="number" min="0" value={tradeRequestMoney}
                onChange={e => setTradeRequestMoney(parseInt(e.target.value) || 0)} />
              {tradeTarget && (
                <>
                  <span className="trade-col-label" style={{ marginTop: 8 }}>Ich posiadłości:</span>
                  {(gameState.players.find(p => p.id === tradeTarget)?.properties || []).map(pid => {
                    const pr = gameState.board[pid];
                    return (
                      <label key={pid} className={`trade-prop-item ${tradeRequestProps.includes(pid) ? 'selected' : ''}`}>
                        <input type="checkbox" checked={tradeRequestProps.includes(pid)}
                          onChange={() => toggleProp(tradeRequestProps, setTradeRequestProps, pid)} />
                        {pr.name}
                      </label>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-green" onClick={handleSendTrade} disabled={!tradeTarget}>Wyślij Ofertę</button>
            <button className="btn btn-ghost" onClick={() => setShowTrade(false)}>Anuluj</button>
          </div>
        </div>
      )}

      {/* Chat przeniesiony pod planszę */}

      {/* Trade Button at the very bottom */}
      {!showTrade && otherPlayers.length > 0 && (
        <button className="btn btn-trade" onClick={() => setShowTrade(true)} style={{ marginBottom: 10 }}>
          🤝 Zaproponuj Wymianę
        </button>
      )}
    </div>

  );
}

export default PlayerDashboard;
