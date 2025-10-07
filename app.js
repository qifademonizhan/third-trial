alert("app.js 시작");
/******************************
 * Firebase & Firestore 초기화
 ******************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, getDocs, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

/* ← 여기에 본인 프로젝트 구성값 넣으세요 (아래 예시는 qifa-23727) */
const firebaseConfig = {
  apiKey: "AIzaSyCEvE_lccy97Ppjgrv-GumHiNXfUJ3SiZc",
  authDomain: "qifa-23727.firebaseapp.com",
  projectId: "qifa-23727",
  storageBucket: "qifa-23727.firebasestorage.app",
  messagingSenderId: "328358384863",
  appId: "1:328358384863:web:bb6161a816a1ebd022c56a",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

/******************************
 * 전역 상태 & DOM
 ******************************/
let SESSION = { role: null, playerCode: null };
const $ = (s)=>document.querySelector(s);

const gateEl   = $("#gate");
const adminEl  = $("#admin");
const playerEl = $("#player");
const accessInput = $("#accessCode");
const enterBtn = $("#enterBtn");

/******************************
 * 도우미
 ******************************/
function show(section){
  gateEl.classList.add("hidden");
  adminEl.classList.toggle("hidden", section!=="admin");
  playerEl.classList.toggle("hidden", section!=="player");
}
function canEditProfile(code){
  return SESSION.role==="admin" || (SESSION.role==="player" && SESSION.playerCode===code);
}
function openTab(key){
  document.querySelectorAll(".tab").forEach(t=>t.classList.add("hidden"));
  $(`#tab-${key}`).classList.remove("hidden");
  if (key==="region") renderRegion();
  if (key==="industry") renderIndustry();
  if (key==="diplomacy") renderDiplomacy();
  if (key==="traits") renderTraits();
  if (key==="army") renderArmy();
}

/******************************
 * 인증 준비
 ******************************/
onAuthStateChanged(auth, async (user)=>{
  if (!user) await signInAnonymously(auth);
});

/******************************
 * 1. 게이트(로그인)
 ******************************/
window.onload = () => {
  document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>openTab(b.dataset.tab));
  $("#btnNextTurn")?.addEventListener("click", nextTurn);
  $("#btnCreateProfile")?.addEventListener("click", createProfile);

  // ===== 공용: 관리자 코드 캐시 =====
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
// 위 import는 파일 상단에 이미 있다면 중복 추가하지 마세요.

let ADMIN_CODE_CACHE = null;
async function getAdminCode(db) {
  if (ADMIN_CODE_CACHE) return ADMIN_CODE_CACHE;
  const s = await getDoc(doc(db, "access", "admin"));
  ADMIN_CODE_CACHE = s.exists() ? String(s.data().code ?? "") : null;
  return ADMIN_CODE_CACHE;
}

// ===== 게이트 초기화: DOM 준비되면 요소 연결 + 보조 바인딩 =====
function initGate(db) {
  const enterBtn    = document.getElementById("enterBtn");
  const accessInput = document.getElementById("accessCode");
  const gateEl   = document.getElementById("gate");
  const adminEl  = document.getElementById("admin");
  const playerEl = document.getElementById("player");

  if (!enterBtn || !accessInput) {
    alert("❌ 로그인 UI를 찾지 못했습니다 (id 확인 필요)");
    return;
  }

  function show(section){
    gateEl.classList.add("hidden");
    adminEl.classList.toggle("hidden", section!=="admin");
    playerEl.classList.toggle("hidden", section!=="player");
  }

  async function loadAdminConsole() {
    const ref = doc(db, "game", "config");
    const s = await getDoc(ref);
    if (!s.exists()) await setDoc(ref, { currentTurn: 1, lastUpdated: serverTimestamp() });
    show("admin");
  }

  async function openPlayer(code) {
    const pRef = doc(db, "profiles", code);
    const pSnap = await getDoc(pRef);
    if (!pSnap.exists()) { alert("해당 프로필이 없습니다."); gateEl.classList.remove("hidden"); return; }
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

  // ✅ 전역(윈도우)에 노출: HTML에서 직접 호출
  window._onEnter = async () => {
    const input = (accessInput.value || "").trim();
    if (!input) { alert("코드를 입력하세요."); return; }

    try {
      const adminCode = await getAdminCode(db);
      if (adminCode && input === adminCode) {
        await loadAdminConsole();
        return;
      }
      await openPlayer(input);
    } catch (e) {
      alert("오류: " + (e?.message || e));
    }
  };

  // 보조 바인딩 (엔터키 지원)
  accessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") window._onEnter();
  });
}

