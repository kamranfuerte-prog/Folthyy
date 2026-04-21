import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, signOut, doc, setDoc, getDoc, onSnapshot } from './firebase-config.js';

/* ===== STATE ===== */
let currentUser = null;

const state = {
  calGoal: 2000,
  pGoal: 100, cGoal: 250, fGoal: 65,
  waterGlasses: 0, waterGoal: 8,
  mood: null,
  meals: []
};

// Sync state to Firestore
async function saveUserData() {
  if (!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  try {
    await setDoc(userRef, { data: state }, { merge: true });
  } catch (error) {
    console.error("Error saving data:", error);
  }
}

// Load state from Firestore
async function loadUserData(uid) {
  const userRef = doc(db, "users", uid);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists() && docSnap.data().data) {
    const savedData = docSnap.data().data;
    Object.assign(state, savedData);
  } else {
    // Save initial state if no document exists
    await saveUserData();
  }
  updateTotals();
  renderWater();
}

/* ===== FIREBASE AUTH ===== */
function initSSO() {
  const overlay = document.getElementById('login-overlay');
  const loginBtn = document.getElementById('login-google');
  
  // Real-time auth listener
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      overlay.style.display = 'none';
      
      // Setup user profile info in sidebar
      const userPic = document.querySelector('.sb-user img');
      const userName = document.querySelector('.sb-user strong');
      if(userPic && user.photoURL) userPic.src = user.photoURL;
      if(userName) userName.innerText = user.displayName.split(' ')[0] || 'User';

      // Load data from firestore
      loadUserData(user.uid);
    } else {
      currentUser = null;
      overlay.style.display = 'flex';
      
      // If URL param has login=google, attempt login automatically (redirect from landing page)
      if (new URLSearchParams(window.location.search).get('login') === 'google') {
        window.history.replaceState({}, document.title, window.location.pathname);
        loginBtn.click();
      }
    }
  });

  loginBtn.addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please note that Google SSO requires the app to be served over HTTP/HTTPS (not directly from a file).");
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await signOut(auth);
      // Reset state
      state.meals = [];
      state.waterGlasses = 0;
      state.mood = null;
      updateTotals();
      renderWater();
      localStorage.removeItem('folthy_logged_in');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
}

// "Database" for simulated NLP
const FOOD_DB = {
  'oatmeal': { cal: 150, p: 5, c: 27, f: 3 },
  'berries': { cal: 50, p: 1, c: 12, f: 0 },
  'apple': { cal: 95, p: 0, c: 25, f: 0 },
  'banana': { cal: 105, p: 1, c: 27, f: 0 },
  'coffee': { cal: 5, p: 0, c: 0, f: 0 },
  'latte': { cal: 180, p: 8, c: 15, f: 8 },
  'yogurt': { cal: 130, p: 17, c: 9, f: 0 },
  'chicken': { cal: 220, p: 40, c: 0, f: 5 },
  'salad': { cal: 100, p: 2, c: 10, f: 5 },
  'rice': { cal: 216, p: 5, c: 45, f: 2 },
  'eggs': { cal: 140, p: 12, c: 2, f: 10 },
  'toast': { cal: 80, p: 3, c: 15, f: 1 },
  'salmon': { cal: 280, p: 25, c: 0, f: 18 }
};

/* ===== MOOD OVERLAY ===== */
function initMood() {
  const h = new Date().getHours();
  document.getElementById('time-greeting').innerText = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  document.getElementById('today-date-label').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const overlay = document.getElementById('mood-overlay');
  const pills = document.querySelectorAll('.mood-pill');
  const bigPath = document.getElementById('big-blob-path');
  const sbChip = document.getElementById('sb-mood-chip');
  const mbBadge = document.getElementById('mood-badge');

  let curMood = 'happy';

  const blobShapes = {
    happy: 'M60,6 C85,6 110,28 108,58 C106,86 84,114 60,114 C36,114 14,86 12,58 C10,28 35,6 60,6Z',
    energized: 'M60,6 C80,10 110,25 105,58 C100,90 80,114 60,114 C40,114 20,90 15,58 C10,25 40,10 60,6Z',
    calm: 'M60,10 C85,8 108,25 108,58 C108,90 85,110 60,110 C35,110 12,90 12,58 C12,25 35,8 60,10Z',
    normal: 'M60,15 C85,15 105,35 105,60 C105,85 85,105 60,105 C35,105 15,85 15,60 C15,35 35,15 60,15Z',
    tired: 'M60,20 C90,20 110,40 110,65 C110,90 85,100 60,100 C35,100 10,90 10,65 C10,40 30,20 60,20Z',
    stressed: 'M60,5 C90,5 110,30 105,60 C100,90 85,110 60,110 C35,110 20,90 15,60 C10,30 30,5 60,5Z'
  };

  const mouthPaths = {
    happy: 'M44,78 Q60,88 76,78',
    energized: 'M44,78 Q60,90 76,78',
    calm: 'M44,76 Q60,80 76,76',
    normal: 'M44,78 L76,78',
    tired: 'M44,78 Q60,74 76,78',
    stressed: 'M44,80 Q60,70 76,80'
  };

  pills.forEach(p => p.addEventListener('click', () => {
    pills.forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    curMood = p.dataset.mood;
    bigPath.setAttribute('fill', p.dataset.color);
    bigPath.setAttribute('d', blobShapes[curMood]);
    document.getElementById('mouth').setAttribute('d', mouthPaths[curMood]);
  }));

  const closeMood = () => {
    overlay.classList.add('hidden');
    state.mood = Array.from(pills).find(p => p.classList.contains('active')).dataset.label;
    sbChip.innerText = state.mood;
    mbBadge.innerText = state.mood;
    saveUserData(); // Save mood to Firestore
  };

  document.getElementById('mood-ok').addEventListener('click', closeMood);
  document.getElementById('mood-skip').addEventListener('click', closeMood);
  mbBadge.addEventListener('click', () => overlay.classList.remove('hidden'));
  sbChip.addEventListener('click', () => overlay.classList.remove('hidden'));
}

