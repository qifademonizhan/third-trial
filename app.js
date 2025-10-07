/************** Firebase 초기화 **************/
/************** Firebase 초기화 **************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection,
  getDocs, onSnapshot, query, orderBy, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ✅ qifa-23727 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCEvE_lccy97Ppjgrv-GumHiNXfUJ3SiZc",
  authDomain: "qifa-23727.firebaseapp.com",
  projectId: "qifa-23727",
  storageBucket: "qifa-23727.firebasestorage.app",
  messagingSenderId: "328358384863",
  appId: "1:328358384863:web:bb6161a816a1ebd022c56a",
  measurementId: "G-25PCKZSEHW"
};

// ✅ Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ✅ 익명 로그인 (Firestore 접근 허용용)
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    await signInAnonymously(auth);
  }
});

// ✅ Firebase 초기화 (기존 코드)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ ↓↓↓ 여기부터 새 코드 붙이기 ↓↓↓

// HTML 요소
const enterBtn = document.getElementById("enterBtn");
const accessCodeEl = document.getElementById("accessCode");
const gateEl = document.getElementById("gate");
const adminEl = document.getElementById("admin");
const playerEl = document.getElementById("player");

// 화면 전환 함수
function show(section) {
  gateEl.classList.add("hidden");
  adminEl.classList.toggle("hidden", section !== "admin");
  playerEl.classList.toggle("hidden", section !== "player");
}

// 관리자 콘솔 불러오기
async function loadAdminConsole() {
  const ref = doc(db, "game", "config");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { currentTurn: 1 });
  }
}

// 플레이어 프로필 불러오기
async function openPlayer(code) {
  const pRef = doc(db, "profiles", code);
  const pSnap = await getDoc(pRef);
  if (!pSnap.exists()) {
    alert("해당 프로필이 없습니다.");
    gateEl.classList.remove("hidden");
    return;
  }
  const p = pSnap.data();
  document.getElementById("pHeader").textContent = `${p.name} (${p.code})`;
  document.getElementById("pStats").innerHTML = `
    <div>경제력 <b>${p.economy}</b></div>
    <div>국고 <b>${p.treasury}</b></div>
    <div>과학력 <b>${p.science}</b></div>
    <div>문화력 <b>${p.culture}</b></div>
    <div>행정력 <b>${p.admin}</b></div>
  `;
  show("player");
}

// 입장 버튼 클릭 처리
enterBtn.onclick = async () => {
  const code = (accessCodeEl.value || "").trim();
  if (!code) return;

  // 1) 관리자 코드 체크
  const aRef = doc(db, "access", "admin");
  const aSnap = await getDoc(aRef);
  const adminCode = aSnap.exists() ? aSnap.data().code : null;

  if (adminCode && code === String(adminCode)) {
    await loadAdminConsole();
    show("admin");
    return;
  }

  // 2) 일반 프로필 접속
  await openPlayer(code);
};

/************** 전역 상태 **************/
let session = null;     // { role: 'admin'|'player', playerCode? }
let currentProfile = null; // 플레이어가 보고있는 프로필 데이터 캐시

/************** DOM **************/
const $ = (sel)=>document.querySelector(sel);
const gateEl = $("#gate");
const adminEl = $("#admin");
const playerEl = $("#player");

$("#enterBtn").onclick = loginWithCode;
$("#btnCreateProfile")?.addEventListener("click", createProfile);
$("#btnNextTurn")?.addEventListener("click", nextTurn);

document.querySelectorAll(".tabs button").forEach(btn=>{
  btn.addEventListener("click", ()=>openTab(btn.dataset.tab));
});

/************** 익명 로그인 **************/
onAuthStateChanged(auth, async (user)=>{
  if (!user) {
    await signInAnonymously(auth);
  }
});