// DOM 준비되면 반드시 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initGate(db));
} else {
  initGate(db);
}

    // 관리자 코드 확인
    const aSnap = await getDoc(doc(db,"access","admin"));
    const adminCode = aSnap.exists()? String(aSnap.data().code||"") : null;
    if (adminCode && code===adminCode){
      // 세션 문서(규칙용)
      await setDoc(doc(db,"sessions",auth.currentUser.uid),{
        role:"admin", codeSubmitted: code, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db,"sessions",auth.currentUser.uid),{codeSubmitted:null});
      SESSION = { role:"admin" };
      await loadAdminConsole();
      show("admin");
      return;
    }

    // 플레이어 세션 생성 (코드 == 프로필 문서ID)
    const pSnap = await getDoc(doc(db,"profiles",code));
    if (!pSnap.exists()){
      alert("해당 프로필이 없습니다.");
      return;
    }
    await setDoc(doc(db,"sessions",auth.currentUser.uid),{
      role:"player", playerCode: code, codeSubmitted: code, createdAt: serverTimestamp()
    });
    await updateDoc(doc(db,"sessions",auth.currentUser.uid),{codeSubmitted:null});
    SESSION = { role:"player", playerCode: code };
    await openPlayer(code);
  };
};

/******************************
 * 2. 관리자 콘솔
 ******************************/
async function ensureGameConfig(){
  const ref = doc(db,"game","config");
  const s = await getDoc(ref);
  if (!s.exists()) await setDoc(ref,{ currentTurn:1, lastUpdated: serverTimestamp() });
}
async function loadAdminConsole(){
  await ensureGameConfig();

  // 턴 실시간 표시
  onSnapshot(doc(db,"game","config"),(snap)=>{
    $("#turnLabel").textContent = `턴: ${snap.data()?.currentTurn ?? "-"}`;
  });

  // 프로필 목록 그리기 + 버튼
  const listEl = $("#profilesList");
  onSnapshot(query(collection(db,"profiles"), orderBy("name")), (qs)=>{
    listEl.innerHTML = "";
    qs.forEach(d=>{
      const p=d.data();
      const card=document.createElement("div");
      card.className="card";
      card.innerHTML = `
        <h4>${p.name} (${p.code})</h4>
        <p>경제 ${p.economy} · 국고 ${p.treasury} · 과학 ${p.science} · 문화 ${p.culture} · 행정 ${p.admin}</p>
        <div class="grid">
          <button class="open" data-c="${p.code}">플레이어 화면</button>
          <button class="edit" data-c="${p.code}">수정</button>
          <button class="del"  data-c="${p.code}">삭제</button>
        </div>
      `;
      listEl.appendChild(card);
    });

    listEl.querySelectorAll(".open").forEach(b=>b.onclick=()=>openPlayer(b.dataset.c));
    listEl.querySelectorAll(".edit").forEach(b=>b.onclick=()=>adminEdit(b.dataset.c));
    listEl.querySelectorAll(".del").forEach(b=>b.onclick=()=>adminDelete(b.dataset.c));
  });
}

async function nextTurn(){
  const ref = doc(db,"game","config");
  const s = await getDoc(ref);
  await updateDoc(ref,{ currentTurn:(s.data()?.currentTurn||1)+1, lastUpdated: serverTimestamp() });
}
async function createProfile(){
  const name = ($("#newName").value||"").trim();
  const code = ($("#newCode").value||"").trim();
  if (!name || !code) return alert("국명/코드 입력");
  await setDoc(doc(db,"profiles",code),{
    name, code, economy:1000, treasury:500, science:100, culture:100, admin:0.60,
    divisionCount:0, traits:{}, createdAt: serverTimestamp()
  });
  await setDoc(doc(db,"profiles",code,"industry","buildings"),{ farm:0,factory:0,mine:0,energy:0 });
  $("#newName").value=""; $("#newCode").value="";
}
async function adminEdit(code){
  const ref=doc(db,"profiles",code); const s=await getDoc(ref); if(!s.exists())return;
  const p=s.data();
  const economy  = Number(prompt("경제력", p.economy));
  const treasury = Number(prompt("국고",   p.treasury));
  const science  = Number(prompt("과학력", p.science));
  const culture  = Number(prompt("문화력", p.culture));
  const admin    = Number(prompt("행정력(예:0.60)", p.admin));
  await updateDoc(ref,{economy,treasury,science,culture,admin});
}
async function adminDelete(code){
  if(!confirm(`${code} 삭제?`)) return;
  await deleteDoc(doc(db,"profiles",code));
}

