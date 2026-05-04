import { hashVerificationCode, verifyVerificationCode } from "./crypto.mjs";

function toUser(row = {}) {
  return {
    id: String(row.id || ""),
    type: String(row.account_type || "email"),
    account: String(row.account || ""),
    accountLabel: String(row.account_label || ""),
    username: String(row.username || ""),
    nickname: String(row.nickname || row.username || ""),
    passwordHash: String(row.password_hash || ""),
    createdAt: new Date(row.created_at || Date.now()).toISOString(),
    lastLoginAt: new Date(row.last_login_at || Date.now()).toISOString()
  };
}

function toCodeRecord(row = {}) {
  return {
    type: String(row.account_type || "email"),
    account: String(row.account || ""),
    codeHash: String(row.code_hash || ""),
    delivery: String(row.delivery || "email"),
    sentAt: new Date(row.sent_at || Date.now()).getTime(),
    expiresAt: new Date(row.expires_at || Date.now()).getTime()
  };
}

export function createPostgresAuthStore({ db }) {
  async function listUsers() {
    const result = await db.query(
      `SELECT id, account_type, account, account_label, username, nickname, password_hash, created_at, last_login_at
       FROM auth_users
       ORDER BY created_at ASC`
    );
    return result.rows.map(toUser);
  }

  async function findUserByAccount(type, account) {
    const result = await db.query(
      `SELECT id, account_type, account, account_label, username, nickname, password_hash, created_at, last_login_at
       FROM auth_users
       WHERE account_type = $1 AND account = $2
       LIMIT 1`,
      [type, account]
    );
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async function createUser(user) {
    await db.query(
      `INSERT INTO auth_users (
        id, account_type, account, account_label, username, nickname, password_hash, created_at, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.id,
        user.type,
        user.account,
        user.accountLabel,
        user.username,
        user.nickname,
        user.passwordHash,
        user.createdAt,
        user.lastLoginAt
      ]
    );
    return user;
  }

  async function updateLastLogin(userId, lastLoginAt) {
    await db.query("UPDATE auth_users SET last_login_at = $2 WHERE id = $1", [userId, lastLoginAt]);
  }

  async function getVerificationCode(type, account) {
    const result = await db.query(
      `SELECT account_type, account, code_hash, delivery, sent_at, expires_at
       FROM auth_verification_codes
       WHERE account_type = $1 AND account = $2
       LIMIT 1`,
      [type, account]
    );
    return result.rows[0] ? toCodeRecord(result.rows[0]) : null;
  }

  async function saveVerificationCode({ type, account, code, delivery = "email", sentAt, expiresAt }) {
    const codeHash = hashVerificationCode(code);
    await db.query(
      `INSERT INTO auth_verification_codes (
        account_type, account, code_hash, delivery, sent_at, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (account_type, account) DO UPDATE SET
        code_hash = EXCLUDED.code_hash,
        delivery = EXCLUDED.delivery,
        sent_at = EXCLUDED.sent_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = CURRENT_TIMESTAMP`,
      [type, account, codeHash, delivery, new Date(sentAt).toISOString(), new Date(expiresAt).toISOString()]
    );
  }

  async function verifyCode(type, account, code) {
    const record = await getVerificationCode(type, account);
    if (!record) return { ok: false, reason: "missing" };
    if (record.expiresAt < Date.now()) return { ok: false, reason: "expired" };
    if (!verifyVerificationCode(code, record.codeHash)) return { ok: false, reason: "invalid" };
    return { ok: true, record };
  }

  async function deleteVerificationCode(type, account) {
    await db.query("DELETE FROM auth_verification_codes WHERE account_type = $1 AND account = $2", [type, account]);
  }

  async function countRecentLoginFailures({ type, account, clientIp = "", since }) {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE account_type = $1 AND account = $2) AS account_failures,
         COUNT(*) FILTER (WHERE client_ip = $3) AS ip_failures
       FROM auth_login_failures
       WHERE created_at >= $4`,
      [type, account, clientIp, new Date(since).toISOString()]
    );
    const row = result.rows[0] || {};
    return {
      accountFailures: Number(row.account_failures) || 0,
      ipFailures: Number(row.ip_failures) || 0
    };
  }

  async function recordLoginFailure({ type, account, clientIp = "", createdAt }) {
    await db.query(
      `INSERT INTO auth_login_failures (account_type, account, client_ip, created_at)
       VALUES ($1, $2, $3, $4)`,
      [type, account, clientIp, new Date(createdAt).toISOString()]
    );
  }

  async function clearLoginFailures({ type, account, clientIp = "" }) {
    await db.query(
      `DELETE FROM auth_login_failures
       WHERE account_type = $1 AND account = $2 AND ($3 = '' OR client_ip = $3)`,
      [type, account, clientIp]
    );
  }

  return {
    listUsers,
    findUserByAccount,
    createUser,
    updateLastLogin,
    getVerificationCode,
    saveVerificationCode,
    verifyCode,
    deleteVerificationCode,
    countRecentLoginFailures,
    recordLoginFailure,
    clearLoginFailures
  };
}
