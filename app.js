/**
 * 자리왕 배틀 & 스마트 학급 자리 관리 시스템
 * - PeerJS 기반 실시간 채널(방 코드) 멀티플레이 (교사 Host ↔ 학생 태블릿)
 * - 교사 비밀 조작(지정 배치) 엔진: 앞자리 고정, 기피 학생 분리, 남녀 밸런스
 * - 학생들에게 완전 랜덤으로 위장하는 마술 룰렛(Fake Roulette) 연출
 */

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
const state = {
  currentScreen: 'lobby', // lobby, room-join, waiting, game, ranking, seat-pick, reveal, admin, admin-login
  isHost: false,          // true: 교사(전자칠판/교탁), false: 학생(태블릿)
  roomId: '',             // 4~6자리 룸 코드
  peer: null,             // PeerJS 인스턴스
  hostConn: null,         // 학생 -> 교사 연결
  clientConns: [],        // 교사 -> 각 학생 연결들
  
  // 관리자 PIN
  adminPin: '100402',
  
  // 학급 기본 데이터 (총 25명: 남 10, 여 15)
  students: [
    { id: 1, number: 1, name: '김기성', gender: 'M', bonus: 0 },
    { id: 2, number: 2, name: '김일흠', gender: 'M', bonus: 0 },
    { id: 3, number: 3, name: '김한주', gender: 'M', bonus: 0 },
    { id: 4, number: 4, name: '서진우', gender: 'M', bonus: 0 },
    { id: 5, number: 5, name: '임현성', gender: 'M', bonus: 0 },
    { id: 6, number: 6, name: '장성우', gender: 'M', bonus: 0 },
    { id: 7, number: 7, name: '최희락', gender: 'M', bonus: 0 },
    { id: 8, number: 8, name: '허윤', gender: 'M', bonus: 0 },
    { id: 9, number: 9, name: '황일봉', gender: 'M', bonus: 0 },
    { id: 10, number: 10, name: '최미르', gender: 'M', bonus: 0 },
    { id: 11, number: 11, name: '강리나', gender: 'F', bonus: 0 },
    { id: 12, number: 12, name: '권다윤', gender: 'F', bonus: 0 },
    { id: 13, number: 13, name: '권하린', gender: 'F', bonus: 0 },
    { id: 14, number: 14, name: '김서연', gender: 'F', bonus: 0 },
    { id: 15, number: 15, name: '김슬기', gender: 'F', bonus: 0 },
    { id: 16, number: 16, name: '낫라다', gender: 'F', bonus: 0 },
    { id: 17, number: 17, name: '박지온', gender: 'F', bonus: 0 },
    { id: 18, number: 18, name: '박효진', gender: 'F', bonus: 0 },
    { id: 19, number: 19, name: '손연아', gender: 'F', bonus: 0 },
    { id: 20, number: 20, name: '안라윤', gender: 'F', bonus: 0 },
    { id: 21, number: 21, name: '장하윤', gender: 'F', bonus: 0 },
    { id: 22, number: 22, name: '전서은', gender: 'F', bonus: 0 },
    { id: 23, number: 23, name: '차수연', gender: 'F', bonus: 0 },
    { id: 24, number: 24, name: '한지안', gender: 'F', bonus: 0 },
    { id: 25, number: 25, name: '장서현', gender: 'F', bonus: 0 }
  ],
  
  // 교실 좌석 (5x5 기본)
  layout: { rows: 5, cols: 5, seats: [] },
  groups: [],
  
  // 🕵️‍♂️ 교사 비밀 조작 (Secret Rigging) 제약조건
  secretSettings: {
    fixedSeats: {},      // { "seat-0-2": studentId } (특정 좌석/앞자리 강제 고정)
    separatePairs: [],   // [ [studentIdA, studentIdB], ... ] (인접/짝 금지)
    genderBalance: true, // 남녀 균등/교차 우선
    enableSecretRig: true // 비밀 조작 활성화 여부
  },
  
  // 학생/게임 진행 상태
  me: null,              // 내 student id (학생용)
  joinedStudents: [],    // 현재 대기실/게임에 접속한 학생 id 목록
  currentGameType: 'lightning',
  gameScores: {},
  gameRankings: [],
  currentPickIndex: 0
};

// 좌석 초기화
function initLayout() {
  const seats = [];
  for (let r = 0; r < state.layout.rows; r++) {
    for (let c = 0; c < state.layout.cols; c++) {
      seats.push({
        id: `seat-${r}-${c}`,
        r, c,
        status: 'available',
        occupantId: null
      });
    }
  }
  state.layout.seats = seats;
}
initLayout();

// LocalStorage 저장/불러오기
function loadSavedData() {
  try {
    const savedRig = localStorage.getItem('class_secret_rig');
    if (savedRig) state.secretSettings = JSON.parse(savedRig);
    const savedStudents = localStorage.getItem('class_students');
    if (savedStudents) state.students = JSON.parse(savedStudents);
  } catch(e) { console.error(e); }
}
function saveRigData() {
  try {
    localStorage.setItem('class_secret_rig', JSON.stringify(state.secretSettings));
    localStorage.setItem('class_students', JSON.stringify(state.students));
  } catch(e) { console.error(e); }
}
loadSavedData();

