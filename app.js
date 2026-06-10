// ═══════════════════════════════════════════════════════════════
//  SchoolPro — Complete App  v1.0
//  Firebase Auth + Firestore | PWA | 4 Roles
// ═══════════════════════════════════════════════════════════════

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, serverTimestamp, updateDoc, limit }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────────────
//  ⚠️  PASTE YOUR FIREBASE CONFIG HERE  (see SETUP.md)
// ─────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBepfsv5cUJYLoEZVjLQs_Dp8Y8wGq3DqU",
  authDomain:        "iqra-model-school-pabbi.firebaseapp.com",
  projectId:         "iqra-model-school-pabbi",
  storageBucket:     "iqra-model-school-pabbi.firebasestorage.app",
  messagingSenderId: "913481081823",
  appId:             "1:913481081823:web:840e865c726f6368fe9a6a"
};
// ─────────────────────────────────────────────────────────────────

const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// ── Constants ─────────────────────────────────────────────────────
const MONTHS_PKT = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const MONTH_KEYS = ['04','05','06','07','08','09','10','11','12','01','02','03'];
const MONTH_NAMES = {
  '01':'January','02':'February','03':'March','04':'April','05':'May','06':'June',
  '07':'July','08':'August','09':'September','10':'October','11':'November','12':'December'
};

// ── State ──────────────────────────────────────────────────────────
let currentUser  = null;
let userProfile  = null;
let schoolConfig = {};
let allStudents  = [];
let allStaff     = [];
let attData      = {};
let feeCache     = {};
let currentPage  = 'dashboard';

// ══════════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  setTimeout(() => {
    const s = document.getElementById('splash');
    s.style.transition = 'opacity .4s';
    s.style.opacity = '0';
    setTimeout(() => s.classList.add('hidden'), 400);
  }, 1800);
});

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    await loadUserProfile(user);
    await loadSchoolConfig();
    initUI();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    showPage('dashboard');
  } else {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }
});

document.getElementById('google-login-btn').onclick = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch(e) {
    toast('Login failed: ' + e.message, 'error');
  }
};

window.doLogout = async () => { await signOut(auth); window.location.reload(); };

// ══════════════════════════════════════════════════════════════════
//  PROFILE & CONFIG
// ══════════════════════════════════════════════════════════════════
async function loadUserProfile(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    userProfile = snap.data();
  } else {
    userProfile = {
      uid: user.uid, name: user.displayName,
      email: user.email, photo: user.photoURL,
      role: 'parent', createdAt: serverTimestamp()
    };
    await setDoc(ref, userProfile);
  }
}

async function loadSchoolConfig() {
  const snap = await getDoc(doc(db, 'schools', 'config'));
  if (snap.exists()) {
    schoolConfig = snap.data();
  } else {
    schoolConfig = {
      name: 'Your School Name', principal: '', phone: '', address: '',
      year: '2025-26',
      classes:  ['Nursery','KG','Class 1','Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8'],
      subjects: ['Urdu','English','Math','Science','Islamiat','General Knowledge','Computer','Arts']
    };
    await setDoc(doc(db, 'schools', 'config'), schoolConfig);
  }
}

// ══════════════════════════════════════════════════════════════════
//  INIT UI
// ══════════════════════════════════════════════════════════════════
function initUI() {
  const role  = userProfile?.role || 'parent';
  const name  = currentUser.displayName || 'User';
  const photo = currentUser.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1565C0&color=fff&size=128`;

  // Topbar & sidebar
  document.getElementById('user-avatar').src    = photo;
  document.getElementById('sidebar-avatar').src = photo;
  document.getElementById('sidebar-name').textContent  = name;
  document.getElementById('sidebar-role').textContent  = role.charAt(0).toUpperCase()+role.slice(1);
  document.getElementById('sidebar-school-name').textContent = '📚 '+(schoolConfig.name||'School');

  // Profile page
  document.getElementById('profile-avatar').src   = photo;
  document.getElementById('profile-name').textContent  = name;
  document.getElementById('profile-email').textContent = currentUser.email||'';
  document.getElementById('profile-role-badge').textContent = role;

  // Role-based nav
  document.querySelectorAll('#nav-list li[data-roles]').forEach(li => {
    li.style.display = li.dataset.roles.split(',').includes(role) ? '' : 'none';
  });

  // Bottom nav: hide fees for parent/teacher
  if (role === 'parent' || role === 'teacher') {
    const b = document.querySelector('#bottom-nav [data-page="fees"]');
    if (b) b.style.display = 'none';
  }

  // Hide write buttons for parents
  if (role === 'parent') {
    ['add-notice-btn','add-hw-btn','add-tt-btn','add-exam-btn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // Greeting
  const h = new Date().getHours();
  document.getElementById('greeting-time').textContent =
    h < 12 ? 'Good morning ☀️' : h < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
  document.getElementById('greeting-name').textContent = name.split(' ')[0] + ' 👋';
  document.getElementById('dash-year').textContent = schoolConfig.year || '2025-26';
  document.getElementById('dash-month-label').textContent =
    '— ' + new Date().toLocaleString('default', {month:'long', year:'numeric'});

  // Settings prefill
  document.getElementById('set-school-name').value = schoolConfig.name || '';
  document.getElementById('set-principal').value   = schoolConfig.principal || '';
  document.getElementById('set-phone').value        = schoolConfig.phone || '';
  document.getElementById('set-address').value      = schoolConfig.address || '';
  document.getElementById('set-classes').value      = (schoolConfig.classes||[]).join(',');
  document.getElementById('set-subjects').value     = (schoolConfig.subjects||[]).join(',');

  // Set year select
  const yearSel = document.getElementById('set-year');
  if (yearSel) yearSel.value = schoolConfig.year || '2025-26';

  populateClassSelects();
  populateSubjectSelects();
  populateSalaryMonths();
  setupNavListeners();
}

// ══════════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════════
function setupNavListeners() {
  document.querySelectorAll('#nav-list li[data-page]').forEach(li => {
    li.onclick = () => showPage(li.dataset.page);
  });
}

window.showPage = function(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#nav-list li').forEach(l => l.classList.remove('active'));

  const el = document.getElementById('page-'+page);
  if (el) el.classList.add('active');

  const titles = {
    dashboard:'Dashboard', students:'Students', fees:'Fee Ledger',
    attendance:'Attendance', exams:'Exams & Marks', notices:'Notice Board',
    homework:'Homework Diary', timetable:'Timetable', staff:'Staff',
    salary:'Salary', users:'Manage Users', settings:'Settings', profile:'My Profile'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  document.querySelector(`#bottom-nav [data-page="${page}"]`)?.classList.add('active');
  document.querySelector(`#nav-list [data-page="${page}"]`)?.classList.add('active');
  closeSidebar();

  const loaders = {
    dashboard:  loadDashboard,
    students:   loadStudents,
    fees:       loadFees,
    attendance: loadAttendance,
    exams:      loadExams,
    notices:    loadNotices,
    homework:   loadHomework,
    timetable:  loadTimetable,
    staff:      loadStaff,
    salary:     loadSalary,
    users:      loadUsers,
  };
  loaders[page]?.();
};

window.toggleSidebar = () => {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  const open = sb.classList.toggle('open');
  ov.style.display = open ? 'block' : 'none';
};
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

// ══════════════════════════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════════════════════════
window.openModal  = id => document.getElementById(id).classList.remove('hidden');
window.closeModal = id => document.getElementById(id).classList.add('hidden');

// ══════════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════════
function toast(msg, type='info', ms=3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  el.textContent = (icons[type]||'') + ' ' + msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, ms);
}

