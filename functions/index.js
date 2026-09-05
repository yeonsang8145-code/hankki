const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

exports.adminDeleteUser = onCall(async (request) => {
  const caller = request.auth;
  const targetUid = String(request.data?.uid || '').trim();
  if (!caller) throw new HttpsError('unauthenticated', '관리자 로그인이 필요합니다.');
  if (!targetUid) throw new HttpsError('invalid-argument', '삭제할 회원 UID가 없습니다.');

  const roleSnap = await admin.database().ref(`admins/${caller.uid}`).once('value');
  if (roleSnap.val() !== true) throw new HttpsError('permission-denied', '관리자 권한이 없습니다.');
  if (targetUid === caller.uid) throw new HttpsError('failed-precondition', '현재 로그인한 관리자 계정은 삭제할 수 없습니다.');

  const targetRole = await admin.database().ref(`admins/${targetUid}`).once('value');
  if (targetRole.val() === true) throw new HttpsError('failed-precondition', '다른 관리자 계정은 회원관리 화면에서 삭제할 수 없습니다.');

  try {
    await admin.auth().deleteUser(targetUid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw new HttpsError('internal', err.message || 'Authentication 계정 삭제 실패');
  }

  // 주문 기록은 회계/배송 확인을 위해 유지하고, 회원 프로필만 삭제합니다.
  await admin.database().ref(`users/${targetUid}`).remove();
  return { ok: true, message: 'Firebase Authentication 계정과 회원 프로필이 삭제되었습니다. 기존 주문 기록은 유지됩니다.' };
});