/******************************
 * 3. 플레이어 화면 (기본)
 ******************************/
let CURRENT = { id:null, data:null };
async function openPlayer(code){
  const ref=doc(db,"profiles",code); const s=await getDoc(ref);
  if(!s.exists()){ alert("프로필 없음"); return;}
  CURRENT = { id: code, data: s.data() };

  $("#pHeader").textContent = `${CURRENT.data.name} (${CURRENT.data.code})`;
  $("#pStats").innerHTML = `
    <div>경제력 <b>${CURRENT.data.economy}</b></div>
    <div>국고 <b>${CURRENT.data.treasury}</b></div>
    <div>과학력 <b>${CURRENT.data.science}</b></div>
    <div>문화력 <b>${CURRENT.data.culture}</b></div>
    <div>행정력 <b>${CURRENT.data.admin}</b></div>
  `;
  show("player");
  openTab("region");
}

/******************************
 * 4. 지역관리
 ******************************/
async function renderRegion(){
  const code=CURRENT.id; const wrap=$("#tab-region");
  const slots = 2 + Math.floor((CURRENT.data.admin||0)/0.06);

  // 지역 목록
  const rSnap = await getDocs(collection(db,"profiles",code,"regions"));
  const rows=[]; rSnap.forEach(d=>{
    const r=d.data();
    rows.push(`<tr>
      <td>${d.id}</td><td>${r.core?"보유소":"-"}</td>
      <td>${r.stable ?? "-"}</td><td>${r.adminLevel ?? "-"}</td><td>${r.assim ?? "-"}</td>
    </tr>`);
  });

  wrap.innerHTML = `
    <h3>행정 슬롯</h3>
    <p>기본 2줄 + (행정력 0.06당 1줄) → <b>${slots}</b> 줄</p>

    <div class="grid">
      <label>현 사단개수: <input id="divCount" type="number" min="0" value="${CURRENT.data.divisionCount||0}"></label>
      ${canEditProfile(code)? `<button id="saveDiv">저장</button>`:""}
    </div>

    <h3>지역 정보</h3>
    <table class="table">
      <thead><tr><th>약자</th><th>보유소지역</th><th>안정도</th><th>행정수준</th><th>동화도</th></tr></thead>
      <tbody>${rows.join("")||`<tr><td colspan="5">지역 없음</td></tr>`}</tbody>
    </table>

    ${canEditProfile(code)? `
    <div class="grid">
      <input id="rId" placeholder="RU/IB/KP 등 약자" />
      <label>보유소 <input id="rCore" type="checkbox"></label>
      <input id="rStable" type="number" placeholder="안정도" />
      <input id="rAdmin"  type="number" placeholder="행정수준" />
      <input id="rAssim"  type="number" placeholder="동화도" />
      <button id="addRegion">추가/수정</button>
    </div>`:""}
  `;

  if (canEditProfile(code)){
    $("#saveDiv").onclick = async ()=>{
      await updateDoc(doc(db,"profiles",code),{ divisionCount:Number($("#divCount").value||0) });
      CURRENT.data.divisionCount = Number($("#divCount").value||0);
      alert("저장");
    };
    $("#addRegion").onclick = async ()=>{
      const id=($("#rId").value||"").trim(); if(!id) return;
      await setDoc(doc(db,"profiles",code,"regions",id),{
        core: $("#rCore").checked,
        stable: Number($("#rStable").value||0),
        adminLevel: Number($("#rAdmin").value||0),
        assim: Number($("#rAssim").value||0)
      },{merge:true});
      renderRegion();
    };
  }
}

/******************************
 * 5. 산업관리
 ******************************/
