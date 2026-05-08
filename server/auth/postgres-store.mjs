import { hashVerificationCode, verifyVerificationCode } from "./crypto.mjs";
import { postgresSchema } from "../persistence/postgres.mjs";

const t = postgresSchema.tables;
const u = postgresSchema.authUsers;
const v = postgresSchema.verificationCodes;
const f = postgresSchema.loginFailures;

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
    purpose: String(row.purpose || "register"),
    codeHash: String(row.code_hash || ""),
    delivery: String(row.delivery || "email"),
    sentAt: new Date(row.sent_at || Date.now()).getTime(),
    expiresAt: new Date(row.expires_at || Date.now()).getTime()
  };
}

export function createPostgresAuthStore({ db }) {
  async function listUsers() {
    const result = await db.query(
      `SELECT ${u.id} AS id, ${u.accountType} AS account_type, ${u.account} AS account,
              ${u.accountLabel} AS account_label, ${u.username} AS username,
              ${u.nickname} AS nickname, ${u.passwordHash} AS password_hash,
              ${u.createdAt} AS created_at, ${u.lastLoginAt} AS last_login_at
       FROM ${t.authUsers}
       ORDER BY ${u.createdAt} ASC`
    );
    return result.rows.map(toUser);
  }

  async function findUserByAccount(type, account) {
    const result = await db.query(
      `SELECT ${u.id} AS id, ${u.accountType} AS account_type, ${u.account} AS account,
              ${u.accountLabel} AS account_label, ${u.username} AS username,
              ${u.nickname} AS nickname, ${u.passwordHash} AS password_hash,
              ${u.createdAt} AS created_at, ${u.lastLoginAt} AS last_login_at
       FROM ${t.authUsers}
       WHERE ${u.accountType} = $1 AND ${u.account} = $2
       LIMIT 1`,
      [type, account]
    );
    return result.rows[0] ? toUser(result.rows[0]) : null;
  }

  async function createUser(user) {
    await db.query(
      `INSERT INTO ${t.authUsers} (
        ${u.id}, ${u.accountType}, ${u.account}, ${u.accountLabel}, ${u.username},
        ${u.nickname}, ${u.passwordHash}, ${u.createdAt}, ${u.lastLoginAt}
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
    await db.query(`UPDATE ${t.authUsers} SET ${u.lastLoginAt} = $2 WHERE ${u.id} = $1`, [userId, lastLoginAt]);
  }

  async function getVerificationCode(type, account, purpose = "register") {
    const result = await db.query(
      `SELECT ${v.accountType} AS account_type, ${v.account} AS account, ${v.purpose} AS purpose,
              ${v.codeHash} AS code_hash, ${v.delivery} AS delivery,
              ${v.sentAt} AS sent_at, ${v.expiresAt} AS expires_at
       FROM ${t.verificationCodes}
       WHERE ${v.accountType} = $1 AND ${v.account} = $2 AND ${v.purpose} = $3
       LIMIT 1`,
      [type, account, purpose]
    );
    return result.rows[0] ? toCodeRecord(result.rows[0]) : null;
  }

  async function saveVerificationCode({ type, account, purpose = "register", code, delivery = "email", sentAt, expiresAt }) {
    const codeHash = hashVerificationCode(code);
    await db.query(
      `INSERT INTO ${t.verificationCodes} (
        ${v.accountType}, ${v.account}, ${v.purpose}, ${v.codeHash}, ${v.delivery},
        ${v.sentAt}, ${v.expiresAt}, ${v.createdAt}, ${v.updatedAt}
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (${v.accountType}, ${v.account}, ${v.purpose}) DO UPDATE SET
        ${v.codeHash} = EXCLUDED.${v.codeHash},
        ${v.delivery} = EXCLUDED.${v.delivery},
        ${v.sentAt} = EXCLUDED.${v.sentAt},
        ${v.expiresAt} = EXCLUDED.${v.expiresAt},
        ${v.updatedAt} = CURRENT_TIMESTAMP`,
      [type, account, purpose, codeHash, delivery, new Date(sentAt).toISOString(), new Date(expiresAt).toISOString()]
    );
  }

  async function verifyCode(type, account, purpose = "register", code) {
    const record = await getVerificationCode(type, account, purpose);
    if (!record) return { ok: false, reason: "missing" };
    if (record.expiresAt < Date.now()) return { ok: false, reason: "expired" };
    if (!verifyVerificationCode(code, record.codeHash)) return { ok: false, reason: "invalid" };
    return { ok: true, record };
  }

  async function deleteVerificationCode(type, account, purpose = "register") {
    await db.query(
      `DELETE FROM ${t.verificationCodes} WHERE ${v.accountType} = $1 AND ${v.account} = $2 AND ${v.purpose} = $3`,
      [type, account, purpose]
    );
  }

  async function updatePasswordHash(userId, passwordHash) {
    await db.query(`UPDATE ${t.authUsers} SET ${u.passwordHash} = $2 WHERE ${u.id} = $1`, [userId, passwordHash]);
  }

  async function countRecentLoginFailures({ type, account, clientIp = "", since }) {
    const result = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE ${f.accountType} = $1 AND ${f.account} = $2) AS account_failures,
         COUNT(*) FILTER (WHERE ${f.clientIp} = $3) AS ip_failures
       FROM ${t.loginFailures}
       WHERE ${f.createdAt} >= $4`,
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
      `INSERT INTO ${t.loginFailures} (${f.accountType}, ${f.account}, ${f.clientIp}, ${f.createdAt})
       VALUES ($1, $2, $3, $4)`,
      [type, account, clientIp, new Date(createdAt).toISOString()]
    );
  }

  async function clearLoginFailures({ type, account, clientIp = "" }) {
    await db.query(
      `DELETE FROM ${t.loginFailures}
       WHERE ${f.accountType} = $1 AND ${f.account} = $2 AND ($3 = '' OR ${f.clientIp} = $3)`,
      [type, account, clientIp]
    );
  }

  return {
    listUsers,
    findUserByAccount,
    createUser,
    updateLastLogin,
    updatePasswordHash,
    getVerificationCode,
    saveVerificationCode,
    verifyCode,
    deleteVerificationCode,
    countRecentLoginFailures,
    recordLoginFailure,
    clearLoginFailures
  };
}
