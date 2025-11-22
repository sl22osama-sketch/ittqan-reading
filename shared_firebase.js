// shared_firebase.js - تخزين الجلسات عبر Firebase (Realtime Database + Storage)
(function (window) {
  'use strict';

  const DB_PATH = '/readingSessionsV2';
  const STORAGE_FOLDER = 'readingAudio';

  let app = null;
  let db = null;
  let storage = null;

  function ensureFirebase() {
    if (!window.firebase || !window.FIREBASE_CONFIG) {
      console.error('Firebase أو FIREBASE_CONFIG غير متوفرين');
      return false;
    }
    if (!app) {
      app = firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.database();
      // لو كان Storage غير مفعّل لن يتأثر التخزين في الـ Database
      try {
        storage = firebase.storage();
      } catch (e) {
        console.warn('Firebase Storage غير متاح، سيتم تجاهل رفع الصوت', e);
        storage = null;
      }
    }
    return true;
  }

  function makeStudentKey(name, school) {
    const n = (name || '').trim().toLowerCase();
    const s = (school || '').trim().toLowerCase();
    return n + '::' + s;
  }

  async function uploadAudio(studentKey, sessionId, dataUrl) {
    if (!ensureFirebase() || !storage || !dataUrl) return null;

    const base64 = dataUrl.split(',')[1];
    const path = `${STORAGE_FOLDER}/${studentKey}/${sessionId}.mp3`;
    const ref = storage.ref().child(path);
    await ref.putString(base64, 'base64', { contentType: 'audio/mpeg' });
    const url = await ref.getDownloadURL();
    return url;
  }

  async function addSession(session) {
    if (!ensureFirebase()) return null;

    const studentKey = makeStudentKey(session.studentName, session.schoolName);
    const ref = db.ref(DB_PATH + '/students/' + studentKey);
    const newSessionRef = ref.child('sessions').push();
    const sessionId = newSessionRef.key;

    let audioUrl = null;
    try {
      if (session.audioDataUrl) {
        audioUrl = await uploadAudio(studentKey, sessionId, session.audioDataUrl);
      }
    } catch (e) {
      console.error('Error uploading audio', e);
    }

    const payload = {
      id: sessionId,
      date: session.date,
      level: session.level,
      textTitle: session.textTitle,
      textIndex: session.textIndex,
      wordsRead: session.wordsRead,
      totalWords: session.totalWords,
      elapsedSeconds: session.elapsedSeconds,
      speed: session.speed,
      completion: session.completion,
      audioUrl: audioUrl || null,
      evaluation: session.evaluation || null
    };

    await ref.child('name').set(session.studentName);
    await ref.child('school').set(session.schoolName || 'غير محدد');
    await ref.child('grade').set(session.grade || '');
    await newSessionRef.set(payload);

    return sessionId;
  }

  async function getStudents() {
    if (!ensureFirebase()) return [];
    const snap = await db.ref(DB_PATH + '/students').once('value');
    const val = snap.val() || {};
    const result = [];

    Object.keys(val).forEach(key => {
      const student = val[key] || {};
      const sessionsObj = student.sessions || {};
      const sessions = Object.values(sessionsObj);

      let totalSessions = sessions.length;
      let totalWords = 0;
      let totalSpeed = 0;
      let bestSpeed = 0;
      let lastDate = null;

      sessions.forEach(s => {
        totalWords += s.wordsRead || 0;
        totalSpeed += s.speed || 0;
        if ((s.speed || 0) > bestSpeed) bestSpeed = s.speed || 0;
        if (s.date && (!lastDate || s.date > lastDate)) lastDate = s.date;
      });

      const avgSpeed = totalSessions > 0 ? Math.round(totalSpeed / totalSessions) : 0;

      result.push({
        key: key,
        name: student.name || '',
        school: student.school || 'غير محدد',
        grade: student.grade || '',
        totalSessions,
        totalWords,
        avgSpeed,
        bestSpeed,
        lastDate
      });
    });

    result.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    return result;
  }

  async function getStudentByKey(key) {
    if (!ensureFirebase()) return null;
    const snap = await db.ref(DB_PATH + '/students/' + key).once('value');
    const val = snap.val();
    if (!val) return null;

    const sessionsObj = val.sessions || {};
    const sessions = Object.values(sessionsObj);
    val.sessions = sessions;
    val.key = key;
    return val;
  }

  async function listSessions(key) {
    if (!ensureFirebase()) return [];
    const snap = await db.ref(DB_PATH + '/students/' + key + '/sessions').once('value');
    const val = snap.val() || {};
    const sessions = Object.values(val);

    sessions.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });

    return sessions;
  }

  async function updateEvaluation(key, sessionId, evaluation) {
    if (!ensureFirebase()) return false;
    const ref = db.ref(DB_PATH + '/students/' + key + '/sessions/' + sessionId + '/evaluation');
    await ref.set(evaluation);
    return true;
  }

  window.ReadingShared = {
    addSession,
    getStudents,
    getStudentByKey,
    listSessions,
    updateEvaluation
  };
})(window);
