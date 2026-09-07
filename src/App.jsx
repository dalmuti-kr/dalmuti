import { useState, useEffect } from 'react';
import './index.css';
import { db } from './firebase'; 
import { ref, set, get, child } from 'firebase/database';
import GameBoard from './components/GameBoard';
import HistoryModal from './components/HistoryModal';

function App() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [modalPassword, setModalPassword] = useState('');

  useEffect(() => {
    const checkReconnect = async () => {
      const savedNickname = localStorage.getItem('dalmuti_nickname');
      const savedRoom = localStorage.getItem('dalmuti_roomCode');
      
      if (savedNickname && savedRoom) {
        try {
          const snapshot = await get(child(ref(db), `rooms/${savedRoom}`));
          if (snapshot.exists()) {
            const roomData = snapshot.val();
            if (roomData.players && roomData.players[savedNickname]) {
              setNickname(savedNickname);
              setRoomCode(savedRoom);
              setIsJoined(true);
            } else {
              localStorage.removeItem('dalmuti_nickname');
              localStorage.removeItem('dalmuti_roomCode');
            }
          } else {
            localStorage.removeItem('dalmuti_nickname');
            localStorage.removeItem('dalmuti_roomCode');
          }
        } catch (err) {
          console.error("Reconnect failed", err);
        }
      }
      setIsChecking(false);
    };
    
    checkReconnect();
  }, []);

  const saveToLocal = (name, code) => {
    localStorage.setItem('dalmuti_nickname', name);
    localStorage.setItem('dalmuti_roomCode', code);
  };

  const handleLeave = () => {
    localStorage.removeItem('dalmuti_nickname');
    localStorage.removeItem('dalmuti_roomCode');
    setIsJoined(false);
    setNickname('');
    setRoomCode('');
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoomClick = () => {
    if (!nickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    setError('');
    setModalPassword('');
    setShowCreateModal(true);
  };

  const confirmCreateRoom = async () => {
    const requiredPassword = import.meta.env.VITE_ROOM_PASSWORD || 'dalmuti';
    
    if (modalPassword !== requiredPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setShowCreateModal(false);
      return;
    }

    setShowCreateModal(false);
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
      saveToLocal(nickname, code);
      setIsJoined(true);
      setError('');
    } catch (err) {
      setError('방 생성에 실패했습니다. Firebase 설정을 확인해주세요.');
      console.error(err);
    }
  };

  const handleHistoryClick = () => {
    setError('');
    setModalPassword('');
    setShowHistoryModal(true);
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
        
        // 기존 플레이어의 재접속 시도인지 확인
        const isExistingPlayer = roomData.players && roomData.players[nickname];
        
        // 게임이 이미 시작되었는데 신규 유저라면 차단
        if (roomData.status !== 'waiting' && !isExistingPlayer) {
          setError('이미 게임이 시작된 방이며, 신규 참가가 불가능합니다.');
          return;
        }
        
        if (!isExistingPlayer) {
          const playerRef = ref(db, `rooms/${roomCode}/players/${nickname}`);
          await set(playerRef, { isHost: false, isReady: false });
        }
        
        saveToLocal(nickname, roomCode);
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

  if (isChecking) {
    return <div className="lobby-container"><h2 className="lobby-title" style={{fontSize:'2rem'}}>Connecting...</h2></div>;
  }

  if (isJoined) {
    return <GameBoard roomCode={roomCode} nickname={nickname} onLeave={handleLeave} />;
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
        
        <button className="btn" onClick={handleCreateRoomClick}>새로운 방 만들기</button>
        
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

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button className="btn btn-secondary" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', fontSize: '0.8rem', padding: '0.5rem' }} onClick={handleHistoryClick}>
            📜 전체 과거 기록 조회
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-color)' }}>방 생성 비밀번호</h3>
            <input
              type="password"
              className="input"
              placeholder="비밀번호 입력"
              value={modalPassword}
              onChange={(e) => setModalPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreateRoom()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>취소</button>
              <button className="btn" onClick={confirmCreateRoom}>확인</button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <HistoryModal 
          onClose={() => setShowHistoryModal(false)} 
          password={modalPassword} 
          setPassword={setModalPassword}
        />
      )}
    </div>
  );
}

export default App;