/* ===== APP NAV ===== */
function initNav() {
  const switchPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${id}`).classList.add('active');
    document.querySelectorAll('[data-page]').forEach(n => n.classList.remove('active'));
    document.querySelectorAll(`[data-page="${id}"]`).forEach(n => n.classList.add('active'));
    window.scrollTo(0,0);
  };
  document.querySelectorAll('[data-page]').forEach(n => {
    n.addEventListener('click', () => switchPage(n.dataset.page));
  });
}

/* ===== LOGIC & RENDER ===== */
function updateTotals() {
  let tCal=0, tP=0, tC=0, tF=0;
  state.meals.forEach(m => { tCal+=m.cal; tP+=m.p; tC+=m.c; tF+=m.f; });

  // Rings & macros
  document.getElementById('ring-cal').innerText = tCal;
  document.getElementById('ring-goal').innerText = state.calGoal;
  const left = state.calGoal - tCal;
  document.getElementById('ring-left').innerText = left > 0 ? `${left} left` : 'Over goal!';
  document.getElementById('ring-left').style.color = left < 0 ? '#FF6B6B' : 'var(--coral)';

  const circ = document.getElementById('cal-ring-circle');
  const pct = Math.min(tCal / state.calGoal, 1);
  circ.style.strokeDashoffset = 352 - (352 * pct);

  document.getElementById('mp-protein').innerText = tP;
  document.getElementById('mp-carbs').innerText = tC;
  document.getElementById('mp-fat').innerText = tF;

  // Goals page
  document.getElementById('g-cal-curr').innerText = tCal;
  document.getElementById('g-p-curr').innerText = tP;
  document.getElementById('g-c-curr').innerText = tC;
  document.getElementById('g-f-curr').innerText = tF;
  document.getElementById('g-w-curr').innerText = state.waterGlasses;

  document.getElementById('gf-cal').style.width = Math.min((tCal/state.calGoal)*100,100) + '%';
  document.getElementById('gf-p').style.width = Math.min((tP/state.pGoal)*100,100) + '%';
  document.getElementById('gf-c').style.width = Math.min((tC/state.cGoal)*100,100) + '%';
  document.getElementById('gf-f').style.width = Math.min((tF/state.fGoal)*100,100) + '%';
  document.getElementById('gf-w').style.width = Math.min((state.waterGlasses/state.waterGoal)*100,100) + '%';

  // Sections
  const types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const emojis = { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙', Snack: '🍎' };
  
  types.forEach(t => {
    const arr = state.meals.filter(m => m.type === t);
    const cal = arr.reduce((sum, m) => sum + m.cal, 0);
    const cid = t === 'Breakfast' ? 'bk-cal' : t === 'Lunch' ? 'ln-cal' : t === 'Dinner' ? 'dn-cal' : 'sn-cal';
    document.getElementById(cid).innerText = `${cal} kcal`;

    const el = document.getElementById(`entries-${t.toLowerCase()}`);
    if(!arr.length) {
      const emptyMsgs = {
        Breakfast: 'No meals logged yet today. Type something above! 📝',
        Lunch: 'Hungry for lunch? 🥗',
        Dinner: 'Time for a healthy dinner! 🌙',
        Snack: 'Need a quick snack? 🍎'
      };
      el.innerHTML = `<div class="meal-empty">${emptyMsgs[t]}</div>`;
    } else {
      el.innerHTML = arr.map(m => `
        <div class="meal-entry">
          <div class="me-emoji">${emojis[t]}</div>
          <div class="me-info">
            <div class="me-name">${m.name}</div>
            <div class="me-macros">P ${m.p}g • C ${m.c}g • F ${m.f}g</div>
          </div>
          <div class="me-cal">${m.cal} cal</div>
          <button class="me-del" data-id="${m.id}">✕</button>
        </div>
      `).join('');
    }
  });

  // History empty state
  const historyList = document.getElementById('history-list');
  if (state.meals.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        <p>Your food journey starts here! 📅</p>
        <button class="btn-main" onclick="document.querySelector('[data-page=today]').click()">Start Tracking</button>
      </div>`;
  } else {
    // History logic would go here if we were persisting previous days
  }

  // Insights empty state
  const insightEmpty = document.getElementById('insight-empty');
  const insightContent = document.getElementById('insight-content');
  if (state.meals.length < 5) { // Show empty state until at least 5 meals logged (arbitrary)
    insightEmpty.style.display = 'block';
    insightContent.style.display = 'none';
  } else {
    insightEmpty.style.display = 'none';
    insightContent.style.display = 'block';
  }

  document.querySelectorAll('.me-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.dataset.id);
      state.meals = state.meals.filter(m => m.id !== id);
      updateTotals();
      saveUserData(); // Save to Firestore
    });
  });
}