async function renderIndustry(){
  const code=CURRENT.id; const w=$("#tab-industry");

  // 건물
  const bRef=doc(db,"profiles",code,"industry","buildings");
  const bSnap=await getDoc(bRef);
  const b=bSnap.exists()? bSnap.data() : {farm:0,factory:0,mine:0,energy:0};

  // 생산라인
  const linesSnap=await getDocs(collection(db,"profiles",code,"industry","lines"));
  const lineRows=[];
  linesSnap.forEach(d=>{
    const L=d.data();
    lineRows.push(`<tr>
      <td>${d.id}</td><td>${L.hub||"-"}</td><td>${L.factories||0}</td>
      <td>${L.product||"-"}</td><td>${L.amount||0}</td><td>${JSON.stringify(L.costs||{})}</td>
    </tr>`);
  });

  // 허브
  const hubsSnap=await getDocs(collection(db,"profiles",code,"industry","hubs"));
  const hubRows=[];
  hubsSnap.forEach(d=>{
    const h=d.data();
    hubRows.push(`<tr>
      <td>${d.id}</td><td>${h.ammo||0}</td><td>${h.resource||0}</td><td>${h.food||0}</td>
      <td>${(h.links||[]).map(l=>`${l.to}(${l.dist})`).join(", ")}</td>
    </tr>`);
  });

  w.innerHTML=`
    <h3>건물 개수</h3>
    <table class="table">
      <thead><tr><th>농장</th><th>공장</th><th>철채굴소</th><th>에너지채굴소</th></tr></thead>
      <tbody><tr><td>${b.farm}</td><td>${b.factory}</td><td>${b.mine}</td><td>${b.energy}</td></tr></tbody>
    </table>
    ${canEditProfile(code)? `
    <div class="grid">
      <input id="bFarm" type="number" value="${b.farm}" placeholder="농장">
      <input id="bFactory" type="number" value="${b.factory}" placeholder="공장">
      <input id="bMine" type="number" value="${b.mine}" placeholder="철채굴소">
      <input id="bEnergy" type="number" value="${b.energy}" placeholder="에너지채굴소">
      <button id="saveBuildings">저장</button>
    </div>`:""}

    <h3>생산라인(생산계획 보고서)</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>공급허브</th><th>할당 공장</th><th>생산품</th><th>수량</th><th>소모자원</th></tr></thead>
      <tbody>${lineRows.join("")||`<tr><td colspan="6">라인 없음</td></tr>`}</tbody>
    </table>
    ${canEditProfile(code)? `
    <div class="grid">
      <input id="lId" placeholder="라인ID">
      <input id="lHub" placeholder="공급허브">
      <input id="lFac" type="number" placeholder="공장개수">
      <input id="lProd" placeholder="생산품">
      <input id="lAmt" type="number" placeholder="수량">
      <input id="lCost" placeholder='소모자원 JSON 예: {"철":3,"에너지":2}'>
      <button id="addLine">추가/수정</button>
    </div>`:""}

    <h3>허브</h3>
    <table class="table">
      <thead><tr><th>허브</th><th>군수품</th><th>자원</th><th>식량</th><th>연결(거리)</th></tr></thead>
      <tbody>${hubRows.join("")||`<tr><td colspan="5">허브 없음</td></tr>`}</tbody>
    </table>
    ${canEditProfile(code)? `
    <div class="grid">
      <input id="hId" placeholder="허브ID">
      <input id="hAmmo" type="number" placeholder="군수품">
      <input id="hRes" type="number" placeholder="자원">
      <input id="hFood" type="number" placeholder="식량">
      <input id="hLinks" placeholder='연결 JSON 예: [{"to":"H2","dist":120}]'>
      <button id="addHub">추가/수정</button>
    </div>`:""}
  `;

  if (canEditProfile(code)){
    $("#saveBuildings").onclick=async ()=>{
      await setDoc(bRef,{
        farm:Number($("#bFarm").value||0),
        factory:Number($("#bFactory").value||0),
        mine:Number($("#bMine").value||0),
        energy:Number($("#bEnergy").value||0),
      },{merge:true});
      alert("저장"); renderIndustry();
    };
    $("#addLine").onclick=async ()=>{
      const id=($("#lId").value||"").trim(); if(!id) return;
      let costs={}; try{ costs=JSON.parse($("#lCost").value||"{}"); }catch{}
      await setDoc(doc(db,"profiles",code,"industry","lines",id),{
        hub:$("#lHub").value.trim(), factories:Number($("#lFac").value||0),
        product:$("#lProd").value.trim(), amount:Number($("#lAmt").value||0),
        costs
      },{merge:true});
      renderIndustry();
    };
    $("#addHub").onclick=async ()=>{
      const id=($("#hId").value||"").trim(); if(!id) return;
      let links=[]; try{ const v=$("#hLinks").value||"[]"; links=JSON.parse(v); }catch{}
      await setDoc(doc(db,"profiles",code,"industry","hubs",id),{
        ammo:Number($("#hAmmo").value||0),
        resource:Number($("#hRes").value||0),
        food:Number($("#hFood").value||0),
        links
      },{merge:true});
      renderIndustry();
    };
  }
}

