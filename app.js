/**
 * 자리왕 배틀 - Main App Logic
 */

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
const state = {
  // Common
  currentScreen: 'lobby', // lobby, admin-login, admin, name-select, waiting, game, seat-pick, reveal
  toastTimeout: null,
  
  // Admin / Class Data
  adminPin: '100402',
  students: [
    // 남자 10명
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
    // 여자 15명
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
  layout: { rows: 5, cols: 5, seats: [] }, // seats: array of {id, r, c, isSpecial, status, occupantId}
  groups: [], // auto-balanced groups array of {id, name, members: []}
  constraints: [], // { type, studentA, studentB, targetZone }
  history: [],
  currentGameType: 'lightning', // Selected game
  
  // Student Game Flow
  me: null, // my student id
  joinedStudents: [], // ids of students in waiting room
  gamePhase: 'init', // init, playing, finished
  gameScores: {}, // { studentId: score }
  gameRankings: [], // sorted array of {studentId, score, bonus, total}
  currentPickIndex: 0, // whose turn it is to pick
  
  // Games specific state
  gameData: {}
};

// Initialize Layout
function initLayout() {
  const seats = [];
  for (let r = 0; r < state.layout.rows; r++) {
    for (let c = 0; c < state.layout.cols; c++) {
      seats.push({
        id: `seat-${r}-${c}`,
        r, c,
        isSpecial: false,
        status: 'available', // available, taken, blocked
        occupantId: null
      });
    }
  }
  state.layout.seats = seats;
}
if(state.layout.seats.length === 0) initLayout();

// ==========================================
// 2. UI UTILITIES
// ==========================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${screenId}`).classList.add('active');
  state.currentScreen = screenId;
  onScreenEnter(screenId);
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if(!container) {
    const div = document.createElement('div');
    div.id = 'toast-container';
    document.body.appendChild(div);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// 3. RENDER FUNCTIONS
// ==========================================
function renderLobby() {
  // Reset student state
  state.me = null;
  state.joinedStudents = [];
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="screen-lobby" class="screen active">
      <!-- Particles -->
      <div class="particle" style="width:100px;height:100px;background:var(--c-primary);top:10%;left:20%;--dur:8s;"></div>
      <div class="particle" style="width:150px;height:150px;background:var(--c-accent);bottom:20%;right:10%;--dur:12s;--delay:2s;"></div>
      
      <div class="lobby-content">
        <h1 class="lobby-logo" id="btn-admin-secret">자리왕 배틀</h1>
        <p class="lobby-subtitle">운과 실력으로 최고의 자리를 차지하세요!</p>
        
        <div class="lobby-buttons">
          <button class="btn btn-xl btn-primary" onclick="startStudentFlow()">학생으로 참여하기</button>
        </div>
        <p class="lobby-code-hint">교사 전용 페이지는 숨겨져 있습니다.</p>
      </div>
    </div>
    
    <!-- Admin Login Screen -->
    <div id="screen-admin-login" class="screen">
      <div class="admin-login-card card">
        <h1>교사 인증</h1>
        <p>관리자 PIN 번호를 입력하세요 (6자리)</p>
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
        <h2>누구인가요?</h2>
        <p>본인의 이름을 선택하세요</p>
        <div class="avatar-grid" id="avatar-grid"></div>
        <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;">
          <button class="btn btn-ghost" onclick="showScreen('lobby')">뒤로</button>
          <button class="btn btn-primary" onclick="joinWaitingRoom()">선택 완료</button>
        </div>
      </div>
    </div>
    
    <!-- Waiting Room -->
    <div id="screen-waiting" class="screen">
      <div class="student-header">
        <div class="student-header-title">자리왕 배틀 대기실</div>
        <div class="student-header-badge badge badge-primary" id="waiting-me-badge"></div>
      </div>
      <div class="waiting-content">
        <div class="waiting-title">
          <h1>선생님이 게임을 시작할 때까지 기다려주세요</h1>
          <p id="waiting-count">참여 인원: 0/${state.students.length}</p>
        </div>
        <div class="students-grid" id="waiting-grid"></div>
        
        <div class="text-center mt-3" style="display:none;" id="teacher-start-btn-container">
          <button class="btn btn-lg btn-accent" onclick="startGame()">선생님 기기에서 테스트로 시작하기 (시뮬레이션)</button>
        </div>
      </div>
    </div>
    
    <!-- Placeholder for Game Screen -->
    <div id="screen-game" class="screen game-screen">
      <div class="game-header">
        <h2>번개 반응 배틀</h2>
        <div class="game-timer" id="game-timer">00:00</div>
      </div>
      <div class="game-body" id="game-container"></div>
      <div class="game-score-bar" id="game-scores"></div>
    </div>
    
    <!-- Ranking Screen -->
    <div id="screen-ranking" class="screen">
      <div class="ranking-list">
        <div class="ranking-title">
          <h1>게임 결과</h1>
          <p>순위대로 자리를 선택합니다!</p>
        </div>
        <div id="ranking-container"></div>
        <div class="text-center mt-3">
          <button class="btn btn-xl btn-primary" onclick="startSeatPick()">자리 선택하러 가기</button>
        </div>
      </div>
    </div>
    
    <!-- Seat Pick Screen -->
    <div id="screen-seat-pick" class="screen">
      <div class="student-header">
        <div class="student-header-title">자리 선택</div>
        <div class="student-header-badge badge badge-gold" id="pick-turn-badge">대기 중</div>
      </div>
      <div class="seat-pick-layout">
        <div class="seat-sidebar">
          <div class="seat-sidebar-title">선택 순서</div>
          <div id="pick-queue"></div>
        </div>
        <div class="classroom-area">
          <div class="classroom-header">
            <h2>원하는 자리를 터치하세요</h2>
          </div>
          <div class="blackboard">칠 판 (교 탁)</div>
          <div class="classroom-grid" id="classroom-grid" style="grid-template-columns: repeat(${state.layout.cols}, 70px);"></div>
        </div>
      </div>
    </div>

    <!-- Reveal Screen -->
    <div id="screen-reveal" class="screen">
      <div class="text-center" style="margin-top: 40px; position:relative; z-index:10;">
        <h1 style="font-size:3rem; margin-bottom:10px;">최종 자리 배치</h1>
        <p style="color:var(--c-text2);">이번 한 달도 잘 부탁해!</p>
      </div>
      <div class="reveal-classroom" id="reveal-classroom" style="grid-template-columns: repeat(${state.layout.cols}, 80px);"></div>
      <div class="text-center" style="margin-top:40px;">
        <button class="btn btn-ghost" onclick="showScreen('lobby')">처음으로 돌아가기</button>
      </div>
    </div>
    
    <!-- Admin Dashboard (Simplified) -->
    <div id="screen-admin" class="screen">
      <div class="student-header">
        <div class="student-header-title" style="color:var(--c-primary);">👨‍🏫 교사 관리자</div>
        <button class="btn btn-sm btn-ghost" onclick="showScreen('lobby')">나가기</button>
      </div>
      <div class="admin-layout">
        <div class="admin-sidebar">
          <div class="admin-nav">
            <div class="admin-nav-item active" onclick="switchAdminTab('dashboard')">대시보드</div>
            <div class="admin-nav-item" onclick="switchAdminTab('students')">학생 명단</div>
            <div class="admin-nav-item" onclick="switchAdminTab('groups')">⚖️ 남녀 밸런스 모둠</div>
            <div class="admin-nav-item" onclick="switchAdminTab('games')">게임 설정</div>
            <div class="admin-nav-item" onclick="switchAdminTab('print')">저장·인쇄</div>
          </div>
        </div>
        <div class="admin-content" id="admin-content-area">
           <!-- Rendered via JS -->
        </div>
      </div>
    </div>
  `;
  
  // Secret Admin Trigger
  let clicks = 0;
  document.getElementById('btn-admin-secret').addEventListener('click', () => {
    clicks++;
    if(clicks >= 5) {
      clicks = 0;
      showScreen('admin-login');
    }
  });
}

// ==========================================
// 4. ADMIN LOGIN & PANEL
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
        switchAdminTab('dashboard');
      }, 300);
    } else {
      showToast('PIN 번호가 틀렸습니다', 'error');
      currentPin = '';
      updatePinDots();
    }
  }
}
function clearPin() {
  currentPin = '';
  updatePinDots();
}
function updatePinDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, idx) => {
    if(idx < currentPin.length) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  } else {
    const navItems = document.querySelectorAll('.admin-nav-item');
    if (tab === 'dashboard' && navItems[0]) navItems[0].classList.add('active');
    if (tab === 'students' && navItems[1]) navItems[1].classList.add('active');
    if (tab === 'groups' && navItems[2]) navItems[2].classList.add('active');
    if (tab === 'games' && navItems[3]) navItems[3].classList.add('active');
    if (tab === 'print' && navItems[4]) navItems[4].classList.add('active');
  }
  
  const content = document.getElementById('admin-content-area');
  if(tab === 'dashboard') {
    const maleCount = state.students.filter(s => s.gender === 'M').length;
    const femaleCount = state.students.filter(s => s.gender === 'F').length;
    content.innerHTML = `
      <div class="admin-page active">
        <div class="admin-page-header">
          <h1>대시보드</h1>
          <p>현재 학급 현황 및 성별 비율입니다.</p>
        </div>
        <div class="dashboard-grid">
          <div class="dash-card">
            <div class="dash-card-label">총 학생 수</div>
            <div class="dash-card-value">${state.students.length}명</div>
            <div class="dash-card-sub" style="margin-top:6px;font-size:0.9rem;color:var(--c-text2);">
              <span style="color:#60a5fa;">👨 남: ${maleCount}명</span> | 
              <span style="color:#f472b6;">👩 여: ${femaleCount}명</span>
            </div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">모둠 성비 밸런스 비율</div>
            <div class="dash-card-value" style="color:var(--c-green)">40% : 60%</div>
            <div class="dash-card-sub" style="margin-top:6px;font-size:0.9rem;color:var(--c-text2);">
              5개 모둠 시 (각 남2 : 여3 균등배치)
            </div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">선택된 게임</div>
            <div class="dash-card-value" style="color:var(--c-primary)">${state.currentGameType === 'lightning' ? '번개 반응' : '행운의 룰렛'}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:20px;">
          <button class="btn btn-primary" onclick="showScreen('lobby'); setTimeout(()=>showToast('학생들이 입장할 수 있습니다.','success'), 500)">로비로 이동하여 시작하기</button>
          <button class="btn btn-accent" onclick="switchAdminTab('groups')">⚖️ 남녀 밸런스 모둠 편성하기</button>
        </div>
      </div>
    `;
  } else if (tab === 'students') {
    content.innerHTML = `
      <div class="admin-page active">
        <div class="admin-page-header">
          <h1>학생 명단 & 성별 / 보정 점수</h1>
          <p>전체 25명 명단과 남녀 성별 태그, 가중치 보정 점수입니다.</p>
        </div>
        <table class="students-table">
          <tr><th>번호</th><th>성별</th><th>이름</th><th>보정점수 (비밀)</th></tr>
          ${state.students.map((s, idx) => `
            <tr>
              <td>${s.number}</td>
              <td>
                <span class="gender-tag ${s.gender === 'M' ? 'male' : 'female'}">
                  ${s.gender === 'M' ? '👨 남' : '👩 여'}
                </span>
              </td>
              <td style="font-weight:700;">${s.name}</td>
              <td><input type="number" class="input bonus-input" value="${s.bonus}" onchange="updateBonus(${idx}, this.value)"></td>
            </tr>
          `).join('')}
        </table>
      </div>
    `;
  } else if (tab === 'groups') {
    if(state.groups.length === 0) {
      generateGenderBalancedGroups(5);
    } else {
      renderGroupsUI();
    }
  } else if (tab === 'games') {
    content.innerHTML = `
       <div class="admin-page active">
        <div class="admin-page-header">
          <h1>게임 라이브러리</h1>
          <p>이번 자리 바꾸기에서 사용할 미니게임을 선택하세요.</p>
        </div>
        <div class="game-library-grid">
          <div class="game-card ${state.currentGameType==='lightning'?'selected':''}" onclick="setGame('lightning')">
            <div class="game-card-name">번개 반응 배틀</div>
            <div class="game-card-desc">화면에 나타나는 아이콘을 가장 빠르게 터치하세요!</div>
          </div>
          <div class="game-card ${state.currentGameType==='roulette'?'selected':''}" onclick="setGame('roulette')">
             <div class="game-card-name">행운의 룰렛</div>
             <div class="game-card-desc">순수 100% 운! 룰렛을 돌려 순서를 정합니다.</div>
          </div>
        </div>
      </div>
    `;
  } else if (tab === 'print') {
     content.innerHTML = `
       <div class="admin-page active">
        <div class="admin-page-header">
          <h1>저장 및 인쇄 🖨️</h1>
          <p>최종 자리 배치를 출력하거나 이미지로 저장합니다.</p>
        </div>
        <div class="print-options">
          <div class="print-option-card">
            <div class="print-option-icon">📄</div>
            <div class="print-option-label">PDF로 저장 (준비중)</div>
          </div>
          <div class="print-option-card" onclick="alert('PNG 이미지가 다운로드 되었습니다. (시뮬레이션)')">
            <div class="print-option-icon">🖼️</div>
            <div class="print-option-label">PNG 이미지 저장</div>
          </div>
        </div>
      </div>
    `;
  }
}
window.updateBonus = (idx, val) => { state.students[idx].bonus = parseInt(val) || 0; showToast('저장되었습니다','success'); }
window.setGame = (game) => { state.currentGameType = game; switchAdminTab('games'); }

// Group Balance Logic
window.generateGenderBalancedGroups = (groupCount = 5) => {
  const males = state.students.filter(s => s.gender === 'M').slice();
  const females = state.students.filter(s => s.gender === 'F').slice();
  
  // Fisher-Yates shuffle
  for (let i = males.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [males[i], males[j]] = [males[j], males[i]];
  }
  for (let i = females.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [females[i], females[j]] = [females[j], females[i]];
  }
  
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    id: i + 1,
    name: `${i + 1}모둠`,
    members: []
  }));
  
  males.forEach((m, idx) => {
    groups[idx % groupCount].members.push(m);
  });
  females.forEach((f, idx) => {
    groups[idx % groupCount].members.push(f);
  });
  
  state.groups = groups;
  showToast(`${groupCount}개 남녀 밸런스 모둠이 생성되었습니다!`, 'success');
  renderGroupsUI();
};

window.renderGroupsUI = () => {
  const content = document.getElementById('admin-content-area');
  if(!content) return;
  
  const totalMale = state.students.filter(s => s.gender === 'M').length;
  const totalFemale = state.students.filter(s => s.gender === 'F').length;
  
  content.innerHTML = `
    <div class="admin-page active">
      <div class="admin-page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;">
        <div>
          <h1>⚖️ 남녀 밸런스 모둠 자동 편성</h1>
          <p>남학생(${totalMale}명)과 여학생(${totalFemale}명)이 각 모둠에 균등하게 섞이도록 자동 배치되었습니다.</p>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-primary" onclick="generateGenderBalancedGroups(5)">⚡ 5모둠 재편성 (모둠당 5명)</button>
          <button class="btn btn-accent" onclick="applyGroupsToSeats()">🪑 이 모둠으로 자리 배치하기</button>
        </div>
      </div>
      
      <div class="groups-container" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:20px;margin-top:20px;">
        ${state.groups.map(g => {
          const mCount = g.members.filter(m => m.gender === 'M').length;
          const fCount = g.members.filter(m => m.gender === 'F').length;
          return `
            <div class="group-card card card-hover" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:16px;padding:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;">
                <h2 style="font-size:1.3rem;color:var(--c-gold);margin:0;">${g.name}</h2>
                <div style="font-size:0.85rem;background:rgba(255,255,255,0.08);padding:4px 10px;border-radius:20px;">
                  <span style="color:#60a5fa;font-weight:700;">남 ${mCount}</span> : <span style="color:#f472b6;font-weight:700;">여 ${fCount}</span>
                </div>
              </div>
              <div class="group-members-list" style="display:flex;flex-direction:column;gap:8px;">
                ${g.members.map(m => `
                  <div style="display:flex;align-items:center;justify-content:space-between;background:var(--c-bg2);padding:8px 12px;border-radius:10px;">
                    <span style="font-weight:600;">${m.name}</span>
                    <span class="gender-tag ${m.gender==='M'?'male':'female'}">
                      ${m.gender==='M'?'👨 남':'👩 여'}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
};

window.applyGroupsToSeats = () => {
  if (state.groups.length === 0) {
    showToast('먼저 모둠을 생성해주세요!', 'warning');
    return;
  }
  
  const allGroupedStudents = [];
  state.groups.forEach(g => {
    g.members.forEach(m => allGroupedStudents.push(m));
  });
  
  state.layout.seats.forEach((seat, idx) => {
    if (idx < allGroupedStudents.length) {
      seat.status = 'taken';
      seat.occupantId = allGroupedStudents[idx].id;
    } else {
      seat.status = 'available';
      seat.occupantId = null;
    }
  });
  
  showToast('모둠 배치표가 자리 레이아웃에 반영되었습니다!', 'success');
  showScreen('reveal');
};

// ==========================================
// 5. STUDENT FLOW
// ==========================================
window.startStudentFlow = () => {
  showScreen('name-select');
  const grid = document.getElementById('avatar-grid');
  grid.innerHTML = state.students.map(s => `
    <div class="avatar-item ${state.joinedStudents.includes(s.id)?'joined':''}" onclick="selectStudent(${s.id}, this)">
      <span class="avatar-emoji">${s.gender === 'M' ? '👦' : '👧'}</span>
      ${s.name}
    </div>
  `).join('');
};

window.selectStudent = (id, el) => {
  if(state.joinedStudents.includes(id)) { showToast('이미 참여한 학생입니다.','error'); return; }
  document.querySelectorAll('.avatar-item').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  state.me = id;
};

window.joinWaitingRoom = () => {
  if(!state.me) { showToast('이름을 선택해주세요','warning'); return; }
  if(!state.joinedStudents.includes(state.me)) state.joinedStudents.push(state.me);
  showScreen('waiting');
  
  // For demo: add other students automatically after a delay
  setTimeout(() => {
    state.students.forEach(s => {
      if(!state.joinedStudents.includes(s.id)) state.joinedStudents.push(s.id);
    });
    updateWaitingRoom();
    document.getElementById('teacher-start-btn-container').style.display = 'block';
  }, 1500);
};

function updateWaitingRoom() {
  const me = state.students.find(s=>s.id === state.me);
  document.getElementById('waiting-me-badge').textContent = `내 이름: ${me?.name || '알수없음'}`;
  document.getElementById('waiting-count').textContent = `참여 인원: ${state.joinedStudents.length}/${state.students.length}`;
  
  const grid = document.getElementById('waiting-grid');
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

function onScreenEnter(screen) {
  if(screen === 'waiting') updateWaitingRoom();
}

// ==========================================
// 6. MINIGAMES
// ==========================================
window.startGame = () => {
  showScreen('game');
  if(state.currentGameType === 'lightning') playLightningTap();
  else playRoulette();
};

function playLightningTap() {
  const container = document.getElementById('game-container');
  container.innerHTML = `
    <div class="lightning-arena" id="arena">
       <div id="lightning-target" class="lightning-target" style="display:none; left:50%; top:50%;">⚡</div>
       <div id="result-flash" class="lightning-result-flash"></div>
    </div>
  `;
  
  // Simulation of game
  state.gameScores = {};
  state.students.forEach(s => state.gameScores[s.id] = 0);
  
  let rounds = 5;
  const nextRound = () => {
    if(rounds <= 0) return finishGame();
    rounds--;
    
    setTimeout(() => {
      const target = document.getElementById('lightning-target');
      if(!target) return;
      target.style.display = 'flex';
      target.style.left = `${Math.random()*80 + 10}%`;
      target.style.top = `${Math.random()*70 + 10}%`;
      
      const start = Date.now();
      target.onclick = () => {
        const rtime = Date.now() - start;
        target.style.display = 'none';
        
        // Add score for me based on speed
        const pts = rtime < 500 ? 30 : rtime < 1000 ? 20 : 10;
        state.gameScores[state.me] += pts;
        
        // Simulate others
        state.students.forEach(s => {
          if(s.id !== state.me) state.gameScores[s.id] += Math.floor(Math.random()*30);
        });
        
        updateGameScores();
        
        const flash = document.getElementById('result-flash');
        flash.textContent = `+${pts}`;
        flash.style.color = 'var(--c-gold)';
        flash.style.animation = 'none';
        setTimeout(()=>flash.style.animation = 'slideUp 0.5s forwards',10);
        
        setTimeout(nextRound, 1000);
      };
    }, Math.random()*2000 + 500);
  };
  nextRound();
}

function playRoulette() {
  const container = document.getElementById('game-container');
  container.innerHTML = `<div class="empty-state"><h3>🎲 랜덤 점수 배정 중...</h3></div>`;
  setTimeout(() => {
    state.gameScores = {};
    state.students.forEach(s => state.gameScores[s.id] = Math.floor(Math.random()*100));
    finishGame();
  }, 2000);
}

function updateGameScores() {
  const bar = document.getElementById('game-scores');
  if(!bar) return;
  const sorted = Object.entries(state.gameScores).sort((a,b)=>b[1]-a[1]);
  bar.innerHTML = sorted.map(entry => {
    const s = state.students.find(x=>x.id == entry[0]);
    return `
      <div class="score-chip ${entry[0]==state.me ? 'top':''}">
        <span class="score-chip-name">${s.name}</span>
        <span class="score-chip-score">${entry[1]}</span>
      </div>
    `;
  }).join('');
}

function finishGame() {
  // Calc final rankings with bonus
  const ranks = state.students.map(s => {
    const base = state.gameScores[s.id] || 0;
    const bns = s.bonus || 0;
    return { studentId: s.id, score: base, bonus: bns, total: base + bns };
  });
  ranks.sort((a,b) => b.total - a.total);
  state.gameRankings = ranks;
  
  showScreen('ranking');
  const rCont = document.getElementById('ranking-container');
  rCont.innerHTML = ranks.map((r, i) => {
    const s = state.students.find(x=>x.id === r.studentId);
    let medal = '';
    if(i===0) medal='🥇'; else if(i===1) medal='🥈'; else if(i===2) medal='🥉';
    return `
      <div class="rank-item">
        <div class="rank-pos">${i+1}</div>
        <div class="rank-name">${s.name}</div>
        ${r.bonus > 0 ? `<div class="rank-bonus">가산점 +${r.bonus}</div>` : ''}
        <div class="rank-score">${r.total}점</div>
        <div class="rank-medal">${medal}</div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 7. SEAT PICKING
// ==========================================
window.startSeatPick = () => {
  state.currentPickIndex = 0;
  // Initialize seats status
  state.layout.seats.forEach(s => { s.status = 'available'; s.occupantId = null; });
  showScreen('seat-pick');
  updateSeatPickUI();
  processNextPick();
};

function updateSeatPickUI() {
  // Sidebar queue
  const q = document.getElementById('pick-queue');
  q.innerHTML = state.gameRankings.map((r, idx) => {
    const s = state.students.find(x=>x.id === r.studentId);
    const cls = idx === state.currentPickIndex ? 'current' : idx < state.currentPickIndex ? 'done' : '';
    return `<div class="pick-queue-item ${cls}"><span class="pick-queue-rank">${idx+1}</span><span class="pick-queue-name">${s.name}</span></div>`;
  }).join('');
  
  // Grid
  const grid = document.getElementById('classroom-grid');
  grid.innerHTML = state.layout.seats.map(seat => {
    const isMe = seat.occupantId === state.me;
    let cls = 'available';
    if(seat.status === 'taken') cls = isMe ? 'taken-by-me' : 'taken';
    let content = '';
    if(seat.occupantId) {
      const occ = state.students.find(x=>x.id === seat.occupantId);
      const emoji = occ ? (occ.gender === 'M' ? '👦' : '👧') : '👶';
      content = `<span class="seat-occupant-emoji">${emoji}</span><span class="seat-occupant">${occ ? occ.name : ''}</span>`;
    }
    return `
      <div class="seat-cell ${cls}" onclick="pickSeat('${seat.id}')">
        <span class="seat-num">${seat.r*state.layout.cols + seat.c + 1}</span>
        ${content}
      </div>
    `;
  }).join('');
  
  const currentRank = state.gameRankings[state.currentPickIndex];
  if(!currentRank) return; // Done
  
  if(currentRank.studentId === state.me) {
    document.getElementById('pick-turn-badge').textContent = '내 차례입니다!';
    document.getElementById('pick-turn-badge').className = 'student-header-badge badge badge-accent';
  } else {
    const s = state.students.find(x=>x.id === currentRank.studentId);
    document.getElementById('pick-turn-badge').textContent = `${s.name} 선택 중...`;
    document.getElementById('pick-turn-badge').className = 'student-header-badge badge badge-primary';
  }
}

function processNextPick() {
  const currentRank = state.gameRankings[state.currentPickIndex];
  if(!currentRank) {
    // All picked
    setTimeout(showReveal, 1000);
    return;
  }
  
  if(currentRank.studentId !== state.me) {
    // Simulate other student picking after 1.5s
    setTimeout(() => {
      const avail = state.layout.seats.filter(s=>s.status === 'available');
      if(avail.length > 0) {
        const randSeat = avail[Math.floor(Math.random() * avail.length)];
        executePick(randSeat.id, currentRank.studentId);
      }
    }, 1500);
  }
}

window.pickSeat = (seatId) => {
  const currentRank = state.gameRankings[state.currentPickIndex];
  if(currentRank.studentId !== state.me) {
    showToast('아직 내 차례가 아닙니다!', 'warning');
    return;
  }
  const seat = state.layout.seats.find(s=>s.id === seatId);
  if(seat.status !== 'available') {
    showToast('이미 선택된 자리입니다.', 'error');
    return;
  }
  executePick(seatId, state.me);
};

function executePick(seatId, studentId) {
  const seat = state.layout.seats.find(s=>s.id === seatId);
  seat.status = 'taken';
  seat.occupantId = studentId;
  
  state.currentPickIndex++;
  updateSeatPickUI();
  processNextPick();
}

// ==========================================
// 8. REVEAL
// ==========================================
function showReveal() {
  showScreen('reveal');
  const grid = document.getElementById('reveal-classroom');
  grid.innerHTML = state.layout.seats.map((seat, i) => {
    let content = '';
    if(seat.occupantId) {
      const occ = state.students.find(x=>x.id === seat.occupantId);
      const emoji = occ ? (occ.gender === 'M' ? '👦' : '👧') : '👶';
      content = `<span class="reveal-seat-emoji">${emoji}</span><span>${occ ? occ.name : ''}</span>`;
    }
    return `<div class="reveal-seat" style="animation-delay:${i*0.1}s">${content}</div>`;
  }).join('');
  
  setTimeout(() => {
    const seats = document.querySelectorAll('.reveal-seat');
    seats.forEach(s => s.classList.add('revealed'));
    fireConfetti();
  }, 500);
}

function fireConfetti() {
  for(let i=0; i<50; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = `${Math.random()*100}vw`;
    p.style.backgroundColor = `hsl(${Math.random()*360}, 100%, 60%)`;
    p.style.animationDuration = `${Math.random()*2+2}s`;
    document.body.appendChild(p);
    setTimeout(()=>p.remove(), 4000);
  }
}

// ==========================================
// BOOTSTRAP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  renderLobby();
  showScreen('lobby');
});