// ══════════════════════════════════════════════════════════════════
//  POPULATE SELECTS
// ══════════════════════════════════════════════════════════════════
function populateClassSelects() {
  const cls = schoolConfig.classes || [];
  const filterIds = ['fee-class-filter','att-class','exam-class','hw-class','tt-class'];
  const directIds = ['s-class','em-class','hw-cls','tt-cls'];

  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">All Classes</option>` + cls.map(c=>`<option>${c}</option>`).join('');
    if (cur) el.value = cur;
  });
  directIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="">Select Class</option>` + cls.map(c=>`<option>${c}</option>`).join('');
  });

  // Class filter chips for students
  const chips = document.getElementById('class-filter-chips');
  if (chips) {
    chips.innerHTML = `<span class="chip active" data-class="" onclick="filterByClass(this,'')">All</span>` +
      cls.map(c=>`<span class="chip" data-class="${c}" onclick="filterByClass(this,'${c}')">${c}</span>`).join('');
  }
  // Fee year class filter
  const feeYr = document.getElementById('fee-year-filter');
  if (feeYr && !feeYr.value) feeYr.value = schoolConfig.year || '2025-26';
}

function populateSubjectSelects() {
  const subs = schoolConfig.subjects || [];
  ['em-subject','hw-sub','tt-sub'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = subs.map(s=>`<option>${s}</option>`).join('');
  });
}

function populateSalaryMonths() {
  const el = document.getElementById('sal-month');
  if (!el) return;
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  el.innerHTML = months.map((m,i)=>`<option value="${pad(i+1)}">${m}</option>`).join('');
  el.value = pad(new Date().getMonth()+1);
}

// ══════════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════════
async function loadDashboard() {
  const role = userProfile?.role || 'parent';

  // Parent: show their child's info only
  if (role === 'parent') { loadParentDashboard(); return; }

  try {
    const [stuSnap, stfSnap, feeSnap, expSnap] = await Promise.all([
      getDocs(query(collection(db,'students'), where('status','==','Active'))),
      getDocs(query(collection(db,'staff'),    where('status','==','Active'))),
      getDocs(collection(db,'fees')),
      getDocs(collection(db,'expenses'))
    ]);
    const students = stuSnap.docs.map(d=>d.data());
    const staff    = stfSnap.docs.map(d=>d.data());
    const fees     = feeSnap.docs.map(d=>d.data());
    const expenses = expSnap.docs.map(d=>d.data());

    const male   = students.filter(s=>s.gender==='Male').length;
    const female = students.filter(s=>s.gender==='Female').length;
    const salBill   = staff.reduce((s,x)=>s+(x.salary||0),0);
    const collected = fees.reduce((s,f)=>s+(f.paid||0),0);
    const totalDue  = fees.filter(f=>f.status!=='Paid'&&f.status!=='Exempt')
                          .reduce((s,f)=>s+Math.max(0,(f.due||0)-(f.paid||0)),0);
    const totalExp  = expenses.reduce((s,x)=>s+(x.amount||0),0);
    const paidCount = fees.filter(f=>f.status==='Paid').length;
    const unpaid    = fees.filter(f=>f.status==='Unpaid'||f.status==='Partial').length;

    // Stats cards
    document.getElementById('dash-stats').innerHTML = [
      {icon:'🎓', val:students.length,        lbl:'Total Students',    sub:`${male}M · ${female}F`,         color:'blue',   page:'students'},
      {icon:'💳', val:'Rs '+fmt(collected),    lbl:'Total Collected',   sub:`${paidCount} payments`,          color:'green',  page:'fees'},
      {icon:'⚠️', val:'Rs '+fmt(totalDue),     lbl:'Outstanding Dues',  sub:`${unpaid} unpaid months`,        color:'red',    page:'fees'},
      {icon:'👨‍🏫', val:staff.length,            lbl:'Active Staff',      sub:'Bill: Rs '+fmt(salBill),         color:'teal',   page:'staff'},
      {icon:'💸', val:'Rs '+fmt(totalExp),      lbl:'Total Expenses',    sub:'All recorded',                   color:'amber',  page:'salary'},
      {icon:'📅', val:paidCount+unpaid>0?Math.round(paidCount/(paidCount+unpaid)*100)+'%':'—',
                                               lbl:'Collection Rate',   sub:'Paid vs billed',                 color:'purple', page:'fees'},
    ].map(s=>`
      <div class="stat-card ${s.color}" onclick="showPage('${s.page}')">
        <div class="stat-icon">${s.icon}</div>
        <div class="stat-val">${s.val}</div>
        <div class="stat-lbl">${s.lbl}</div>
        <div class="stat-sub">${s.sub}</div>
      </div>`).join('');

    // Monthly chart Apr-Mar
    const year      = schoolConfig.year || '2025-26';
    const yearStart = parseInt(year.split('-')[0]);
    const chartVals = MONTHS_PKT.map((m,i)=>{
      const mKey = MONTH_KEYS[i];
      const y    = i < 9 ? yearStart : yearStart+1;
      return fees.filter(f=>f.month===mKey&&f.year===String(y))
                 .reduce((s,f)=>s+(f.paid||0),0);
    });
    const maxC = Math.max(...chartVals,1);
    document.getElementById('fee-chart').innerHTML = `
      <div class="chart-bars">
        ${MONTHS_PKT.map((m,i)=>`
          <div class="chart-col">
            <div class="chart-bar collected" style="height:${Math.max(3,Math.round(chartVals[i]/maxC*76))}px"
              title="Rs ${fmt(chartVals[i])}"></div>
            <div class="chart-lbl">${m}</div>
          </div>`).join('')}
      </div>
      <div class="chart-legend">
        <span><span class="cl-dot" style="background:var(--blue3)"></span>Monthly Collected (Rs)</span>
      </div>`;

    // Recent fee activity
    const recent = [...fees].sort((a,b)=>{ 
      const ta = a.createdAt?.seconds||0, tb = b.createdAt?.seconds||0; return tb-ta; 
    }).slice(0,6);
    document.getElementById('recent-activity').innerHTML = recent.length
      ? recent.map(f=>`
          <div class="activity-item">
            <div class="activity-icon">💳</div>
            <div class="activity-text">
              <strong>${f.studentName||'—'} — Rs ${fmt(f.paid||0)}</strong>
              <small>${f.monthLabel||f.month||''} · ${f.paymentDate||''} · ${f.paymentMode||'Cash'}</small>
            </div>
            <span class="s-badge ${f.status==='Paid'?'active':'inactive'}">${f.status}</span>
          </div>`).join('')
      : emptyState('💳','No recent payments');

  } catch(e) { toast('Dashboard error: '+e.message,'error'); }
}

async function loadParentDashboard() {
  const sid = userProfile?.studentId;
  if (!sid) {
    document.getElementById('dash-stats').innerHTML = `
      <div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text2)">
        Your account is pending. Contact school admin to link your child's record.
      </div>`;
    return;
  }
  try {
    // Find student
    const sSnap = await getDocs(query(collection(db,'students'), where('studentId','==',sid)));
    if (sSnap.empty) { toast('Student record not found','error'); return; }
    const s = sSnap.docs[0].data();
    const docId = sSnap.docs[0].id;

    // Fee status for current year
    const fSnap = await getDocs(query(collection(db,'fees'), where('studentId','==',docId)));
    const fees  = fSnap.docs.map(d=>d.data());
    const paid  = fees.reduce((t,f)=>t+(f.paid||0),0);
    const due   = fees.filter(f=>f.status!=='Paid').reduce((t,f)=>t+Math.max(0,(f.due||0)-(f.paid||0)),0);

    document.getElementById('dash-stats').innerHTML = [
      {icon:'🎓', val:s.fullName,     lbl:'Student',     sub:s.class+' '+s.section, color:'blue',  page:'students'},
      {icon:'💳', val:'Rs '+fmt(paid), lbl:'Fee Paid',    sub:'This year',            color:'green', page:'fees'},
      {icon:'⚠️', val:'Rs '+fmt(due),  lbl:'Fee Due',     sub:'Outstanding',          color:due>0?'red':'green', page:'fees'},
      {icon:'📅', val:s.status,        lbl:'Status',      sub:'Academic '+s.year,     color:'teal',  page:'profile'},
    ].map(c=>`
      <div class="stat-card ${c.color}" onclick="showPage('${c.page}')">
        <div class="stat-icon">${c.icon}</div>
        <div class="stat-val" style="font-size:${c.val.length>8?'14px':'26px'}">${c.val}</div>
        <div class="stat-lbl">${c.lbl}</div>
        <div class="stat-sub">${c.sub}</div>
      </div>`).join('');

    document.getElementById('fee-chart').innerHTML = `<div style="padding:8px;text-align:center;color:var(--text2);font-size:13px">Fee chart visible to admin/accountant</div>`;
    document.getElementById('recent-activity').innerHTML = `
      <div class="activity-item" onclick="showPage('notices')">
        <div class="activity-icon">📢</div>
        <div class="activity-text"><strong>Notice Board</strong><small>Tap to view latest notices</small></div>
      </div>
      <div class="activity-item" onclick="showPage('homework')">
        <div class="activity-icon">📖</div>
        <div class="activity-text"><strong>Homework Diary</strong><small>Tap to view assignments</small></div>
      </div>
      <div class="activity-item" onclick="showPage('exams')">
        <div class="activity-icon">📝</div>
        <div class="activity-text"><strong>Exam Results</strong><small>View marks and grades</small></div>
      </div>`;
  } catch(e) { toast('Error loading student info','error'); }
}

// ══════════════════════════════════════════════════════════════════
//  STUDENTS
// ══════════════════════════════════════════════════════════════════
async function loadStudents() {
  try {
    const snap = await getDocs(query(collection(db,'students'), orderBy('fullName')));
    allStudents = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderStudents(allStudents);
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function renderStudents(list) {
  const el = document.getElementById('students-list');
  if (!list.length) { el.innerHTML = emptyState('🎓','No students found. Add your first student.'); return; }
  el.innerHTML = list.map(s=>`
    <div class="student-card">
      <div class="s-avatar">${initial(s.fullName)}</div>
      <div class="s-info">
        <div class="s-name">${s.fullName||'—'}</div>
        <div class="s-meta">${s.studentId||''} · ${s.class||''} ${s.section||''} · ${s.fatherName||''}</div>
        <div class="s-meta">📞 ${s.contact||'—'} · <strong>Rs ${fmt(s.netFee||0)}/mo</strong></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="s-badge ${(s.status||'Active').toLowerCase()}">${s.status||'Active'}</span>
        <div class="s-actions">
          <button onclick='openEditStudent(${JSON.stringify(s)})'>✏️</button>
          <button onclick="delStudent('${s.id}')">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