/******************************
 * 6. 대외관리
 ******************************/
async function renderDiplomacy(){
  const code=CURRENT.id; const w=$("#tab-diplomacy");

  // 교류국 명단
  const cSnap=await getDocs(collection(db,"profiles",code,"diplomacy","contacts"));
  const contacts=[]; cSnap.forEach(d=>contacts.push(d.id));

  // 받은 제안
  const inboxSnap=await getDocs(collection(db,"profiles",code,"diplomacy","inbox"));
  const inRows=[]; inboxSnap.forEach(d=>{
    const m=d.data();
    inRows.push(`<tr><td>${d.id}</td><td>${m.from}</td><td>${m.type}</td><td>${m.message||""}</td><td>${m.status||"pending"}</td>
      <td>${canEditProfile(code)? `<button class="acc" data-id="${d.id}">수락</button> <button class="rej" data-id="${d.id}">거부</button>`:""}</td></tr>`);
  });

  // 보낸 제안
  const outSnap=await getDocs(collection(db,"profiles",code,"diplomacy","outbox"));
  const outRows=[]; outSnap.forEach(d=>{
    const m=d.data();
    outRows.push(`<tr><td>${d.id}</td><td>${m.to}</td><td>${m.type}</td><td>${m.message||""}</td><td>${m.status||"pending"}</td></tr>`);
  });

  w.innerHTML=`
    <h3>교류국가 명단</h3>
    <ul>${contacts.map(c=>`<li>${c}</li>`).join("") || "<li>없음</li>"}</ul>

    <h3>제안 보내기</h3>
    <div class="grid">
      <input id="dipTo" placeholder="대상국 코드" />
      <input id="dipType" placeholder="외교행동" />
      <input id="dipMsg" placeholder="메시지" />
      ${canEditProfile(code)? `<button id="proposeBtn">보내기</button>`:""}
    </div>

    <h3>받은 제안(수락창)</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>상대</th><th>유형</th><th>내용</th><th>상태</th><th>조치</th></tr></thead>
      <tbody>${inRows.join("") || `<tr><td colspan="6">없음</td></tr>`}</tbody>
    </table>

    <h3>보낸 제안</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>대상</th><th>유형</th><th>내용</th><th>상태</th></tr></thead>
      <tbody>${outRows.join("") || `<tr><td colspan="5">없음</td></tr>`}</tbody>
    </table>
  `;

  if (canEditProfile(code)){
    $("#proposeBtn").onclick=async ()=>{
      const to=$("#dipTo").value.trim(); if(!to) return;
      const msg={
        from:code, to, type:$("#dipType").value.trim(), message:$("#dipMsg").value.trim(),
        status:"pending", createdAt: serverTimestamp()
      };
      const outRef = await addDoc(collection(db,"profiles",code,"diplomacy","outbox"), msg);
      await setDoc(doc(db,"profiles",to,"diplomacy","inbox",outRef.id), msg);
      alert("보냄"); renderDiplomacy();
    };
    w.querySelectorAll(".acc").forEach(b=>b.onclick=()=>respond(b.dataset.id,"accepted"));
    w.querySelectorAll(".rej").forEach(b=>b.onclick=()=>respond(b.dataset.id,"rejected"));
  }

  async function respond(id,status){
    const inRef=doc(db,"profiles",code,"diplomacy","inbox",id);
    const snap=await getDoc(inRef); if(!snap.exists()) return;
    const m=snap.data();
    await updateDoc(inRef,{status});
    const outRef=doc(db,"profiles",m.from,"diplomacy","outbox",id);
    if ((await getDoc(outRef)).exists()) await updateDoc(outRef,{status});
    renderDiplomacy();
  }
}

/******************************
 * 7. 국가특성(국민정신)
 ******************************/