// ==========================================
// 2. UI UTILITIES & TOAST
// ==========================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if(target) target.classList.add('active');
  state.currentScreen = screenId;
  onScreenEnter(screenId);
}

function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if(!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// 3. PEERJS REALTIME CHANNEL SYSTEM (P2P)
// ==========================================
const PEER_PREFIX = 'seatking-room-';

function generateRoomId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 교사용: 채널 개설 (Host)
window.createTeacherRoom = () => {
  state.isHost = true;
  state.roomId = generateRoomId();
  const fullPeerId = PEER_PREFIX + state.roomId;
  
  if(state.peer) state.peer.destroy();
  state.peer = new Peer(fullPeerId);
  
  state.peer.on('open', (id) => {
    console.log('교사용 방 개설 완료:', state.roomId);
    showScreen('waiting');
    renderHostWaitingRoom();
    showToast(`채널 코드 [ ${state.roomId} ] 개설 완료!`, 'success');
  });
  
  state.peer.on('connection', (conn) => {
    state.clientConns.push(conn);
    
    conn.on('data', (data) => {
      handleHostReceivedData(data, conn);
    });
    
    conn.on('close', () => {
      state.clientConns = state.clientConns.filter(c => c !== conn);
    });
  });
  
  state.peer.on('error', (err) => {
    console.warn('Peer error:', err);
    if(err.type === 'unavailable-id') {
      state.roomId = generateRoomId();
      createTeacherRoom();
    }
  });
};

// 학생용: 방 접속 (Client)
window.joinStudentRoom = (targetRoomId) => {
  if(!targetRoomId) {
    targetRoomId = document.getElementById('input-room-code')?.value.trim();
  }
  if(!targetRoomId) {
    showToast('채널 코드(방 번호)를 입력해주세요!', 'warning');
    return;
  }
  
  state.isHost = false;
  state.roomId = targetRoomId;
  
  if(state.peer) state.peer.destroy();
  state.peer = new Peer();
  
  state.peer.on('open', () => {
    const hostPeerId = PEER_PREFIX + state.roomId;
    const conn = state.peer.connect(hostPeerId);
    state.hostConn = conn;
    
    conn.on('open', () => {
      showToast('교실 채널에 연결되었습니다!', 'success');
      showScreen('name-select');
      renderAvatarGrid();
    });
    
    conn.on('data', (data) => {
      handleClientReceivedData(data);
    });
    
    conn.on('error', () => {
      showToast('채널 연결 실패. 방 번호를 확인하세요.', 'error');
    });
  });
};

function handleHostReceivedData(data, conn) {
  if(data.type === 'JOIN') {
    if(!state.joinedStudents.includes(data.studentId)) {
      state.joinedStudents.push(data.studentId);
      const student = state.students.find(s => s.id === data.studentId);
      showToast(`👦 [${student?.name || '학생'}] 입장 완료!`, 'info');
      broadcastToClients({ type: 'UPDATE_MEMBERS', joinedStudents: state.joinedStudents });
      updateWaitingRoomUI();
    }
  } else if(data.type === 'GAME_SCORE') {
    state.gameScores[data.studentId] = data.score;
    broadcastToClients({ type: 'UPDATE_SCORES', scores: state.gameScores });
    updateGameScores();
  }
}

function handleClientReceivedData(data) {
  if(data.type === 'UPDATE_MEMBERS') {
    state.joinedStudents = data.joinedStudents;
    if(state.currentScreen === 'waiting') updateWaitingRoomUI();
  } else if(data.type === 'START_GAME') {
    state.currentGameType = data.gameType;
    startGame();
  } else if(data.type === 'TRIGGER_MAGIC_LOTTERY') {
    startFakeLotteryAnimation(data.finalSeating);
  } else if(data.type === 'UPDATE_SCORES') {
    state.gameScores = data.scores;
    updateGameScores();
  }
}

function broadcastToClients(msg) {
  state.clientConns.forEach(conn => {
    if(conn && conn.open) conn.send(msg);
  });
}

// ==========================================
// 4. 🕵️‍♂️ 교사 비밀 조작 (Constraint Solver) 알고리즘
// ==========================================
function solveRiggedSeating() {
  const rows = state.layout.rows;
  const cols = state.layout.cols;
  
  let grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
  let unassignedStudents = [...state.students];
  
  // 1. [고정 좌석] 우선 배치
  if(state.secretSettings.enableSecretRig) {
    Object.entries(state.secretSettings.fixedSeats).forEach(([seatId, studentId]) => {
      const parts = seatId.split('-');
      const r = parseInt(parts[1]);
      const c = parseInt(parts[2]);
      const student = unassignedStudents.find(s => s.id === studentId);
      if(student && r < rows && c < cols) {
        grid[r][c] = student;
        unassignedStudents = unassignedStudents.filter(s => s.id !== studentId);
      }
    });
  }
  
  // 2. 남은 학생 셔플 및 분리 규칙(Separate Pairs) 검증하며 채우기
  for (let i = unassignedStudents.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unassignedStudents[i], unassignedStudents[j]] = [unassignedStudents[j], unassignedStudents[i]];
  }
  
  function isAdjacentConflict(r, c, student) {
    if(!state.secretSettings.enableSecretRig) return false;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    for(const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if(nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc]) {
        const neighbor = grid[nr][nc];
        const isForbidden = state.secretSettings.separatePairs.some(pair => 
          (pair[0] === student.id && pair[1] === neighbor.id) ||
          (pair[1] === student.id && pair[0] === neighbor.id)
        );
        if(isForbidden) return true;
      }
    }
    return false;
  }
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if(grid[r][c] !== null) continue;
      if(unassignedStudents.length === 0) break;
      
      let chosenIdx = -1;
      for(let i = 0; i < unassignedStudents.length; i++) {
        if(!isAdjacentConflict(r, c, unassignedStudents[i])) {
          chosenIdx = i;
          break;
        }
      }
      
      if(chosenIdx === -1) chosenIdx = 0;
      grid[r][c] = unassignedStudents[chosenIdx];
      unassignedStudents.splice(chosenIdx, 1);
    }
  }
  
  const finalSeats = [];
  for(let r = 0; r < rows; r++) {
    for(let c = 0; c < cols; c++) {
      finalSeats.push({
        id: `seat-${r}-${c}`,
        r, c,
        status: grid[r][c] ? 'taken' : 'available',
        occupantId: grid[r][c] ? grid[r][c].id : null
      });
    }
  }
  return finalSeats;
}

