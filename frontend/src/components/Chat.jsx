import React, { useState } from 'react';

function Chat({ gameState, socket, socketId }) {
  const [chatMessage, setChatMessage] = useState('');

  const me = gameState.players?.find(p => p.id === socketId);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (chatMessage.trim() && me) {
      socket.emit('send_message', { roomId: gameState.roomId, text: chatMessage, sender: me.name });
      setChatMessage('');
    }
  };

  return (
    <div className="panel-card chat-card board-chat">
      <div className="chat-messages">
        {(gameState.messages || []).slice().reverse().map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.system ? 'system' : ''}`}>
            {!msg.system && <span className="sender">{msg.sender}:</span>}
            {msg.text}
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleSendMessage}>
        <input className="chat-input" type="text" value={chatMessage}
          onChange={e => setChatMessage(e.target.value)} placeholder="Napisz wiadomość..." />
        <button type="submit" className="chat-send">Wyślij</button>
      </form>
    </div>
  );
}

export default Chat;