/************** 게이트: 코드 로그인 **************/
async function loginWithCode() {
  const code = $("#accessCode").value.trim();
  if (!code) return;

  // 1) 관리자 세션 시도
  try {
    await setDoc(doc(db, "sessions", auth.currentUser.uid), {
      role: "admin",
      codeSubmitted: code,
      createdAt: serverTimestamp(),
    });
    session = { role: "admin" };
    gateEl.classList.add("hidden");
    adminEl.classList.remove("hidden");
    await loadAdminConsole();
    // codeSubmitted 제거(민감정보)
    await updateDoc(doc(db, "sessions", auth.currentUser.uid), { codeSubmitted: null });
    return;
  } catch (e) { /* 무시하고 플레이어로 시도 */ }

  // 2) 플레이어 세션 시도 (코드 == 프로필ID)
  try {
    await setDoc(doc(db, "sessions", auth.currentUser.uid), {
      role: "player",
      playerCode: code,
      codeSubmitted: code,
      createdAt: serverTimestamp(),
    });
    session = { role: "player", playerCode: code };
    gateEl.classList.add("hidden");
    playerEl.classList.remove("hidden");
    await openPlayer(code);
    await updateDoc(doc(db, "sessions", auth.currentUser.uid), { codeSubmitted: null });
  } catch (e) {
    alert("코드가 올바르지 않거나 해당 프로필이 없습니다.");
  }
}