// ==========================================
// 5. 🎰 "완전 랜덤" 위장 마술 룰렛 애니메이션 (Magic Fake Lottery)
// ==========================================
function startFakeLotteryAnimation(riggedSeats) {
  const modal = document.createElement('div');
  modal.className = 'magic-lottery-modal';
  modal.id = 'magic-lottery-modal';
  modal.innerHTML = `
    <h1 style="font-size:2.4rem; color:var(--c-gold); margin-bottom:6px; text-shadow:0 0 20px rgba(255,215,0,0.5);">🎲 실시간 AI 랜덤 자리 추첨</h1>
    <p style="color:var(--c-text2); font-size:1.1rem;">미니게임 결과와 행운의 룰렛으로 공정하게 자리를 매칭 중입니다...</p>
    
    <div class="lottery-wheel-container">
      <div class="lottery-wheel" id="lottery-wheel-el">
        <span style="font-size:4rem;">🎰</span>
      </div>
    </div>
    
    <div class="lottery-name-display" id="lottery-name-display">자리 섞는 중...</div>
    <div style="margin-top:16px; color:var(--c-accent); font-weight:700;" id="lottery-subtext">행운의 신이 당신을 선택합니다!</div>
  `;
  document.body.appendChild(modal);
  
  const names = state.students.map(s => s.name);
  const interval = setInterval(() => {
    const nameEl = document.getElementById('lottery-name-display');
    if(nameEl) {
      nameEl.textContent = names[Math.floor(Math.random() * names.length)] + ' 🪑 좌석 매칭!';
    }
  }, 100);
  
  setTimeout(() => {
    clearInterval(interval);
    const wheel = document.getElementById('lottery-wheel-el');
    const nameEl = document.getElementById('lottery-name-display');
    const sub = document.getElementById('lottery-subtext');
    
    if(wheel) wheel.classList.add('stopped');
    if(nameEl) {
      nameEl.innerHTML = '✨ 최종 배치 완료! ✨';
      nameEl.style.color = 'var(--c-green)';
    }
    if(sub) sub.textContent = '모든 자리 배치가 완료되었습니다!';
    
    setTimeout(() => {
      modal.remove();
      state.layout.seats = riggedSeats;
      showReveal();
    }, 1500);
  }, 3500);
}

window.triggerTeacherMagicLottery = () => {
  const rigged = solveRiggedSeating();
  startFakeLotteryAnimation(rigged);
  broadcastToClients({
    type: 'TRIGGER_MAGIC_LOTTERY',
    finalSeating: rigged
  });
};

