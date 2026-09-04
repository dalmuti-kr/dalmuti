import { useState } from 'react';
import './index.css';
import { db } from './firebase'; 
import { ref, set, get, child } from 'firebase/database';
import GameBoard from './components/GameBoard';

function App() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState('');

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createRoom = async () => {
    if (!nickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    
    const requiredPassword = import.meta.env.VITE_ROOM_PASSWORD || 'dalmuti';
    const pwd = window.prompt('방 생성을 위한 비밀번호를 입력하세요:');
    
    if (pwd !== requiredPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    const code = generateRoomCode();
    try {
      const roomRef = ref(db, `rooms/${code}`);
      await set(roomRef, {
        status: 'waiting',
        players: {
          [nickname]: { isHost: true, isReady: true }
        }
      });
      setRoomCode(code);
      setIsJoined(true);
      setError('');
    } catch (err) {
      setError('방 생성에 실패했습니다. Firebase 설정을 확인해주세요.');
      console.error(err);
    }
  };

  const joinRoom = async () => {
    if (!nickname || !roomCode) {
      setError('닉네임과 입장 코드를 모두 입력해주세요.');
      return;
    }
    
    try {
      const dbRef = ref(db);
      const snapshot = await get(child(dbRef, `rooms/${roomCode}`));
      
      if (snapshot.exists()) {
        const roomData = snapshot.val();
        if (roomData.status !== 'waiting') {
          setError('이미 게임이 시작된 방입니다.');
          return;
        }
        
        const playerRef = ref(db, `rooms/${roomCode}/players/${nickname}`);
        await set(playerRef, { isHost: false, isReady: false });
        
        setIsJoined(true);
        setError('');
      } else {
        setError('존재하지 않는 방입니다.');
      }
    } catch (err) {
      setError('방 입장에 실패했습니다. Firebase 설정을 확인해주세요.');
      console.error(err);
    }
  };

  if (isJoined) {
    return <GameBoard roomCode={roomCode} nickname={nickname} onLeave={() => setIsJoined(false)} />;
  }

  return (
    <div className="lobby-container">
      <h1 className="lobby-title">DALMUTI</h1>
      <p className="philosophy-text">Das Leben ist ungerecht</p>
      
      <div className="lobby-card">
        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="nickname">닉네임</label>
          <input 
            type="text" 
            id="nickname" 
            className="input" 
            placeholder="사용할 이름을 입력하세요"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        
        <button className="btn" onClick={createRoom}>새로운 방 만들기</button>
        
        <div className="divider">또는</div>
        
        <div className="form-group">
          <label htmlFor="roomcode">입장 코드</label>
          <input 
            type="text" 
            id="roomcode" 
            className="input" 
            placeholder="6자리 코드 입력"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
        </div>
        
        <button className="btn btn-secondary" onClick={joinRoom}>방 입장하기</button>
      </div>
    </div>
  );
}

export default App;