/* ===== WATER ===== */
function renderWater() {
  const row = document.getElementById('water-drops-row');
  row.innerHTML = '';
  for(let i=0; i<state.waterGoal; i++) {
    const b = document.createElement('button');
    b.className = 'water-drop-btn' + (i < state.waterGlasses ? ' filled' : '');
    b.innerText = '💧';
    b.addEventListener('click', () => { 
      state.waterGlasses = i+1; 
      updateTotals(); 
      renderWater(); 
      saveUserData(); // Save to Firestore
    });
    row.appendChild(b);
  }
  document.getElementById('water-label').innerText = state.waterGlasses > 0 ? `${state.waterGlasses} / ${state.waterGoal} glasses` : 'Stay hydrated! 💧';
}

document.getElementById('water-add-btn').addEventListener('click', () => {
  if(state.waterGlasses < state.waterGoal) {
    state.waterGlasses++;
    updateTotals(); 
    renderWater();
    saveUserData(); // Save to Firestore
  }
});

/* ===== LOGGING / NLP SIM ===== */
const input = document.getElementById('meal-input');
let pendingMeal = null;

function guessNutrition(text) {
  let cal=0, p=0, c=0, f=0;
  const t = text.toLowerCase();
  Object.keys(FOOD_DB).forEach(k => {
    if(t.includes(k)) {
      cal += FOOD_DB[k].cal; p += FOOD_DB[k].p; c += FOOD_DB[k].c; f += FOOD_DB[k].f;
    }
  });
  if(cal === 0) { cal = 150; p = 5; c = 20; f = 5; } // fallback
  return { name: text.trim(), cal, p, c, f };
}

function submitLog() {
  if(!input.value.trim()) return;
  pendingMeal = guessNutrition(input.value);
  document.getElementById('picker-food-name').innerText = `"${pendingMeal.name}" (${pendingMeal.cal} kcal)`;
  document.getElementById('picker-overlay').classList.add('open');
  input.value = '';
}

document.getElementById('add-btn').addEventListener('click', submitLog);
input.addEventListener('keydown', e => { if(e.key === 'Enter') submitLog(); });

document.querySelectorAll('.pick-btn').forEach(b => {
  b.addEventListener('click', (e) => {
    pendingMeal.type = e.target.dataset.type;
    pendingMeal.id = Date.now();
    state.meals.push(pendingMeal);
    document.getElementById('picker-overlay').classList.remove('open');
    pendingMeal = null;
    updateTotals();
    saveUserData(); // Save to Firestore
  });
});
document.getElementById('pick-cancel').addEventListener('click', () => {
  document.getElementById('picker-overlay').classList.remove('open');
  pendingMeal = null;
});

// Quick Adds
document.querySelectorAll('.qa-chip').forEach(c => {
  c.addEventListener('click', () => {
    input.value = c.dataset.food;
    submitLog();
  });
});

/* ===== INSIGHTS CHART ===== */
function initChart() {
  const data = [
    {d:'Mon', c:2100, p:90}, {d:'Tue', c:1850, p:70}, {d:'Wed', c:2050, p:85},
    {d:'Thu', c:1760, p:65}, {d:'Fri', c:1980, p:82}, {d:'Sat', c:2200, p:95},
    {d:'Sun', c:0, p:0, t:true}
  ];
  const chart = document.getElementById('week-bars');
  chart.innerHTML = data.map(x => {
    const h = x.p ? Math.max(10, x.p) : 5;
    const bg = x.t ? 'var(--coral)' : '#EAF3FF';
    const c = x.t ? '#fff' : 'var(--muted)';
    return `<div class="wb-item">
      <span class="wb-cal">${x.c ? x.c : ''}</span>
      <div class="wb-bar" style="height:${h}%; background:${bg}"></div>
      <span class="wb-day" style="color:${c}">${x.d}</span>
    </div>`;
  }).join('');
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initSSO();
  initMood();
  initNav();
  renderWater();
  updateTotals();
  initChart();
});
