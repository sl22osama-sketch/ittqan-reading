// shared_firebase.js - DB only storage
(function(window) {
  'use strict';
  const DB_PATH = '/readingSessionsV2';
  let app = null, db = null;

  function ensureFirebase() {
    if (!window.firebase || !window.FIREBASE_CONFIG) return false;
    if (!app) {
      app = firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
    }
    return true;
  }

  function makeStudentKey(name, school) {
    return (name||'').trim().toLowerCase() + '::' + (school||'').trim().toLowerCase();
  }

  async function addSession(session) {
    if (!ensureFirebase()) return null;
    const key = makeStudentKey(session.studentName, session.schoolName);
    const ref = db.ref(DB_PATH+'/students/'+key);
    const newRef = ref.child('sessions').push();
    const sid = newRef.key;

    const payload = {
      id: sid,
      date: session.date,
      level: session.level,
      textTitle: session.textTitle,
      textIndex: session.textIndex,
      wordsRead: session.wordsRead,
      totalWords: session.totalWords,
      elapsedSeconds: session.elapsedSeconds,
      speed: session.speed,
      completion: session.completion,
      audioDataUrl: session.audioDataUrl || null,
      evaluation: session.evaluation || null
    };

    await ref.child('name').set(session.studentName);
    await ref.child('school').set(session.schoolName||'غير محدد');
    await ref.child('grade').set(session.grade||'');
    await newRef.set(payload);
    return sid;
  }

  async function getStudents() {
    if (!ensureFirebase()) return [];
    const snap = await db.ref(DB_PATH+'/students').once('value');
    const val = snap.val()||{};
    const result = [];
    Object.keys(val).forEach(k=>{
      const st = val[k]||{};
      const ss = Object.values(st.sessions||{});
      let total=ss.length, sumWords=0, sumSpeed=0, best=0, last=null;
      ss.forEach(s=>{
        sumWords+=s.wordsRead||0;
        sumSpeed+=s.speed||0;
        if((s.speed||0)>best) best=s.speed||0;
        if(s.date && (!last || s.date>last)) last=s.date;
      });
      result.push({
        key:k,
        name:st.name||'',
        school:st.school||'غير محدد',
        grade:st.grade||'',
        totalSessions:total,
        totalWords:sumWords,
        avgSpeed: total>0? Math.round(sumSpeed/total):0,
        bestSpeed:best,
        lastDate:last
      });
    });
    result.sort((a,b)=>a.name.localeCompare(b.name,'ar'));
    return result;
  }

  async function getStudentByKey(k){
    if(!ensureFirebase()) return null;
    const snap = await db.ref(DB_PATH+'/students/'+k).once('value');
    const v = snap.val();
    if(!v) return null;
    v.key = k;
    v.sessions = Object.values(v.sessions||{});
    return v;
  }

  async function listSessions(k){
    if(!ensureFirebase()) return [];
    const snap = await db.ref(DB_PATH+'/students/'+k+'/sessions').once('value');
    const v = snap.val()||{};
    const arr = Object.values(v);
    arr.sort((a,b)=> (a.date||'') < (b.date||'') ? -1 : 1);
    return arr;
  }

  async function updateEvaluation(k,sid,ev){
    if(!ensureFirebase()) return false;
    await db.ref(DB_PATH+'/students/'+k+'/sessions/'+sid+'/evaluation').set(ev);
    return true;
  }

  window.ReadingShared = {addSession,getStudents,getStudentByKey,listSessions,updateEvaluation};
})(window);