async function renderTraits(){
  const code=CURRENT.id; const w=$("#tab-traits");
  const pSnap=await getDoc(doc(db,"profiles",code));
  const traits=pSnap.data()?.traits||{};
  const rows=Object.keys(traits).map(k=>{
    const t=traits[k]; return `<tr><td>${k}</td><td>${t.name||"-"}</td><td>${t.desc||"-"}</td><td>${JSON.stringify(t.mod||{})}</td></tr>`;
  });
  w.innerHTML=`
    <h3>국민정신</h3>
    <table class="table">
      <thead><tr><th>키</th><th>이름</th><th>설명</th><th>변동치</th></tr></thead>
      <tbody>${rows.join("") || `<tr><td colspan="4">없음</td></tr>`}</tbody>
    </table>
    ${canEditProfile(code)? `
    <div class="grid">
      <input id="trKey"  placeholder="키(예: marine_empire)">
      <input id="trName" placeholder="이름(예: 해양제국)">
      <input id="trDesc" placeholder="설명">
      <input id="trMod"  placeholder='변동치 JSON 예: {"ship_cost":-0.1}'>
      <button id="addTrait">추가/수정</button>
    </div>`:""}
  `;
  if (canEditProfile(code)){
    $("#addTrait").onclick=async ()=>{
      const k=($("#trKey").value||"").trim(); if(!k) return;
      let mod={}; try{ mod=JSON.parse($("#trMod").value||"{}"); }catch{}
      const t={ name:$("#trName").value.trim(), desc:$("#trDesc").value.trim(), mod };
      await updateDoc(doc(db,"profiles",code),{ traits: { ...(traits||{}), [k]:t } });
      renderTraits();
    };
  }
}

/******************************
 * 8. 군대
 ******************************/
async function renderArmy(){
  const code=CURRENT.id; const w=$("#tab-army");
  const pRef=doc(db,"profiles",code); const pSnap=await getDoc(pRef);
  const supply=pSnap.data()?.supplyConsumption||0;

  const tSnap=await getDocs(collection(db,"profiles",code,"army","templates"));
  const rows=[]; tSnap.forEach(d=>{
    const t=d.data();
    rows.push(`<tr><td>${d.id}</td><td>${t.name||"-"}</td><td>${t.atkInf||0}</td><td>${t.atkVeh||0}</td><td>${t.def||0}</td><td>${t.size||0}</td></tr>`);
  });

  w.innerHTML=`
    <h3>보급(식량) 소비</h3>
    <div class="grid">
      <input id="armyFood" type="number" value="${supply}" />
      ${canEditProfile(code)? `<button id="saveSupply">저장</button>`:""}
    </div>

    <h3>편제(최대 5종)</h3>
    <table class="table">
      <thead><tr><th>ID</th><th>이름</th><th>대인공격</th><th>대물공격</th><th>방어</th><th>규모</th></tr></thead>
      <tbody>${rows.join("") || `<tr><td colspan="6">없음</td></tr>`}</tbody>
    </table>
    ${canEditProfile(code)? `
    <div class="grid">
      <input id="tmId" placeholder="편제ID(1~5 권장)">
      <input id="tmName" placeholder="이름">
      <input id="tmInf" type="number" placeholder="대인공격">
      <input id="tmVeh" type="number" placeholder="대물공격">
      <input id="tmDef" type="number" placeholder="방어">
      <input id="tmSize" type="number" placeholder="규모">
      <button id="saveTm">추가/수정</button>
    </div>`:""}
  `;

  if (canEditProfile(code)){
    $("#saveSupply").onclick=async ()=>{
      await updateDoc(pRef,{ supplyConsumption: Number($("#armyFood").value||0) });
      alert("저장");
    };
    $("#saveTm").onclick=async ()=>{
      const id=($("#tmId").value||"").trim(); if(!id) return;
      // 5종 제한
      const count=(await getDocs(collection(db,"profiles",code,"army","templates"))).size;
      if (count>=5 && !(await getDoc(doc(db,"profiles",code,"army","templates",id))).exists()){
        return alert("최대 5종까지 운용 가능합니다.");
      }
      await setDoc(doc(db,"profiles",code,"army","templates",id),{
        name:$("#tmName").value.trim(),
        atkInf:Number($("#tmInf").value||0),
        atkVeh:Number($("#tmVeh").value||0),
        def:Number($("#tmDef").value||0),
        size:Number($("#tmSize").value||0),
      },{merge:true});
      renderArmy();
    };
  }
}