/************** 관리자 콘솔 **************/
async function ensureGameConfig() {
  const ref = doc(db, "game", "config");
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { currentTurn: 1, lastUpdated: serverTimestamp() });
}
async function loadAdminConsole() {
  await ensureGameConfig();

  // 턴 표시 + 실시간
  const ref = doc(db, "game", "config");
  onSnapshot(ref, (snap)=>{
    const d = snap.data();
    $("#turnLabel").textContent = `턴: ${d?.currentTurn ?? "-"}`;
  });

  // 프로필 목록
  const listEl = $("#profilesList");
  const col = collection(db, "profiles");
  onSnapshot(query(col, orderBy("name")), (qs)=>{
    listEl.innerHTML = "";
    qs.forEach(docu=>{
      const p = docu.data();
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h4>${p.name} (${p.code})</h4>
        <p>경제력 ${p.economy} · 국고 ${p.treasury} · 과학 ${p.science} · 문화 ${p.culture} · 행정 ${p.admin}</p>
        <div class="grid">
          <button data-c="${p.code}" class="btn-edit">수정</button>
          <button data-c="${p.code}" class="btn-open">플레이어 화면</button>
          <button data-c="${p.code}" class="btn-del">삭제</button>
        </div>
      `;
      listEl.appendChild(card);
    });

    // 버튼 바인딩
    listEl.querySelectorAll(".btn-open").forEach(b=>{
      b.onclick = async ()=>{
        playerEl.classList.remove("hidden");
        adminEl.classList.add("hidden");
        session = { role: "admin" }; // 관리자 권한 유지
        await openPlayer(b.dataset.c);
      };
    });
    listEl.querySelectorAll(".btn-edit").forEach(b=>{
      b.onclick = ()=> adminEditProfile(b.dataset.c);
    });
    listEl.querySelectorAll(".btn-del").forEach(b=>{
      b.onclick = ()=> adminDeleteProfile(b.dataset.c);
    });
  });
}
async function nextTurn() {
  const ref = doc(db, "game", "config");
  const snap = await getDoc(ref);
  const turn = (snap.data()?.currentTurn ?? 1) + 1;
  await updateDoc(ref, { currentTurn: turn, lastUpdated: serverTimestamp() });
  alert(`턴이 ${turn}으로 변경되었습니다.`);
}
async function createProfile() {
  const name = $("#newName").value.trim();
  const code = $("#newCode").value.trim();
  if (!name || !code) return alert("국명/코드를 입력하세요.");

  await setDoc(doc(db, "profiles", code), {
    name, code,
    economy: 1000, treasury: 500, science: 100, culture: 100, admin: 0.60,
    isActive: true, divisionCount: 0, // 지역관리용 현재 사단수
    traits: {}, // 국민정신
    createdAt: serverTimestamp()
  });

  // 산업 기본 문서
  await setDoc(doc(db, "profiles", code, "industry", "buildings"), {
    farm: 0, factory: 0, mine: 0, energy: 0
  });

  alert(`${name} 프로필이 생성되었습니다.`);
  $("#newName").value = ""; $("#newCode").value = "";
}
async function adminEditProfile(code) {
  const ref = doc(db, "profiles", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const p = snap.data();
  const economy = Number(prompt("경제력", p.economy));
  const treasury = Number(prompt("국고", p.treasury));
  const science = Number(prompt("과학력", p.science));
  const culture = Number(prompt("문화력", p.culture));
  const admin = Number(prompt("행정력(예: 0.60)", p.admin));
  await updateDoc(ref, { economy, treasury, science, culture, admin });
  alert("수정되었습니다.");
}
async function adminDeleteProfile(code) {
  if (!confirm(`${code} 프로필을 삭제할까요?`)) return;
  await deleteDoc(doc(db, "profiles", code));
  alert("삭제되었습니다.");
}

/************** 플레이어 화면 **************/
async function openPlayer(code) {
  const ref = doc(db, "profiles", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) { alert("프로필이 없습니다."); return; }
  currentProfile = { id: code, ...snap.data() };

  $("#pHeader").textContent = `${currentProfile.name} (${currentProfile.code})`;

  $("#pStats").innerHTML = `
    <div>경제력 <b>${currentProfile.economy}</b></div>
    <div>국고 <b>${currentProfile.treasury}</b></div>
    <div>과학력 <b>${currentProfile.science}</b></div>
    <div>문화력 <b>${currentProfile.culture}</b></div>
    <div>행정력 <b>${currentProfile.admin}</b></div>
  `;

  // 기본 탭
  openTab("region");
}

/************** 탭 열기 **************/
function clearTabs() {
  document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
}
async function openTab(key) {
  clearTabs();
  const el = $(`#tab-${key}`);
  el.classList.remove("hidden");
  if (key === "region") renderRegion();
  if (key === "industry") renderIndustry();
  if (key === "diplomacy") renderDiplomacy();
  if (key === "traits") renderTraits();
  if (key === "army") renderArmy();
}

/************** 4. 지역관리 **************/
async function renderRegion() {
  const code = currentProfile.id;
  const wrap = $("#tab-region");
  const slots = 2 + Math.floor((currentProfile.admin || 0) / 0.06);

  // 지역 목록
  const regionsCol = collection(db, "profiles", code, "regions");
  const regionsSnap = await getDocs(regionsCol);
  const rows = [];
  regionsSnap.forEach(d=>{
    const r = d.data();
    rows.push(`<tr>
      <td>${d.id}</td>
      <td>${r.core ? "보유소" : "-"}</td>
      <td>${r.stable ?? "-"}</td>
      <td>${r.adminLevel ?? "-"}</td>
      <td>${r.assim ?? "-"}</td>
    </tr>`);
  });

  wrap.innerHTML = `
    <h3>행정 슬롯</h3>
    <p>기본 2줄 + (행정력 0.06 당 1줄) → <b>${slots}</b> 줄</p>

    <div class="grid">
      <label>현 사단개수: <input id="divCount" type="number" min="0" value="${currentProfile.divisionCount ?? 0}"></label>
      ${canEdit(code) ? `<button id="btnSaveDiv">저장</button>` : ""}
    </div>

    <h3>지역 정보</h3>
    <table class="table">
      <thead><tr><th>약자</th><th>보유소지역</th><th>안정도</th><th>행정수준</th><th>동화도</th></tr></thead>
      <tbody>${rows.join("") || `<tr><td colspan="5">지역 없음</td></tr>`}</tbody>
    </table>

    ${canEdit(code) ? `
      <div class="grid">
        <input id="rId" placeholder="예: RU, IB, KP" />
        <label>보유소 <input id="rCore" type="checkbox"></label>
        <input id="rStable" placeholder="안정도(0~100)" type="number" />
        <input id="rAdmin" placeholder="행정수준" type="number" />
        <input id="rAssim" placeholder="동화도(0~100)" type="number" />
        <button id="btnAddRegion">지역 추가/수정</button>
      </div>` : ""}
  `;

  if (canEdit(code)) {
    $("#btnSaveDiv").onclick = async ()=>{
      await updateDoc(doc(db, "profiles", code), { divisionCount: Number($("#divCount").value) });
      alert("저장되었습니다.");
    };
    $("#btnAddRegion").onclick = async ()=>{
      const id = $("#rId").value.trim();
      if (!id) return;
      await setDoc(doc(db, "profiles", code, "regions", id), {
        core: $("#rCore").checked,
        stable: Number($("#rStable").value || 0),
        adminLevel: Number($("#rAdmin").value || 0),
        assim: Number($("#rAssim").value || 0),
      }, { merge:true });
      openTab("region");
    };
  }
}

/************** 5. 산업관리 **************/
async function renderIndustry() {
  const code = currentProfile.id;
  const wrap = $("#tab-industry");
  const bRef = doc(db, "profiles", code, "industry", "buildings");
  const bSnap = await getDoc(bRef);
  const b = bSnap.exists() ? bSnap.data() : { farm:0,factory:0,mine:0,energy:0 };

  // 생산라인
  const linesCol = collection(db, "profiles", code, "industry", "lines");
  const linesSnap = await getDocs(linesCol);
  const lineRows = [];
  linesSnap.forEach(d=>{
    const L = d.data();
    lineRows.push(`<tr>
      <td>${d.id}</td><td>${L.hub || "-"}</td><td>${L.factories || 0}</td>
      <td>${L.product || "-"}</td><td>${L.amount || 0}</td><td>${JSON.stringify(L.costs || {})}</td>
    </tr>`);
  });

  // 허브
  const hubsCol = collection(db, "profiles", code, "industry", "hubs");
  const hubsSnap = await getDocs(hubsCol);
  const hubRows = [];
  hubsSnap.forEach(d=>{
    const h = d.data();
    hubRows.push(`<tr>
      <td>${d.id}</td><td>${h.ammo || 0}</td><td>${h.resource || 0}</td><td>${h.food || 0}</td>
      <td>${(h.links||[]).map(l=>`${l.to}(${l.dist})`).join(", ")}</td>
    </tr>`);
  });

  wrap.innerHTML = `
    <h3>건물 개수</h3>
    <table class="table">
      <thead><tr><th>농장</th><th>공장</th><th>철채굴소</th><th>에너지채굴소</th></tr></thead>
      <tbody><tr><td>${b.farm}</td><td>${b.factory}</td><td>${b.mine}</td><td>${b.energy}</td></tr></tbody>
    </table>
    ${canEdit(code) ? `
      <div class="grid">
        <input id="bFarm" type="number" placeholder="농장" value="${b.farm}">
        <input id="bFactory" type="number" placeholder="공장" value="${b.factory}">
        <input id="bMine" type="number" placeholder="철채굴소" value="${b.mine}">
        <input id="bEnergy" type="number" placeholder="에너지채굴소" value="${b.energy}">
        <button id="btnSaveBuildings">저장</button>
      </div>` : ""}

    <h3>생산라인 (생산계획 보고서)</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>공급허브</th><th>할당 공장</th><th>생산품</th><th>수량</th><th>소모자원</th></tr></thead>
      <tbody>${lineRows.join("") || `<tr><td colspan="6">라인 없음</td></tr>`}</tbody>
    </table>
    ${canEdit(code) ? `
      <div class="grid">
        <input id="lineId" placeholder="라인ID" />
        <input id="lineHub" placeholder="공급허브" />
        <input id="lineFactories" type="number" placeholder="공장개수" />
        <input id="lineProduct" placeholder="생산품명" />
        <input id="lineAmount" type="number" placeholder="수량" />
        <input id="lineCosts" placeholder='소모자원(JSON 예: {"철":3,"에너지":2})' />
        <button id="btnAddLine">추가/수정</button>
      </div>` : ""}

    <h3>허브</h3>
    <table class="table">
      <thead><tr><th>허브</th><th>군수품</th><th>자원</th><th>식량</th><th>연결(거리)</th></tr></thead>
      <tbody>${hubRows.join("") || `<tr><td colspan="5">허브 없음</td></tr>`}</tbody>
    </table>
    ${canEdit(code) ? `
      <div class="grid">
        <input id="hubId" placeholder="허브ID" />
        <input id="hubAmmo" type="number" placeholder="군수품" />
        <input id="hubRes" type="number" placeholder="자원" />
        <input id="hubFood" type="number" placeholder="식량" />
        <input id="hubLinks" placeholder='연결(JSON 예: [{"to":"H2","dist":120}] )' />
        <button id="btnAddHub">추가/수정</button>
      </div>` : ""}
  `;

  if (canEdit(code)) {
    $("#btnSaveBuildings").onclick = async ()=>{
      await setDoc(bRef, {
        farm: Number($("#bFarm").value||0),
        factory: Number($("#bFactory").value||0),
        mine: Number($("#bMine").value||0),
        energy: Number($("#bEnergy").value||0),
      }, { merge: true });
      alert("저장되었습니다.");
      openTab("industry");
    };
    $("#btnAddLine").onclick = async ()=>{
      const id = $("#lineId").value.trim(); if (!id) return;
      await setDoc(doc(db,"profiles",code,"industry","lines",id),{
        hub: $("#lineHub").value.trim(),
        factories: Number($("#lineFactories").value||0),
        product: $("#lineProduct").value.trim(),
        amount: Number($("#lineAmount").value||0),
        costs: safeJSON($("#lineCosts").value)
      },{merge:true});
      openTab("industry");
    };
    $("#btnAddHub").onclick = async ()=>{
      const id = $("#hubId").value.trim(); if (!id) return;
      await setDoc(doc(db,"profiles",code,"industry","hubs",id),{
        ammo: Number($("#hubAmmo").value||0),
        resource: Number($("#hubRes").value||0),
        food: Number($("#hubFood").value||0),
        links: Array.isArray(safeJSON($("#hubLinks").value)) ? safeJSON($("#hubLinks").value) : []
      },{merge:true});
      openTab("industry");
    };
  }
}

/************** 6. 대외관리 **************/
async function renderDiplomacy() {
  const code = currentProfile.id;
  const wrap = $("#tab-diplomacy");

  // 교류국 명단(관리자가 수동 관리)
  const contactsCol = collection(db, "profiles", code, "diplomacy", "contacts");
  const cSnap = await getDocs(contactsCol);
  const contacts = [];
  cSnap.forEach(d=>contacts.push(d.id));
  const contactList = contacts.map(c=>`<li>${c}</li>`).join("");

  // 받은 제안(inbox)
  const inboxCol = collection(db, "profiles", code, "diplomacy", "inbox");
  const inboxSnap = await getDocs(inboxCol);
  const inboxRows = [];
  inboxSnap.forEach(d=>{
    const m = d.data();
    inboxRows.push(`<tr>
      <td>${d.id}</td><td>${m.from}</td><td>${m.type}</td><td>${m.message||""}</td><td>${m.status||"pending"}</td>
      <td>${canEdit(code) ? `<button data-id="${d.id}" class="btn-acc">수락</button> <button data-id="${d.id}" class="btn-rej">거부</button>` : ""}</td>
    </tr>`);
  });

  // 보낸 제안(outbox)
  const outboxCol = collection(db, "profiles", code, "diplomacy", "outbox");
  const outboxSnap = await getDocs(outboxCol);
  const outRows = [];
  outboxSnap.forEach(d=>{
    const m = d.data();
    outRows.push(`<tr><td>${d.id}</td><td>${m.to}</td><td>${m.type}</td><td>${m.message||""}</td><td>${m.status||"pending"}</td></tr>`);
  });

  wrap.innerHTML = `
    <h3>교류국가 명단</h3>
    <ul>${contactList || "<li>없음(관리자 수동추가)</li>"}</ul>

    <h3>제안 보내기</h3>
    <div class="grid">
      <input id="dipTo" placeholder="대상국 코드(예: RU)" />
      <input id="dipType" placeholder="외교행동(예: 무역제안)" />
      <input id="dipMsg" placeholder="메시지" />
      ${canEdit(code) ? `<button id="btnPropose">보내기</button>` : ""}
    </div>

    <h3>받은 제안(수락창)</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>상대</th><th>유형</th><th>내용</th><th>상태</th><th>조치</th></tr></thead>
      <tbody>${inboxRows.join("") || `<tr><td colspan="6">없음</td></tr>`}</tbody>
    </table>

    <h3>보낸 제안(기록)</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>대상</th><th>유형</th><th>내용</th><th>상태</th></tr></thead>
      <tbody>${outRows.join("") || `<tr><td colspan="5">없음</td></tr>`}</tbody>
    </table>
  `;

  if (canEdit(code)) {
    $("#btnPropose").onclick = async ()=>{
      const to = $("#dipTo").value.trim();
      if (!to) return;
      const msg = {
        from: code, to,
        type: $("#dipType").value.trim(),
        message: $("#dipMsg").value.trim(),
        status: "pending", createdAt: serverTimestamp()
      };
      // 내 outbox에 기록
      const outRef = await addDoc(collection(db, "profiles", code, "diplomacy", "outbox"), msg);
      // 상대 inbox에 전달
      await setDoc(doc(db, "profiles", to, "diplomacy", "inbox", outRef.id), msg);
      alert("보냈습니다.");
      openTab("diplomacy");
    };

    wrap.querySelectorAll(".btn-acc").forEach(btn=>{
      btn.onclick = ()=> respondInbox(btn.dataset.id, "accepted");
    });
    wrap.querySelectorAll(".btn-rej").forEach(btn=>{
      btn.onclick = ()=> respondInbox(btn.dataset.id, "rejected");
    });
  }

  async function respondInbox(id, status) {
    const inboxRef = doc(db, "profiles", code, "diplomacy", "inbox", id);
    const snap = await getDoc(inboxRef);
    if (!snap.exists()) return;
    const m = snap.data();
    await updateDoc(inboxRef, { status });
    // 상대 outbox 동기화
    const outRef = doc(db, "profiles", m.from, "diplomacy", "outbox", id);
    if ((await getDoc(outRef)).exists()) await updateDoc(outRef, { status });
    alert(`처리됨: ${status}`);
    openTab("diplomacy");
  }
}

/************** 7. 국가특성(국민정신) **************/
async function renderTraits() {
  const code = currentProfile.id;
  const wrap = $("#tab-traits");
  // traits는 profiles/{code} 문서의 map 필드
  const ref = doc(db, "profiles", code);
  const snap = await getDoc(ref);
  const traits = snap.data()?.traits || {};
  const rows = Object.keys(traits).map(k=>{
    const t = traits[k];
    return `<tr><td>${k}</td><td>${t.name||"-"}</td><td>${t.desc||"-"}</td><td>${JSON.stringify(t.mod||{})}</td></tr>`;
  });

  wrap.innerHTML = `
    <h3>국민정신</h3>
    <table class="table">
      <thead><tr><th>키</th><th>이름</th><th>설명</th><th>변동치</th></tr></thead>
      <tbody>${rows.join("") || `<tr><td colspan="4">없음</td></tr>`}</tbody>
    </table>

    ${canEdit(code) ? `
      <div class="grid">
        <input id="trKey" placeholder="키(예: marine_empire)" />
        <input id="trName" placeholder="이름(예: 해양제국)" />
        <input id="trDesc" placeholder="설명" />
        <input id="trMod" placeholder='변동치 JSON(예: {"ship_cost":-0.1})' />
        <button id="btnAddTrait">추가/수정</button>
      </div>` : ""}
  `;

  if (canEdit(code)) {
    $("#btnAddTrait").onclick = async ()=>{
      const k = $("#trKey").value.trim(); if (!k) return;
      const mod = safeJSON($("#trMod").value) || {};
      const newTraits = { ...traits, [k]: { name: $("#trName").value.trim(), desc: $("#trDesc").value.trim(), mod } };
      await updateDoc(ref, { traits: newTraits });
      openTab("traits");
    };
  }
}

/************** 8. 군대 **************/
async function renderArmy() {
  const code = currentProfile.id;
  const wrap = $("#tab-army");

  // 보급(식량) 소비
  const pRef = doc(db, "profiles", code);
  const pSnap = await getDoc(pRef);
  const supply = pSnap.data()?.supplyConsumption || 0;

  // 편제(최대 5)
  const tempCol = collection(db, "profiles", code, "army", "templates");
  const tSnap = await getDocs(tempCol);
  const rows = [];
  tSnap.forEach(d=>{
    const t = d.data();
    rows.push(`<tr>
      <td>${d.id}</td><td>${t.name||"-"}</td>
      <td>${t.atkInf||0}</td><td>${t.atkVeh||0}</td><td>${t.def||0}</td><td>${t.size||0}</td>
    </tr>`);
  });

  wrap.innerHTML = `
    <h3>보급(식량) 소비</h3>
    <div class="grid">
      <input id="armySupply" type="number" value="${supply}" />
      ${canEdit(code) ? `<button id="btnSaveSupply">저장</button>` : ""}
    </div>

    <h3>편제(최대 5종)</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>이름</th><th>대인공격</th><th>대물공격</th><th>방어</th><th>규모</th></tr></thead>
      <tbody>${rows.join("") || `<tr><td colspan="6">없음</td></tr>`}</tbody>
    </table>

    ${canEdit(code) ? `
      <div class="grid">
        <input id="tempId" placeholder="편제ID(1~5 권장)" />
        <input id="tempName" placeholder="이름" />
        <input id="tempInf" type="number" placeholder="대인공격" />
        <input id="tempVeh" type="number" placeholder="대물공격" />
        <input id="tempDef" type="number" placeholder="방어" />
        <input id="tempSize" type="number" placeholder="규모" />
        <button id="btnSaveTemplate">추가/수정</button>
      </div>` : ""}
  `;

  if (canEdit(code)) {
    $("#btnSaveSupply").onclick = async ()=>{
      await updateDoc(pRef, { supplyConsumption: Number($("#armySupply").value||0) });
      alert("저장되었습니다.");
    };
    $("#btnSaveTemplate").onclick = async ()=>{
      const id = $("#tempId").value.trim(); if (!id) return;
      await setDoc(doc(db, "profiles", code, "army", "templates", id), {
        name: $("#tempName").value.trim(),
        atkInf: Number($("#tempInf").value||0),
        atkVeh: Number($("#tempVeh").value||0),
        def: Number($("#tempDef").value||0),
        size: Number($("#tempSize").value||0),
      }, { merge:true });
      openTab("army");
    };
  }
}

/************** 유틸 **************/
function canEdit(code) {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (session.role === "player" && session.playerCode === code) return true;
  return false;
}
function safeJSON(s) {
  try { return s ? JSON.parse(s) : null; } catch { return null; }
}