// ==========================================
// 6. RENDER LOBBY & SCREENS
// ==========================================
function renderLobby() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <!-- Main Lobby -->
    <div id="screen-lobby" class="screen active">
      <div class="particle" style="width:120px;height:120px;background:var(--c-primary);top:10%;left:15%;--dur:8s;"></div>
      <div class="particle" style="width:160px;height:160px;background:var(--c-accent);bottom:15%;right:10%;--dur:12s;--delay:2s;"></div>
      
      <div class="lobby-content">
        <h1 class="lobby-logo" id="btn-admin-secret" title="5번 클릭 시 교사 관리자">자리왕 배틀</h1>
        <p class="lobby-subtitle">실시간 태블릿 멀티플레이 & 스마트 학급 자리 관리</p>
        
        <div class="lobby-buttons" style="display:flex;flex-direction:column;gap:14px;max-width:360px;margin:30px auto;">
          <button class="btn btn-xl btn-primary" onclick="showScreen('room-join')">
            📱 학생 태블릿으로 참여하기
          </button>
          <button class="btn btn-lg btn-ghost" onclick="createTeacherRoom()">
            👨‍🏫 교사용 대형화면 (방 만들기)
          </button>
        </div>
        
        <div class="lobby-code-hint" style="cursor:pointer;" onclick="showScreen('admin-login')">
          🔒 교사 비밀 관리자 / 자리 조작 설정
        </div>
      </div>
    </div>
    
    <!-- Room Code Join Screen (학생용) -->
    <div id="screen-room-join" class="screen">
      <div class="name-select-card card" style="max-width:440px;">
        <h2 style="font-size:2rem;color:var(--c-primary-l);">채널 코드 입력</h2>
        <p style="margin-bottom:20px;">선생님 화면에 표시된 4자리 방 번호를 입력하세요</p>
        <input type="number" id="input-room-code" class="input text-center" placeholder="예: 7701" style="font-size:2rem;letter-spacing:6px;font-weight:900;height:65px;margin-bottom:20px;">
        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-ghost" onclick="showScreen('lobby')">취소</button>
          <button class="btn btn-xl btn-primary" onclick="joinStudentRoom()">입장하기 🚀</button>
        </div>
      </div>
    </div>

    <!-- Admin Login Screen -->
    <div id="screen-admin-login" class="screen">
      <div class="admin-login-card card">
        <h1>교사 인증</h1>
        <p>관리자 PIN 번호를 입력하세요 (기본: 100402)</p>
        <div class="pin-dots" id="pin-dots">
          <div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div>
        </div>
        <div class="pin-keypad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="pin-key" onclick="enterPin(${n})">${n}</button>`).join('')}
          <button class="pin-key btn-ghost" onclick="showScreen('lobby')">취소</button>
          <button class="pin-key" onclick="enterPin(0)">0</button>
          <button class="pin-key btn-ghost" onclick="clearPin()">지움</button>
        </div>
      </div>
    </div>
    
    <!-- Student Name Select -->
    <div id="screen-name-select" class="screen">
      <div class="name-select-card card">
        <h2>본인의 이름을 선택하세요</h2>
        <p>선택 후 대기실로 입장합니다</p>
        <div class="avatar-grid" id="avatar-grid"></div>
        <div style="margin-top:24px;display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-ghost" onclick="showScreen('room-join')">뒤로</button>
          <button class="btn btn-xl btn-primary" onclick="confirmStudentJoin()">선택 완료 🎯</button>
        </div>
      </div>
    </div>
    
    <!-- Waiting Room -->
    <div id="screen-waiting" class="screen">
      <div class="student-header">
        <div class="student-header-title">
          <span class="channel-status-indicator"></span> 실시간 교실 대기실
        </div>
        <div id="room-code-display" class="room-code-badge">ROOM: ----</div>
      </div>
      
      <div class="waiting-content" style="max-width:900px;margin:0 auto;padding:20px;">
        <div class="waiting-title text-center">
          <h1 id="waiting-main-title">선생님이 게임을 시작할 때까지 대기해주세요</h1>
          <p id="waiting-count">참여 인원: 0 / ${state.students.length}명</p>
        </div>
        
        <div id="host-qr-container" style="text-align:center;margin:20px 0;display:none;">
          <div class="room-qr-box" id="room-qr-code"></div>
          <p style="margin-top:8px;font-size:0.9rem;color:var(--c-text2);">태블릿 카메라로 QR을 스캔하면 바로 연결됩니다</p>
        </div>
        
        <div class="students-grid" id="waiting-grid" style="margin-top:20px;"></div>
        
        <!-- Teacher Controls in Waiting Room -->
        <div id="teacher-host-controls" style="margin-top:30px;text-align:center;display:none;">
          <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-xl btn-accent" onclick="startTeacherGame('lightning')">
              ⚡ 번개 반응 배틀 시작 (학생 태블릿 연동)
            </button>
            <button class="btn btn-xl btn-gold" onclick="triggerTeacherMagicLottery()">
              🎲 즉시 비밀 자리 추첨 (마술 룰렛 발동)
            </button>
          </div>
          <div style="margin-top:14px;">
            <button class="btn btn-sm btn-ghost" onclick="showScreen('admin');switchAdminTab('rig')">
              🕵️‍♂️ 비밀 조작 조건 변경하기
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Game Screen (태블릿 최적화) -->
    <div id="screen-game" class="screen game-screen">
      <div class="game-header">
        <h2 id="game-title-text">⚡ 번개 반응 배틀</h2>
        <div class="game-timer" id="game-timer">ROUND 1</div>
      </div>
      <div class="game-body" id="game-container"></div>
      <div class="game-score-bar" id="game-scores"></div>
    </div>
    
    <!-- Final Reveal Screen -->
    <div id="screen-reveal" class="screen">
      <div class="text-center" style="margin-top: 30px; position:relative; z-index:10;">
        <h1 style="font-size:2.8rem; margin-bottom:8px; color:var(--c-gold);">🎉 최종 교실 자리 배치표</h1>
        <p style="color:var(--c-text2);">새로운 짝꿍과 함께 즐거운 한 달을 보내세요!</p>
      </div>
      
      <div class="classroom-area" style="max-width:800px;margin:20px auto;">
        <div class="blackboard">칠 판 (교 탁)</div>
        <div class="reveal-classroom" id="reveal-classroom" style="grid-template-columns: repeat(${state.layout.cols}, 1fr); gap:12px;"></div>
      </div>
      
      <div class="text-center" style="margin-top:30px;">
        <button class="btn btn-primary btn-lg" onclick="showScreen('lobby')">메인 화면으로</button>
      </div>
    </div>

    <!-- Admin Console (교사 비밀 관리자) -->
    <div id="screen-admin" class="screen">
      <div class="student-header">
        <div class="student-header-title" style="color:var(--c-gold);">👨‍🏫 교사 비밀 관리 콘솔</div>
        <button class="btn btn-sm btn-ghost" onclick="showScreen('lobby')">나가기</button>
      </div>
      <div class="admin-layout">
        <div class="admin-sidebar">
          <div class="admin-nav">
            <div class="admin-nav-item active" onclick="switchAdminTab('rig')">🕵️‍♂️ 비밀 조작(지정배치)</div>
            <div class="admin-nav-item" onclick="switchAdminTab('students')">📋 학생 명단 & 가산점</div>
            <div class="admin-nav-item" onclick="switchAdminTab('groups')">⚖️ 남녀 밸런스 모둠</div>
            <div class="admin-nav-item" onclick="switchAdminTab('print')">🖨️ 인쇄 / 저장</div>
          </div>
        </div>
        <div class="admin-content" id="admin-content-area"></div>
      </div>
    </div>
  `;
  
  let clicks = 0;
  document.getElementById('btn-admin-secret')?.addEventListener('click', () => {
    clicks++;
    if(clicks >= 5) {
      clicks = 0;
      showScreen('admin-login');
    }
  });
}

// ==========================================
// 7. ADMIN TABS & SECRET RIGGING ENGINE
// ==========================================
let currentPin = '';
function enterPin(num) {
  if(currentPin.length < 6) {
    currentPin += num;
    updatePinDots();
  }
  if(currentPin.length === 6) {
    if(currentPin === state.adminPin) {
      setTimeout(() => {
        currentPin = '';
        updatePinDots();
        showScreen('admin');
        switchAdminTab('rig');
      }, 300);
    } else {
      showToast('PIN 번호가 틀렸습니다', 'error');
      currentPin = '';
      updatePinDots();
    }
  }
}
function clearPin() { currentPin = ''; updatePinDots(); }
function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    if(idx < currentPin.length) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
  const content = document.getElementById('admin-content-area');
  if(!content) return;
  
  if(tab === 'rig') {
    content.innerHTML = `
      <div class="admin-page active">
        <div class="admin-page-header" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h1>🕵️‍♂️ 교사 비밀 조작 (지정배치) 설정</h1>
            <p>학생들은 랜덤 게임으로 알지만, 아래 설정된 조건이 100% 반영됩니다.</p>
          </div>
          <button class="btn btn-gold" onclick="triggerTeacherMagicLottery()">🎰 바로 조작 배치 실행</button>
        </div>
        
        <div class="rig-layout">
          <!-- 1. 앞자리/특정석 고정 -->
          <div class="rig-box">
            <div class="rig-title">📌 특정 좌석/앞자리 고정 (시력/집중)</div>
            <p style="font-size:0.85rem;color:var(--c-text2);margin-bottom:12px;">원하는 자리를 클릭한 후 고정할 학생을 선택하세요.</p>
            <div class="blackboard" style="padding:4px;font-size:0.85rem;">칠 판 (교 탁)</div>
            <div class="classroom-grid" style="grid-template-columns: repeat(${state.layout.cols}, 1fr); gap:6px;">
              ${state.layout.seats.map(seat => {
                const fixedStudentId = state.secretSettings.fixedSeats[seat.id];
                const fixedStudent = state.students.find(s => s.id === fixedStudentId);
                const isFixed = !!fixedStudent;
                return `
                  <div class="seat-cell ${isFixed ? 'fixed-seat-cell' : 'available'}" style="height:55px;padding:4px;" onclick="openFixedSeatModal('${seat.id}')">
                    ${isFixed ? `<div class="fixed-seat-badge">고정</div>` : ''}
                    <span class="seat-num">${seat.r * state.layout.cols + seat.c + 1}</span>
                    <span style="font-size:0.8rem;font-weight:700;color:${isFixed?'var(--c-accent)':'var(--c-text2)'};">${fixedStudent ? fixedStudent.name : '비어있음'}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          
          <!-- 2. 기피 학생 분리 (앙숙/떠벌이) -->
          <div class="rig-box">
            <div class="rig-title">🚫 기피 학생 분리 (인접/짝 금지)</div>
            <p style="font-size:0.85rem;color:var(--c-text2);margin-bottom:12px;">서로 떨어뜨려 놓을 두 학생을 선택해 등록하세요.</p>
            
            <div style="display:flex;gap:8px;margin-bottom:14px;">
              <select id="sep-student-1" class="input" style="flex:1;">
                ${state.students.map(s => `<option value="${s.id}">${s.number}. ${s.name} (${s.gender==='M'?'남':'여'})</option>`).join('')}
              </select>
              <span style="display:flex;align-items:center;">⚡</span>
              <select id="sep-student-2" class="input" style="flex:1;">
                ${state.students.map((s,i) => `<option value="${s.id}" ${i===1?'selected':''}>${s.number}. ${s.name} (${s.gender==='M'?'남':'여'})</option>`).join('')}
              </select>
              <button class="btn btn-primary btn-sm" onclick="addSeparatePair()">분리 추가</button>
            </div>
            
            <div style="display:flex;flex-wrap:wrap;gap:8px;" id="separate-pairs-list">
              ${state.secretSettings.separatePairs.length === 0 ? '<p style="color:var(--c-text3);font-size:0.9rem;">등록된 분리 학생이 없습니다.</p>' : ''}
              ${state.secretSettings.separatePairs.map((pair, idx) => {
                const s1 = state.students.find(s => s.id === pair[0]);
                const s2 = state.students.find(s => s.id === pair[1]);
                return `
                  <div class="pair-tag">
                    <span>${s1?.name} 🚫 ${s2?.name}</span>
                    <button onclick="removeSeparatePair(${idx})">×</button>
                  </div>
                `;
              }).join('')}
            </div>
            
            <div style="margin-top:24px;border-top:1px solid var(--c-border);padding-top:16px;">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="check-enable-rig" ${state.secretSettings.enableSecretRig ? 'checked':''} onchange="state.secretSettings.enableSecretRig = this.checked; saveRigData(); showToast('설정이 저장되었습니다','success')">
                <span style="font-weight:700;">비밀 조작 엔진 활성화 (권장)</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if(tab === 'students') {
    content.innerHTML = `
      <div class="admin-page active">
        <div class="admin-page-header">
          <h1>학생 명단 및 비밀 보정 점수</h1>
          <p>미니게임 시 특정 학생에게 은밀하게 가산점을 주어 순위를 조작할 수 있습니다.</p>
        </div>
        <table class="students-table">
          <tr><th>번호</th><th>성별</th><th>이름</th><th>가산점 (비밀)</th></tr>
          ${state.students.map((s, idx) => `
            <tr>
              <td>${s.number}</td>
              <td><span class="gender-tag ${s.gender==='M'?'male':'female'}">${s.gender==='M'?'👨 남':'👩 여'}</span></td>
              <td style="font-weight:700;">${s.name}</td>
              <td><input type="number" class="input bonus-input" value="${s.bonus}" onchange="updateBonus(${idx}, this.value)"></td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  } else if(tab === 'groups') {
    renderGroupsUI();
  } else if(tab === 'print') {
    content.innerHTML = `
      <div class="admin-page active">
        <div class="admin-page-header">
          <h1>저장 및 인쇄 🖨️</h1>
          <p>최종 자리 배치를 출력하거나 이미지로 저장합니다.</p>
        </div>
        <div class="print-options">
          <div class="print-option-card" onclick="window.print()">
            <div class="print-option-icon">🖨️</div>
            <div class="print-option-label">자리표 인쇄하기</div>
          </div>
          <div class="print-option-card" onclick="showToast('이미지가 저장되었습니다 (시뮬레이션)','success')">
            <div class="print-option-icon">🖼️</div>
            <div class="print-option-label">이미지로 저장</div>
          </div>
        </div>
      </div>
    `;
  }
}

window.openFixedSeatModal = (seatId) => {
  const currentFixedId = state.secretSettings.fixedSeats[seatId];
  const selectHtml = `
    <div style="margin:20px 0;">
      <select id="modal-select-student" class="input w-full" style="font-size:1.1rem;padding:10px;">
        <option value="">-- 고정 해제 (비우기) --</option>
        ${state.students.map(s => `
          <option value="${s.id}" ${s.id === currentFixedId ? 'selected':''}>${s.number}. ${s.name} (${s.gender==='M'?'남':'여'})</option>
        `).join('')}
      </select>
    </div>
  `;
  
  const modal = document.createElement('div');
  modal.className = 'magic-lottery-modal';
  modal.innerHTML = `
    <div class="card" style="width:340px;text-align:center;">
      <h3>좌석 [ ${seatId} ] 고정 학생 선택</h3>
      ${selectHtml}
      <div style="display:flex;gap:10px;justify-content:center;">
        <button class="btn btn-ghost" onclick="this.closest('.magic-lottery-modal').remove()">취소</button>
        <button class="btn btn-primary" onclick="confirmFixedSeat('${seatId}', document.getElementById('modal-select-student').value); this.closest('.magic-lottery-modal').remove();">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

window.confirmFixedSeat = (seatId, studentIdStr) => {
  if(!studentIdStr) {
    delete state.secretSettings.fixedSeats[seatId];
    showToast('좌석 고정이 해제되었습니다.', 'info');
  } else {
    state.secretSettings.fixedSeats[seatId] = parseInt(studentIdStr);
    showToast('좌석 고정이 저장되었습니다!', 'success');
  }
  saveRigData();
  switchAdminTab('rig');
};

window.addSeparatePair = () => {
  const s1 = parseInt(document.getElementById('sep-student-1').value);
  const s2 = parseInt(document.getElementById('sep-student-2').value);
  if(s1 === s2) { showToast('서로 다른 학생을 선택하세요!', 'warning'); return; }
  
  const exists = state.secretSettings.separatePairs.some(p => (p[0]===s1 && p[1]===s2) || (p[0]===s2 && p[1]===s1));
  if(exists) { showToast('이미 등록된 분리 페어입니다.', 'warning'); return; }
  
  state.secretSettings.separatePairs.push([s1, s2]);
  saveRigData();
  showToast('분리 학생이 등록되었습니다.', 'success');
  switchAdminTab('rig');
};

window.removeSeparatePair = (idx) => {
  state.secretSettings.separatePairs.splice(idx, 1);
  saveRigData();
  switchAdminTab('rig');
};

window.updateBonus = (idx, val) => {
  state.students[idx].bonus = parseInt(val) || 0;
  saveRigData();
  showToast('가산점이 저장되었습니다', 'success');
};

// ==========================================
// 8. WAITING ROOM & REALTIME SYNC
// ==========================================
function renderHostWaitingRoom() {
  document.getElementById('room-code-display').textContent = `ROOM: ${state.roomId}`;
  document.getElementById('teacher-host-controls').style.display = 'block';
  document.getElementById('host-qr-container').style.display = 'block';
  document.getElementById('waiting-main-title').textContent = '학생들이 접속 중입니다';
  
  const qrBox = document.getElementById('room-qr-code');
  qrBox.innerHTML = '';
  if(window.QRCode) {
    new QRCode(qrBox, {
      text: window.location.origin + window.location.pathname + `?room=${state.roomId}`,
      width: 140,
      height: 140
    });
  }
  updateWaitingRoomUI();
}

function renderAvatarGrid() {
  const grid = document.getElementById('avatar-grid');
  if(!grid) return;
  grid.innerHTML = state.students.map(s => `
    <div class="avatar-item ${state.joinedStudents.includes(s.id)?'joined':''}" onclick="selectStudent(${s.id}, this)">
      <span class="avatar-emoji">${s.gender === 'M' ? '👦' : '👧'}</span>
      ${s.name}
    </div>
  `).join('');
}

window.selectStudent = (id, el) => {
  if(state.joinedStudents.includes(id)) { showToast('이미 입장한 학생입니다.', 'warning'); return; }
  document.querySelectorAll('.avatar-item').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  state.me = id;
};

window.confirmStudentJoin = () => {
  if(!state.me) { showToast('본인 이름을 선택해주세요!', 'warning'); return; }
  if(state.hostConn && state.hostConn.open) {
    state.hostConn.send({ type: 'JOIN', studentId: state.me });
  }
  if(!state.joinedStudents.includes(state.me)) state.joinedStudents.push(state.me);
  showScreen('waiting');
  document.getElementById('room-code-display').textContent = `ROOM: ${state.roomId}`;
  updateWaitingRoomUI();
};

function updateWaitingRoomUI() {
  const countEl = document.getElementById('waiting-count');
  if(countEl) countEl.textContent = `참여 인원: ${state.joinedStudents.length} / ${state.students.length}명`;
  
  const grid = document.getElementById('waiting-grid');
  if(grid) {
    grid.innerHTML = state.students.map(s => {
      const isJoined = state.joinedStudents.includes(s.id);
      return `
        <div class="student-chip ${isJoined ? 'joined':''}">
          <span class="student-chip-emoji">${isJoined ? '🔥' : '⏳'}</span>
          <span class="student-chip-name">${s.name}</span>
        </div>
      `;
    }).join('');
  }
}

function onScreenEnter(screen) {
  if(screen === 'waiting') updateWaitingRoomUI();
}

// ==========================================
// 9. MINIGAMES & REALTIME GAMEPLAY
// ==========================================
window.startTeacherGame = (gameType) => {
  state.currentGameType = gameType;
  broadcastToClients({ type: 'START_GAME', gameType });
  startGame();
};

window.startGame = () => {
  showScreen('game');
  playLightningTap();
};

function playLightningTap() {
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <div class="lightning-arena" id="arena">
       <div id="lightning-target" class="lightning-target" style="display:none; left:50%; top:50%;">⚡</div>
       <div id="result-flash" class="lightning-result-flash"></div>
    </div>
  `;
  
  state.gameScores = {};
  state.students.forEach(s => state.gameScores[s.id] = 0);
  
  let rounds = 5;
  const nextRound = () => {
    if(rounds <= 0) {
      if(state.isHost) triggerTeacherMagicLottery();
      return;
    }
    rounds--;
    const timerEl = document.getElementById('game-timer');
    if(timerEl) timerEl.textContent = `ROUND ${5 - rounds} / 5`;
    
    setTimeout(() => {
      const target = document.getElementById('lightning-target');
      if(!target) return;
      target.style.display = 'flex';
      target.style.left = `${Math.random()*75 + 10}%`;
      target.style.top = `${Math.random()*65 + 15}%`;
      
      const start = Date.now();
      target.onclick = () => {
        const rtime = Date.now() - start;
        target.style.display = 'none';
        
        const pts = rtime < 400 ? 50 : rtime < 800 ? 30 : 15;
        if(state.me) {
          state.gameScores[state.me] = (state.gameScores[state.me] || 0) + pts;
          if(state.hostConn && state.hostConn.open) {
            state.hostConn.send({ type: 'GAME_SCORE', studentId: state.me, score: state.gameScores[state.me] });
          }
        }
        
        const flash = document.getElementById('result-flash');
        if(flash) {
          flash.textContent = `+${pts}pt!`;
          flash.style.animation = 'none';
          setTimeout(() => flash.style.animation = 'slideUp 0.5s forwards', 10);
        }
        setTimeout(nextRound, 1000);
      };
    }, Math.random() * 1500 + 600);
  };
  nextRound();
}

function updateGameScores() {
  const bar = document.getElementById('game-scores');
  if(!bar) return;
  const sorted = Object.entries(state.gameScores).sort((a,b) => b[1] - a[1]);
  bar.innerHTML = sorted.map(entry => {
    const s = state.students.find(x => x.id == entry[0]);
    return `
      <div class="score-chip ${entry[0] == state.me ? 'top':''}">
        <span class="score-chip-name">${s ? s.name : ''}</span>
        <span class="score-chip-score">${entry[1]}</span>
      </div>
    `;
  }).join('');
}

// ==========================================
// 10. REVEAL & CELEBRATION
// ==========================================
function showReveal() {
  showScreen('reveal');
  const grid = document.getElementById('reveal-classroom');
  grid.innerHTML = state.layout.seats.map((seat, i) => {
    let content = '';
    const occ = state.students.find(x => x.id === seat.occupantId);
    const isMe = occ && occ.id === state.me;
    if(occ) {
      const emoji = occ.gender === 'M' ? '👦' : '👧';
      content = `
        <span class="reveal-seat-emoji">${emoji}</span>
        <span style="font-weight:700;${isMe ? 'color:var(--c-gold);font-size:1.15rem;':''}">${occ.name}</span>
      `;
    }
    return `
      <div class="reveal-seat ${isMe ? 'taken-by-me':''}" style="animation-delay:${i*0.06}s; height:75px; background:var(--c-surface2); border:1px solid var(--c-border2); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        ${content}
      </div>
    `;
  }).join('');
  
  fireConfetti();
}

function fireConfetti() {
  for(let i=0; i<40; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = `${Math.random()*100}vw`;
    p.style.backgroundColor = `hsl(${Math.random()*360}, 100%, 60%)`;
    p.style.animationDuration = `${Math.random()*2+2}s`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }
}

// Group Balance UI
function renderGroupsUI() {
  const content = document.getElementById('admin-content-area');
  if(!content) return;
  if(state.groups.length === 0) generateGenderBalancedGroups(5);
  
  content.innerHTML = `
    <div class="admin-page active">
      <div class="admin-page-header" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h1>⚖️ 남녀 밸런스 모둠 편성</h1>
          <p>모둠별 남녀 비율을 균등하게 자동 배치합니다.</p>
        </div>
        <button class="btn btn-primary" onclick="generateGenderBalancedGroups(5)">⚡ 5모둠 재편성</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;margin-top:20px;">
        ${state.groups.map(g => `
          <div class="card" style="background:var(--c-surface2);">
            <h3 style="color:var(--c-gold);margin-bottom:10px;">${g.name}</h3>
            ${g.members.map(m => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                <span>${m.name}</span>
                <span class="gender-tag ${m.gender==='M'?'male':'female'}">${m.gender==='M'?'남':'여'}</span>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function generateGenderBalancedGroups(groupCount = 5) {
  const males = state.students.filter(s => s.gender === 'M');
  const females = state.students.filter(s => s.gender === 'F');
  const groups = Array.from({ length: groupCount }, (_, i) => ({ id: i+1, name: `${i+1}모둠`, members: [] }));
  
  males.forEach((m, idx) => groups[idx % groupCount].members.push(m));
  females.forEach((f, idx) => groups[idx % groupCount].members.push(f));
  state.groups = groups;
}

// ==========================================
// 11. BOOTSTRAP & URL PARAM CHECK
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  renderLobby();
  
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room');
  if(urlRoom) {
    joinStudentRoom(urlRoom);
  } else {
    showScreen('lobby');
  }
});