window.filterStudents = val => {
  const v = val.toLowerCase();
  renderStudents(allStudents.filter(s=>
    (s.fullName||'').toLowerCase().includes(v)||
    (s.studentId||'').toLowerCase().includes(v)||
    (s.class||'').toLowerCase().includes(v)||
    (s.fatherName||'').toLowerCase().includes(v)
  ));
};

window.filterByClass = (chip, cls) => {
  document.querySelectorAll('.filter-chips .chip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  renderStudents(cls ? allStudents.filter(s=>s.class===cls) : allStudents);
};

window.openEditStudent = function(s) {
  const set = (id,v) => { const e=document.getElementById(id); if(e) e.value=v||''; };
  set('s-id', s.id); set('s-sid', s.studentId); set('s-name', s.fullName);
  set('s-father', s.fatherName); set('s-section', s.section);
  set('s-dob', s.dob); set('s-contact', s.contact);
  set('s-fee', s.monthlyFee||0); set('s-discount', s.discount||0);
  set('s-admit', s.admissionDate); set('s-address', s.address);
  document.getElementById('s-class').value  = s.class||'';
  document.getElementById('s-gender').value = s.gender||'Male';
  document.getElementById('s-status').value = s.status||'Active';
  document.getElementById('s-blood').value  = s.bloodGroup||'A+';
  document.getElementById('student-modal-title').textContent = 'Edit Student';
  openModal('student-modal');
};

window.openAddModal = () => {
  ['s-id','s-sid','s-name','s-father','s-section','s-dob','s-contact',
   's-fee','s-discount','s-admit','s-address'].forEach(id=>{
    const e=document.getElementById(id); if(e) e.value='';
  });
  document.getElementById('student-modal-title').textContent = 'Add Student';
  openModal('student-modal');
};

window.saveStudent = async () => {
  const name = document.getElementById('s-name').value.trim();
  if (!name) { toast('Name is required','error'); return; }
  const sid  = document.getElementById('s-id').value;
  const mf   = parseFloat(document.getElementById('s-fee').value||0);
  const dc   = parseFloat(document.getElementById('s-discount').value||0);
  const data = {
    studentId: document.getElementById('s-sid').value.trim(),
    fullName:  name,
    fatherName: document.getElementById('s-father').value.trim(),
    class:      document.getElementById('s-class').value,
    section:    document.getElementById('s-section').value.trim(),
    gender:     document.getElementById('s-gender').value,
    dob:        document.getElementById('s-dob').value,
    contact:    document.getElementById('s-contact').value.trim(),
    monthlyFee: mf, discount: dc, netFee: mf-dc,
    admissionDate: document.getElementById('s-admit').value,
    status:     document.getElementById('s-status').value,
    address:    document.getElementById('s-address').value.trim(),
    bloodGroup: document.getElementById('s-blood').value,
    year:       schoolConfig.year||'2025-26',
    updatedAt:  serverTimestamp(),
  };
  try {
    if (sid) await setDoc(doc(db,'students',sid), data, {merge:true});
    else { data.createdAt=serverTimestamp(); await addDoc(collection(db,'students'),data); }
    toast('Student saved ✅','success');
    closeModal('student-modal');
    loadStudents();
  } catch(e) { toast('Save failed: '+e.message,'error'); }
};

window.delStudent = async id => {
  if (!confirm('Delete student? This cannot be undone.')) return;
  await deleteDoc(doc(db,'students',id));
  toast('Student deleted','info');
  loadStudents();
};

// ══════════════════════════════════════════════════════════════════
//  FEE LEDGER  (Student rows × 12 Month columns)
// ══════════════════════════════════════════════════════════════════
window.loadFees = async () => {
  const cls  = document.getElementById('fee-class-filter').value;
  const year = document.getElementById('fee-year-filter').value || schoolConfig.year || '2025-26';
  const yearStart = parseInt(year.split('-')[0]);

  try {
    let studQ = cls
      ? query(collection(db,'students'), where('class','==',cls), orderBy('fullName'))
      : query(collection(db,'students'), orderBy('fullName'));
    const studSnap  = await getDocs(studQ);
    const students  = studSnap.docs.map(d=>({id:d.id,...d.data()}));

    // Load all fee records for this academic year
    const feeSnap = await getDocs(query(collection(db,'fees'), where('academicYear','==',year)));
    feeCache = {};
    feeSnap.docs.forEach(d=>{
      const f=d.data();
      feeCache[`${f.studentId}_${f.month}`] = {...f, docId:d.id};
    });

    // Build summary totals
    let sumBilled=0, sumPaid=0;
    students.forEach(s=>{
      sumBilled += (s.netFee||0)*12;
      MONTH_KEYS.forEach(mk=>{
        const f = feeCache[`${s.id}_${mk}`];
        if (f) sumPaid += (f.paid||0);
      });
    });

    document.getElementById('fee-summary').innerHTML = `
      <div class="fee-sum-card total"><div class="val">Rs ${fmt(sumBilled)}</div><div class="lbl">Annual Billed</div></div>
      <div class="fee-sum-card collected"><div class="val">Rs ${fmt(sumPaid)}</div><div class="lbl">Collected</div></div>
      <div class="fee-sum-card due"><div class="val">Rs ${fmt(Math.max(0,sumBilled-sumPaid))}</div><div class="lbl">Outstanding</div></div>
      <div class="fee-sum-card total"><div class="val">${students.length}</div><div class="lbl">Students</div></div>`;

    // Build table header  (sticky name col + 12 month cols)
    document.getElementById('fee-thead').innerHTML = `<tr>
      <th class="name-col"># &nbsp;Student Name</th>
      ${MONTHS_PKT.map((m,i)=>{
        const y = i<9 ? yearStart : yearStart+1;
        return `<th title="${m} ${y}">${m}<br><span style="font-weight:400;font-size:9px;opacity:.6">${y}</span></th>`;
      }).join('')}
      <th>Billed</th><th>Paid</th><th>Due</th>
    </tr>`;

    // Build rows
    document.getElementById('fee-tbody').innerHTML = students.map((s,idx)=>{
      let sPaid=0, sDue=0;
      const cells = MONTHS_PKT.map((m,i)=>{
        const mk  = MONTH_KEYS[i];
        const y   = i<9 ? yearStart : yearStart+1;
        const key = `${s.id}_${mk}`;
        const fee = feeCache[key];
        const nf  = s.netFee||0;
        let cls2='due', label='—';
        if (fee) {
          if (fee.status==='Paid')    { cls2='paid';    label='✓'; sPaid+=fee.paid||0; }
          else if(fee.status==='Partial') { cls2='partial'; label='~'; sPaid+=fee.paid||0; sDue+=nf-(fee.paid||0); }
          else if(fee.status==='Exempt')  { cls2='exempt';  label='E'; }
          else { sDue+=nf; label='—'; }
        } else { sDue+=nf; }
        const ml = `${m} ${y}`;
        return `<td><span class="fee-cell ${cls2}"
          onclick="openFeeModal('${s.id}','${esc(s.fullName)}','${esc(s.class||'')}','${mk}','${ml}',${nf},'${fee?.docId||''}','${fee?.status||''}')"
          title="${ml} · ${s.fullName}">${label}</span></td>`;
      }).join('');
      const rowBilled = (s.netFee||0)*12;
      return `<tr>
        <td class="name-col">${idx+1} &nbsp;${s.fullName}</td>
        ${cells}
        <td style="font-size:10px;color:var(--text2);white-space:nowrap">Rs ${fmt(rowBilled)}</td>
        <td style="color:#66BB6A;font-weight:700;font-size:11px;white-space:nowrap">Rs ${fmt(sPaid)}</td>
        <td style="color:var(--red2);font-weight:700;font-size:11px;white-space:nowrap">${sDue>0?'Rs '+fmt(sDue):'✓'}</td>
      </tr>`;
    }).join('');

  } catch(e) { toast('Fee error: '+e.message,'error'); }
};

window.openFeeModal = (studentId, name, cls, monthKey, monthLabel, netFee, docId, status) => {
  document.getElementById('f-student-id').value = studentId;
  document.getElementById('f-month-key').value  = monthKey;
  document.getElementById('f-due').value         = netFee;
  document.getElementById('f-date').value        = today();
  document.getElementById('f-receipt').value     = 'RCP-'+Date.now().toString().slice(-6);
  document.getElementById('fee-modal-title').textContent = `${monthLabel} — ${name}`;
  document.getElementById('fee-modal-student-info').innerHTML =
    `<strong>${name}</strong> · ${cls}<br>Month: <strong>${monthLabel}</strong> · Monthly Fee: <strong>Rs ${fmt(netFee)}</strong>${status?' · Status: <span class="s-badge '+status.toLowerCase()+'">'+status+'</span>':''}`;
  // Pre-fill if already paid
  const existing = feeCache[`${studentId}_${monthKey}`];
  document.getElementById('f-paid').value     = existing?.paid || netFee;
  document.getElementById('f-late').value     = existing?.lateFee || '';
  document.getElementById('f-discount').value = existing?.discount || '';
  document.getElementById('f-remarks').value  = existing?.remarks || '';
  openModal('fee-modal');
};

window.saveFeePayment = async () => {
  const studentId = document.getElementById('f-student-id').value;
  const monthKey  = document.getElementById('f-month-key').value;
  const paid      = parseFloat(document.getElementById('f-paid').value||0);
  const due       = parseFloat(document.getElementById('f-due').value||0);
  const late      = parseFloat(document.getElementById('f-late').value||0);
  const discount  = parseFloat(document.getElementById('f-discount').value||0);
  const year      = document.getElementById('fee-year-filter').value || schoolConfig.year;
  const yearStart = parseInt(year.split('-')[0]);
  const mi        = MONTH_KEYS.indexOf(monthKey);
  const y         = mi<9 ? yearStart : yearStart+1;

  const stuDoc = await getDoc(doc(db,'students',studentId));
  if (!stuDoc.exists()) { toast('Student not found','error'); return; }
  const stu = stuDoc.data();

  const feeRecord = {
    studentId,
    studentName: stu.fullName,
    class:       stu.class||'',
    month:       monthKey,
    monthLabel:  `${MONTHS_PKT[mi]} ${y}`,
    year:        String(y),
    academicYear: year,
    due,  paid,  lateFee: late, discount,
    total: paid+late,
    status: paid >= due ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
    paymentDate:  document.getElementById('f-date').value,
    paymentMode:  document.getElementById('f-mode').value,
    receiptNo:    document.getElementById('f-receipt').value.trim(),
    remarks:      document.getElementById('f-remarks').value.trim(),
    createdBy:    currentUser.uid,
    updatedAt:    serverTimestamp(),
  };

  try {
    const existing = feeCache[`${studentId}_${monthKey}`];
    if (existing?.docId) await setDoc(doc(db,'fees',existing.docId), feeRecord, {merge:true});
    else { feeRecord.createdAt=serverTimestamp(); await addDoc(collection(db,'fees'), feeRecord); }

    toast(`Payment recorded — Rs ${fmt(paid)} ✅`, 'success');
    closeModal('fee-modal');

    // Show receipt option
    if (feeRecord.status==='Paid') {
      setTimeout(() => {
        if (confirm('Print receipt?')) printReceipt(feeRecord, stu);
      }, 600);
    }
    loadFees();
  } catch(e) { toast('Save failed: '+e.message,'error'); }
};

// ── Print Receipt ──────────────────────────────────────────────────
function printReceipt(fee, stu) {
  const school = schoolConfig.name || 'School Name';
  const win = window.open('','_blank','width=420,height=600');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Fee Receipt</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:13px;margin:20px;color:#222}
    .head{text-align:center;border-bottom:2px solid #1565C0;padding-bottom:10px;margin-bottom:12px}
    .head h2{color:#1565C0;margin:0}
    .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ddd}
    .bold{font-weight:700}
    .total{font-size:16px;color:#1565C0;font-weight:800}
    .footer{text-align:center;margin-top:16px;color:#888;font-size:11px}
    @media print{button{display:none}}
  </style></head><body>
  <div class="head">
    <h2>🏫 ${school}</h2>
    <div>Fee Receipt</div>
  </div>
  <div class="row"><span>Receipt No</span><span class="bold">${fee.receiptNo||'—'}</span></div>
  <div class="row"><span>Date</span><span>${fee.paymentDate||today()}</span></div>
  <div class="row"><span>Student Name</span><span class="bold">${stu.fullName}</span></div>
  <div class="row"><span>Father Name</span><span>${stu.fatherName||'—'}</span></div>
  <div class="row"><span>Class</span><span>${stu.class||''} ${stu.section||''}</span></div>
  <div class="row"><span>Month</span><span>${fee.monthLabel||fee.month}</span></div>
  <div class="row"><span>Fee Amount</span><span>Rs ${fmt(fee.due)}</span></div>
  ${fee.discount>0?`<div class="row"><span>Discount</span><span>- Rs ${fmt(fee.discount)}</span></div>`:''}
  ${fee.lateFee>0?`<div class="row"><span>Late Fee</span><span>+ Rs ${fmt(fee.lateFee)}</span></div>`:''}
  <div class="row"><span class="total">Amount Paid</span><span class="total">Rs ${fmt(fee.paid)}</span></div>
  <div class="row"><span>Payment Mode</span><span>${fee.paymentMode||'Cash'}</span></div>
  <div class="footer">Thank you · ${school} · ${new Date().toLocaleDateString()}</div>
  <br><button onclick="window.print()">🖨️ Print</button>
  </body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════════
//  ATTENDANCE
// ══════════════════════════════════════════════════════════════════
window.loadAttendance = async () => {
  const cls   = document.getElementById('att-class').value;
  const month = document.getElementById('att-month').value;
  if (!cls || !month) {
    document.getElementById('att-list').innerHTML = emptyState('📅','Select a class and month to mark attendance.');
    return;
  }
  try {
    const snap = await getDocs(query(collection(db,'students'), where('class','==',cls), orderBy('fullName')));
    const students = snap.docs.map(d=>({id:d.id,...d.data()}));

    // Load existing records for this class+month
    const attSnap = await getDocs(query(collection(db,'attendance'), where('class','==',cls), where('month','==',month)));
    attData = {};
    attSnap.docs.forEach(d=>{ const a=d.data(); attData[a.studentId]=a.status; });

    const P = Object.values(attData).filter(v=>v==='P').length;
    const A = Object.values(attData).filter(v=>v==='A').length;
    const L = Object.values(attData).filter(v=>v==='L').length;
    const pct = students.length>0 ? Math.round(P/students.length*100) : 0;

    document.getElementById('att-summary').innerHTML = `
      <div class="att-sum"><div class="val" style="color:#66BB6A">${P}</div><div class="lbl">Present</div></div>
      <div class="att-sum"><div class="val" style="color:var(--red2)">${A}</div><div class="lbl">Absent</div></div>
      <div class="att-sum"><div class="val" style="color:#FFB300">${L}</div><div class="lbl">Leave</div></div>
      <div class="att-sum"><div class="val">${students.length}</div><div class="lbl">Total</div></div>
      <div class="att-sum"><div class="val" style="color:var(--blue3)">${pct}%</div><div class="lbl">Present%</div></div>`;

    document.getElementById('att-list').innerHTML = students.length
      ? students.map(s=>{
          const cur = attData[s.id]||'P';
          return `<div class="att-row">
            <div class="att-name">${s.fullName}<span style="font-size:10px;color:var(--text3);margin-left:6px">${s.studentId||''}</span></div>
            <div class="att-btns">
              ${['P','A','L'].map(v=>`<button class="att-btn ${v}${cur===v?' sel':''}"
                onclick="setAtt('${s.id}','${v}',this)">${v==='P'?'✓ P':v==='A'?'✗ A':'~ L'}</button>`).join('')}
            </div>
          </div>`;
        }).join('')
      : emptyState('📅','No students in this class.');

    const saveBtn = document.getElementById('save-att-btn');
    const role = userProfile?.role||'parent';
    if (role==='admin'||role==='teacher') saveBtn.classList.remove('hidden');
    else saveBtn.classList.add('hidden');
  } catch(e) { toast('Attendance error: '+e.message,'error'); }
};

window.setAtt = (sid, status, btn) => {
  attData[sid] = status;
  btn.closest('.att-row').querySelectorAll('.att-btn').forEach(b=>b.classList.remove('sel'));
  btn.classList.add('sel');
};

window.saveAttendance = async () => {
  const cls   = document.getElementById('att-class').value;
  const month = document.getElementById('att-month').value;
  if (!cls||!month) { toast('Select class and month','error'); return; }
  try {
    const snap = await getDocs(query(collection(db,'students'), where('class','==',cls)));
    await Promise.all(snap.docs.map(d=>{
      const s = d.data();
      const status = attData[d.id]||'P';
      return setDoc(doc(db,'attendance',`${d.id}_${month}`), {
        studentId: d.id, studentName: s.fullName, class: cls,
        month, status, academicYear: schoolConfig.year||'2025-26',
        markedBy: currentUser.uid, updatedAt: serverTimestamp()
      });
    }));
    toast('Attendance saved ✅','success');
    loadAttendance();
  } catch(e) { toast('Save error: '+e.message,'error'); }
};

// Set default month to today
const attMonthEl = document.getElementById('att-month');
if (attMonthEl) attMonthEl.value = new Date().toISOString().slice(0,7);

// ══════════════════════════════════════════════════════════════════
//  EXAMS & MARKS
// ══════════════════════════════════════════════════════════════════
window.loadExams = async () => {
  const cls  = document.getElementById('exam-class').value;
  const term = document.getElementById('exam-term').value;
  try {
    let q = cls
      ? query(collection(db,'exams'), where('class','==',cls), where('term','==',term))
      : query(collection(db,'exams'), where('term','==',term));
    const snap  = await getDocs(q);
    const exams = snap.docs.map(d=>({id:d.id,...d.data()}));

    const el = document.getElementById('exam-list');
    if (!exams.length) { el.innerHTML = emptyState('📝','No marks entered yet.'); return; }

    // Group by student
    const byStudent = {};
    exams.forEach(e=>{
      if (!byStudent[e.studentId]) byStudent[e.studentId]={name:e.studentName,class:e.class,subjects:{}};
      byStudent[e.studentId].subjects[e.subject]=e;
    });

    el.innerHTML = Object.values(byStudent).map(data=>{
      const subs  = Object.entries(data.subjects);
      const total = subs.reduce((s,[,e])=>s+(e.obtained||0),0);
      const maxT  = subs.reduce((s,[,e])=>s+(e.totalMarks||100),0);
      const pct   = maxT>0?Math.round(total/maxT*100):0;
      const grade = gradeLabel(pct);
      const gc    = gradeColor(pct);
      return `<div class="exam-card">
        <div class="exam-header">
          <div>
            <div class="exam-title">${data.name}</div>
            <div class="exam-meta">${data.class} · ${term}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:24px;font-weight:800;${gc}">${grade}</div>
            <div class="exam-meta">${pct}% · ${total}/${maxT}</div>
          </div>
        </div>
        <div class="marks-grid">
          ${subs.map(([sub,e])=>{
            const sp=Math.round((e.obtained||0)/(e.totalMarks||100)*100);
            return `<div class="mark-item">
              <div class="mark-sub">${sub}</div>
              <div class="mark-val" style="${gradeColor(sp)}">${e.obtained||0}/${e.totalMarks||100}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  } catch(e) { toast('Exams error: '+e.message,'error'); }
};

window.openAddExam = () => {
  document.getElementById('em-date').value = today();
  openModal('exam-modal');
};

window.loadStudentsForExam = async () => {
  const cls = document.getElementById('em-class').value;
  if (!cls) return;
  const snap = await getDocs(query(collection(db,'students'), where('class','==',cls), orderBy('fullName')));
  const students = snap.docs.map(d=>({id:d.id,...d.data()}));
  document.getElementById('exam-students-marks').innerHTML =
    `<div class="section-title" style="margin-top:12px">Enter Marks (out of Total)</div>` +
    students.map(s=>`
      <div class="exam-mark-row">
        <label>${s.fullName}</label>
        <input type="number" id="mk-${s.id}" data-sid="${s.id}" data-sname="${esc(s.fullName)}"
          placeholder="0" min="0" max="500" style="width:70px;background:var(--card);border:1px solid var(--border);
          border-radius:8px;padding:6px 8px;color:var(--text);font-family:var(--font);text-align:center;outline:none">
      </div>`).join('');
};

window.saveExamMarks = async () => {
  const cls     = document.getElementById('em-class').value;
  const term    = document.getElementById('em-term').value;
  const subject = document.getElementById('em-subject').value;
  const total   = parseInt(document.getElementById('em-total').value||100);
  const date    = document.getElementById('em-date').value;
  if (!cls||!subject) { toast('Select class and subject','error'); return; }

  const inputs = document.querySelectorAll('#exam-students-marks input[data-sid]');
  if (!inputs.length) { toast('No students loaded','error'); return; }

  try {
    await Promise.all(Array.from(inputs).map(inp=>{
      const sid  = inp.dataset.sid;
      const name = inp.dataset.sname;
      const obt  = parseInt(inp.value||0);
      const pct  = Math.round(obt/total*100);
      const docId = `${sid}_${term}_${subject}`.replace(/[\s\/]+/g,'_');
      return setDoc(doc(db,'exams',docId), {
        studentId: sid, studentName: name, class: cls, term, subject,
        obtained: obt, totalMarks: total, percentage: pct,
        grade: gradeLabel(pct),
        examDate: date, academicYear: schoolConfig.year||'2025-26',
        createdBy: currentUser.uid, updatedAt: serverTimestamp()
      });
    }));
    toast('Marks saved ✅','success');
    closeModal('exam-modal');
    loadExams();
  } catch(e) { toast('Save failed: '+e.message,'error'); }
};

// ══════════════════════════════════════════════════════════════════
//  NOTICES
// ══════════════════════════════════════════════════════════════════
async function loadNotices() {
  try {
    const snap = await getDocs(query(collection(db,'notices'), orderBy('createdAt','desc')));
    const notices = snap.docs.map(d=>({id:d.id,...d.data()}));

    const el = document.getElementById('notice-list');
    if (!notices.length) { el.innerHTML = emptyState('📢','No notices yet. Post the first one.'); return; }

    const role = userProfile?.role||'parent';
    const canDelete = role==='admin'||role==='teacher';
    el.innerHTML = notices.map(n=>`
      <div class="notice-card ${(n.category||'general').toLowerCase()}">
        <div class="notice-top">
          <div class="notice-title">${n.title||'Notice'}</div>
          <span class="notice-cat" style="background:rgba(255,255,255,0.1);border-radius:99px;padding:2px 8px">
            ${n.category||'General'}
          </span>
        </div>
        <div class="notice-body">${n.body||''}</div>
        ${n.videoLink?`<br><a class="notice-video-link" href="${n.videoLink}" target="_blank">▶ Watch Video</a>`:''}
        <div class="notice-footer">
          <span>📅 ${fmtDate(n.createdAt)}</span>
          <span>👥 ${n.audience||'All'}</span>
          <span>🖊 ${n.postedBy||'Admin'}</span>
          ${canDelete?`<button onclick="delNotice('${n.id}')" style="background:none;border:none;color:var(--red2);cursor:pointer;font-size:12px">🗑️</button>`:''}
        </div>
      </div>`).join('');

    // Badge
    const recent = notices.filter(n=>{ const d=n.createdAt?.toDate?.(); return d&&(Date.now()-d.getTime()<48*3600*1000); }).length;
    const badge  = document.getElementById('notif-badge');
    badge.textContent = recent;
    badge.classList.toggle('hidden', recent===0);
  } catch(e) { toast('Notices error','error'); }
}

window.saveNotice = async () => {
  const title = document.getElementById('n-title').value.trim();
  const body  = document.getElementById('n-body').value.trim();
  if (!title||!body) { toast('Title and message required','error'); return; }
  try {
    await addDoc(collection(db,'notices'), {
      title, body,
      category:  document.getElementById('n-cat').value,
      audience:  document.getElementById('n-audience').value,
      videoLink: document.getElementById('n-video').value.trim(),
      postedBy:  currentUser.displayName||'Admin',
      createdAt: serverTimestamp()
    });
    toast('Notice posted ✅','success');
    closeModal('notice-modal');
    document.getElementById('n-title').value='';
    document.getElementById('n-body').value='';
    document.getElementById('n-video').value='';
    loadNotices();
  } catch(e) { toast('Post failed: '+e.message,'error'); }
};

window.delNotice = async id => {
  if (!confirm('Delete notice?')) return;
  await deleteDoc(doc(db,'notices',id));
  toast('Deleted','info');
  loadNotices();
};

// ══════════════════════════════════════════════════════════════════
//  HOMEWORK
// ══════════════════════════════════════════════════════════════════
window.loadHomework = async () => {
  const cls  = document.getElementById('hw-class').value;
  const date = document.getElementById('hw-date').value;
  try {
    let q = cls
      ? query(collection(db,'homework'), where('class','==',cls), orderBy('givenDate','desc'))
      : query(collection(db,'homework'), orderBy('givenDate','desc'), limit(50));
    const snap = await getDocs(q);
    const hw   = snap.docs.map(d=>({id:d.id,...d.data()})).filter(h=>!date||h.givenDate===date);

    const role     = userProfile?.role||'parent';
    const canWrite = role!=='parent';
    const el       = document.getElementById('hw-list');
    if (!hw.length) { el.innerHTML = emptyState('📖','No homework assigned.'); return; }

    el.innerHTML = hw.map(h=>`
      <div class="hw-card">
        <div class="hw-top">
          <span class="hw-subject">${h.subject||''}</span>
          <span class="hw-class">${h.class||''}</span>
        </div>
        <div class="hw-desc">${h.description||''}</div>
        ${h.videoLink?`<a class="notice-video-link" href="${h.videoLink}" target="_blank">▶ Watch Video</a>`:''}
        <div class="hw-due">📅 Given: ${h.givenDate||'—'} &nbsp;·&nbsp; Due: ${h.dueDate||'—'}</div>
        <div style="font-size:11px;color:var(--text3)">🖊 ${h.postedBy||'Teacher'}</div>
        ${canWrite?`<button onclick="delHw('${h.id}')" style="background:none;border:none;color:var(--red2);cursor:pointer;font-size:12px;margin-top:4px">🗑️ Delete</button>`:''}
      </div>`).join('');
  } catch(e) { toast('Homework error','error'); }
};

window.saveHomework = async () => {
  const desc = document.getElementById('hw-desc').value.trim();
  if (!desc) { toast('Description required','error'); return; }
  try {
    await addDoc(collection(db,'homework'), {
      class:       document.getElementById('hw-cls').value,
      subject:     document.getElementById('hw-sub').value,
      givenDate:   document.getElementById('hw-given').value,
      dueDate:     document.getElementById('hw-due-date').value,
      description: desc,
      videoLink:   document.getElementById('hw-video').value.trim(),
      postedBy:    currentUser.displayName||'Teacher',
      academicYear: schoolConfig.year||'2025-26',
      createdAt:   serverTimestamp()
    });
    toast('Homework saved ✅','success');
    closeModal('hw-modal');
    document.getElementById('hw-desc').value='';
    document.getElementById('hw-video').value='';
    loadHomework();
  } catch(e) { toast('Save failed: '+e.message,'error'); }
};

window.delHw = async id => {
  if (!confirm('Delete homework?')) return;
  await deleteDoc(doc(db,'homework',id));
  toast('Deleted','info');
  loadHomework();
};

const hwDateEl = document.getElementById('hw-date');
const hwGivenEl = document.getElementById('hw-given');
if (hwDateEl) hwDateEl.value = today();
if (hwGivenEl) hwGivenEl.value = today();

// ══════════════════════════════════════════════════════════════════
//  TIMETABLE
// ══════════════════════════════════════════════════════════════════
window.loadTimetable = async () => {
  const cls = document.getElementById('tt-class').value;
  const el  = document.getElementById('tt-grid');
  if (!cls) { el.innerHTML = emptyState('🗓️','Select a class to view the timetable.'); return; }
  try {
    const snap    = await getDocs(query(collection(db,'timetable'), where('class','==',cls)));
    const periods = snap.docs.map(d=>({id:d.id,...d.data()}));
    const days    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const role    = userProfile?.role||'parent';
    const canDel  = role==='admin'||role==='teacher';

    el.innerHTML = days.map(day=>{
      const dp = periods.filter(p=>p.day===day).sort((a,b)=>(a.period||0)-(b.period||0));
      return `<div class="tt-day-header">${day}</div>` +
        (dp.length
          ? dp.map(p=>`
            <div class="tt-period">
              <div class="tt-time">${p.startTime||'—'} – ${p.endTime||'—'}</div>
              <div style="flex:1">
                <div class="tt-subject">P${p.period||''} · ${p.subject||''}</div>
                <div class="tt-teacher">${p.teacher||''} ${p.room?'· 🏠 '+p.room:''}</div>
              </div>
              ${canDel?`<button onclick="delPeriod('${p.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px">🗑️</button>`:''}
            </div>`).join('')
          : `<div style="padding:8px 12px;font-size:12px;color:var(--text3)">No periods set</div>`);
    }).join('');
  } catch(e) { toast('Timetable error','error'); }
};

window.saveTimetable = async () => {
  const cls = document.getElementById('tt-cls').value;
  if (!cls) { toast('Select class','error'); return; }
  try {
    await addDoc(collection(db,'timetable'), {
      class:     cls,
      day:       document.getElementById('tt-day').value,
      period:    parseInt(document.getElementById('tt-period').value||1),
      subject:   document.getElementById('tt-sub').value,
      startTime: document.getElementById('tt-start').value,
      endTime:   document.getElementById('tt-end').value,
      teacher:   document.getElementById('tt-teacher').value.trim(),
      room:      document.getElementById('tt-room').value.trim(),
      createdAt: serverTimestamp()
    });
    toast('Period added ✅','success');
    closeModal('tt-modal');
    document.getElementById('tt-class').value = cls;
    loadTimetable();
  } catch(e) { toast('Save failed: '+e.message,'error'); }
};

window.delPeriod = async id => {
  await deleteDoc(doc(db,'timetable',id));
  toast('Deleted','info');
  loadTimetable();
};

// ══════════════════════════════════════════════════════════════════
//  STAFF
// ══════════════════════════════════════════════════════════════════
async function loadStaff() {
  try {
    const snap = await getDocs(query(collection(db,'staff'), orderBy('fullName')));
    allStaff   = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderStaff(allStaff);
  } catch(e) { toast('Staff error','error'); }
}

const DEPT_CLS = { Teaching:'dept-teaching', Management:'dept-management', Admin:'dept-admin', Support:'dept-support' };

function renderStaff(list) {
  const el = document.getElementById('staff-list');
  if (!list.length) { el.innerHTML = emptyState('👨‍🏫','No staff added yet.'); return; }
  el.innerHTML = list.map(s=>`
    <div class="staff-card">
      <div class="s-avatar" style="background:linear-gradient(135deg,var(--teal),var(--blue))">${initial(s.fullName)}</div>
      <div class="s-info">
        <div class="s-name">${s.fullName||'—'}</div>
        <div class="s-meta">${s.employeeId||''} · ${s.designation||''}</div>
        <div class="s-meta">📞 ${s.contact||'—'} · <strong>Rs ${fmt(s.salary||0)}/mo</strong></div>
        <span class="staff-dept ${DEPT_CLS[s.department]||'dept-support'}">${s.department||'—'}</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="s-badge ${(s.status||'Active').toLowerCase()}">${s.status||'Active'}</span>
        <div class="s-actions">
          <button onclick='openEditStaff(${JSON.stringify(s)})'>✏️</button>
          <button onclick="delStaff('${s.id}')">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

window.filterStaff = val => {
  const v = val.toLowerCase();
  renderStaff(allStaff.filter(s=>
    (s.fullName||'').toLowerCase().includes(v)||(s.designation||'').toLowerCase().includes(v)
  ));
};

window.openEditStaff = s => {
  const set = (id,v) => { const e=document.getElementById(id); if(e) e.value=v||''; };
  set('st-id',s.id); set('st-eid',s.employeeId); set('st-name',s.fullName);
  set('st-desig',s.designation); set('st-contact',s.contact);
  set('st-join',s.joinDate); set('st-salary',s.salary||0);
  set('st-cnic',s.cnic); set('st-qual',s.qualification);
  document.getElementById('st-dept').value   = s.department||'Teaching';
  document.getElementById('st-status').value = s.status||'Active';
  document.getElementById('staff-modal-title').textContent = 'Edit Staff';
  openModal('staff-modal');
};

window.saveStaff = async () => {
  const name = document.getElementById('st-name').value.trim();
  if (!name) { toast('Name required','error'); return; }
  const sid  = document.getElementById('st-id').value;
  const data = {
    employeeId:    document.getElementById('st-eid').value.trim(),
    fullName:      name,
    designation:   document.getElementById('st-desig').value.trim(),
    department:    document.getElementById('st-dept').value,
    contact:       document.getElementById('st-contact').value.trim(),
    joinDate:      document.getElementById('st-join').value,
    salary:        parseFloat(document.getElementById('st-salary').value||0),
    cnic:          document.getElementById('st-cnic').value.trim(),
    qualification: document.getElementById('st-qual').value.trim(),
    status:        document.getElementById('st-status').value,
    updatedAt:     serverTimestamp(),
  };
  try {
    if (sid) await setDoc(doc(db,'staff',sid), data, {merge:true});
    else { data.createdAt=serverTimestamp(); await addDoc(collection(db,'staff'),data); }
    toast('Staff saved ✅','success');
    closeModal('staff-modal');
    loadStaff();
  } catch(e) { toast('Save failed: '+e.message,'error'); }
};

window.delStaff = async id => {
  if (!confirm('Delete staff member?')) return;
  await deleteDoc(doc(db,'staff',id));
  toast('Deleted','info');
  loadStaff();
};

// ══════════════════════════════════════════════════════════════════
//  SALARY
// ══════════════════════════════════════════════════════════════════
window.loadSalary = async () => {
  const month = document.getElementById('sal-month').value;
  const year  = document.getElementById('sal-year').value || schoolConfig.year || '2025-26';
  try {
    const [stfSnap, salSnap] = await Promise.all([
      getDocs(query(collection(db,'staff'), where('status','==','Active'))),
      getDocs(query(collection(db,'salary'), where('month','==',month), where('academicYear','==',year)))
    ]);
    const staff  = stfSnap.docs.map(d=>({id:d.id,...d.data()}));
    const slips  = salSnap.docs.map(d=>({id:d.id,...d.data()}));
    const slipMap= {};
    slips.forEach(s=>{ slipMap[s.employeeId]=s; });

    const totalBill = staff.reduce((s,x)=>s+(x.salary||0),0);
    const totalPaid = slips.filter(s=>s.status==='Paid').reduce((s,x)=>s+(x.netSalary||0),0);
    const pending   = staff.length - slips.filter(s=>s.status==='Paid').length;

    document.getElementById('sal-summary').innerHTML = `
      <div class="sal-sum"><div class="val" style="color:var(--blue3)">Rs ${fmt(totalBill)}</div><div class="lbl">Total Bill</div></div>
      <div class="sal-sum"><div class="val" style="color:#66BB6A">Rs ${fmt(totalPaid)}</div><div class="lbl">Paid</div></div>
      <div class="sal-sum"><div class="val" style="color:var(--red2)">Rs ${fmt(Math.max(0,totalBill-totalPaid))}</div><div class="lbl">Remaining</div></div>
      <div class="sal-sum"><div class="val" style="color:#FFB300">${pending}</div><div class="lbl">Pending</div></div>`;

    document.getElementById('salary-list').innerHTML = staff.map(s=>{
      const slip   = slipMap[s.id];
      const net    = (s.salary||0)+(slip?.allowances||0)-(slip?.deductions||0);
      const isPaid = slip?.status==='Paid';
      return `<div class="salary-card">
        <div class="s-avatar" style="background:linear-gradient(135deg,var(--purple),var(--blue))">${initial(s.fullName)}</div>
        <div class="s-info">
          <div class="s-name">${s.fullName}</div>
          <div class="s-meta">${s.designation||''} · ${s.department||''}</div>
          <div class="s-meta">Basic: Rs ${fmt(s.salary||0)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:800;color:${isPaid?'#66BB6A':'#FFB300'}">Rs ${fmt(net)}</div>
          <span class="s-badge ${isPaid?'active':'inactive'}">${isPaid?'Paid':'Pending'}</span>
          <br>
          <button onclick="markPaid('${s.id}','${esc(s.fullName)}',${s.salary||0},'${month}','${year}')"
            style="margin-top:6px;background:${isPaid?'rgba(46,125,50,0.2)':'var(--blue)'};color:${isPaid?'#66BB6A':'#fff'};
            border:none;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:var(--font)">
            ${isPaid?'✓ Paid':'Mark Paid'}
          </button>
        </div>
      </div>`;
    }).join('');
  } catch(e) { toast('Salary error','error'); }
};

window.markPaid = async (empId, empName, basic, month, year) => {
  const slipId = `${empId}_${month}_${year}`.replace(/[\s-]+/g,'_');
  await setDoc(doc(db,'salary',slipId), {
    employeeId: empId, employeeName: empName,
    basicSalary: basic, allowances: 0, deductions: 0, netSalary: basic,
    month, academicYear: year,
    status: 'Paid', paidDate: today(),
    paidBy: currentUser.uid, updatedAt: serverTimestamp()
  });
  toast('Marked as paid ✅','success');
  loadSalary();
};

window.generateSalarySlips = async () => {
  const month = document.getElementById('sal-month').value;
  const year  = document.getElementById('sal-year').value || schoolConfig.year;
  const snap  = await getDocs(query(collection(db,'staff'), where('status','==','Active')));
  const staff = snap.docs.map(d=>({id:d.id,...d.data()}));
  let created = 0;
  for (const s of staff) {
    const slipId = `${s.id}_${month}_${year}`.replace(/[\s-]+/g,'_');
    const ex = await getDoc(doc(db,'salary',slipId));
    if (!ex.exists()) {
      await setDoc(doc(db,'salary',slipId), {
        employeeId: s.id, employeeName: s.fullName,
        basicSalary: s.salary||0, allowances:0, deductions:0,
        netSalary: s.salary||0, month, academicYear: year,
        status:'Pending', createdAt: serverTimestamp()
      });
      created++;
    }
  }
  toast(`${created} new slips generated ✅`,'success');
  loadSalary();
};

// ══════════════════════════════════════════════════════════════════
//  USERS (Role Management)
// ══════════════════════════════════════════════════════════════════
async function loadUsers() {
  try {
    const snap  = await getDocs(collection(db,'users'));
    const users = snap.docs.map(d=>({id:d.id,...d.data()}));
    const el    = document.getElementById('users-list');
    el.innerHTML = users.map(u=>{
      const photo = u.photo||`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name||'U')}&background=1565C0&color=fff`;
      const isMe  = currentUser.uid===u.id;
      return `<div class="user-card">
        <img src="${photo}" alt="" onerror="this.src='https://ui-avatars.com/api/?name=U&background=1565C0&color=fff'">
        <div class="user-info">
          <div class="user-name">${u.name||'—'}</div>
          <div class="user-email">${u.email||'—'}</div>
          ${u.studentId?`<div class="user-email">🎓 Student: ${u.studentId}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="role-badge">${u.role||'parent'}</span>
          ${!isMe?`<button onclick="openUserEdit('${u.id}','${esc(u.name||'')}','${esc(u.email||'')}','${u.role||'parent'}','${u.studentId||''}')"
            style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;
            color:var(--text2);cursor:pointer;font-size:12px">Edit Role</button>`
          :'<span style="font-size:11px;color:var(--text3)">You</span>'}
        </div>
      </div>`;
    }).join('');
  } catch(e) { toast('Users error','error'); }
}

window.openUserEdit = (uid, name, email, role, sid) => {
  document.getElementById('u-uid').value       = uid;
  document.getElementById('u-role').value      = role;
  document.getElementById('u-student-id').value = sid||'';
  document.getElementById('u-info').innerHTML  = `<strong>${name}</strong><br><span style="color:var(--text2)">${email}</span>`;
  openModal('user-modal');
};

window.saveUserRole = async () => {
  const uid  = document.getElementById('u-uid').value;
  const role = document.getElementById('u-role').value;
  const sid  = document.getElementById('u-student-id').value.trim();
  await updateDoc(doc(db,'users',uid), { role, ...(sid?{studentId:sid}:{}) });
  toast('Role updated ✅','success');
  closeModal('user-modal');
  loadUsers();
};

// ══════════════════════════════════════════════════════════════════
//  SETTINGS SAVE
// ══════════════════════════════════════════════════════════════════
window.saveSettings = async () => {
  const cls  = document.getElementById('set-classes').value.split(',').map(s=>s.trim()).filter(Boolean);
  const subs = document.getElementById('set-subjects').value.split(',').map(s=>s.trim()).filter(Boolean);
  const data = {
    name:      document.getElementById('set-school-name').value.trim(),
    principal: document.getElementById('set-principal').value.trim(),
    phone:     document.getElementById('set-phone').value.trim(),
    address:   document.getElementById('set-address').value.trim(),
    year:      document.getElementById('set-year').value,
    classes: cls, subjects: subs,
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db,'schools','config'), data, {merge:true});
  schoolConfig = {...schoolConfig, ...data};
  document.getElementById('sidebar-school-name').textContent = '📚 ' + data.name;
  populateClassSelects();
  populateSubjectSelects();
  toast('Settings saved ✅','success');
};

// ══════════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════════
function fmt(n)        { return Number(n||0).toLocaleString('en-PK'); }
function pad(n)        { return String(n).padStart(2,'0'); }
function today()       { return new Date().toISOString().split('T')[0]; }
function initial(name) { return (name||'?')[0].toUpperCase(); }
function esc(str)      { return (str||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
function emptyState(icon, msg) {
  return `<div class="empty-state"><div class="es-icon">${icon}</div><p>${msg}</p></div>`;
}
function gradeLabel(pct) {
  return pct>=90?'A+':pct>=80?'A':pct>=70?'B':pct>=60?'C':pct>=50?'D':'F';
}
function gradeColor(pct) {
  const c = pct>=70?'#66BB6A':pct>=60?'var(--blue3)':pct>=50?'#FFB300':'var(--red2)';
  return `color:${c}`;
}
function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts?.toDate?.() || (ts?.seconds ? new Date(ts.seconds*1000) : null);
  return d ? d.toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) : '—';
}
