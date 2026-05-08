const defaultBrandName = "墨境个人 AI 摄影棚";
const officialSite = "img.inklens.art";

export function createVerificationEmail({ account = "", code, brandName = defaultBrandName } = {}) {
  return createAuthCodeEmail({ account, code, brandName, purpose: "register" });
}

export function createPasswordResetEmail({ account = "", code, brandName = defaultBrandName } = {}) {
  return createAuthCodeEmail({ account, code, brandName, purpose: "reset" });
}

export function createPasswordResetLinkEmail({ account = "", resetUrl = "", brandName = defaultBrandName } = {}) {
  const cleanBrandName = String(brandName || defaultBrandName).trim() || defaultBrandName;
  const maskedAccount = maskEmailAccount(account);
  const safeBrandName = escapeHtml(cleanBrandName);
  const safeMaskedAccount = escapeHtml(maskedAccount);
  const safeResetUrl = escapeHtml(String(resetUrl || "").trim());

  return {
    subject: `${cleanBrandName}｜重置密码`,
    text: [
      `【${cleanBrandName}】请点击下面的地址重置密码：`,
      String(resetUrl || "").trim(),
      "",
      "链接 30 分钟内有效，仅可使用一次。",
      maskedAccount ? `收件邮箱：${maskedAccount}` : "",
      `官方网站：https://${officialSite}`,
      "如非本人操作，无需处理。本邮件由系统自动发送，请勿直接回复。"
    ].filter(Boolean).join("\n"),
    html: `
      <div style="margin:0;padding:24px;background:#f6f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'Noto Sans SC',sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e7e1d8;border-radius:8px;overflow:hidden;box-shadow:0 10px 28px rgba(55,45,35,0.08);">
                <tr>
                  <td style="padding:28px 32px 22px;">
                    <div style="font-size:13px;font-weight:700;color:#9f2f22;">${safeBrandName}</div>
                    <h1 style="margin:10px 0 8px;font-size:22px;line-height:1.35;color:#111827;font-weight:700;">密码重置</h1>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.8;color:#4b5563;">我们收到了你的密码重置申请。点击下面的按钮，进入重置页面设置新的登录密码。</p>

                    <div style="margin:0 0 18px;text-align:center;">
                      <a href="${safeResetUrl}" style="display:inline-block;padding:14px 24px;border-radius:10px;background:#9f2f22;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">重置密码</a>
                    </div>

                    <p style="margin:0 0 14px;font-size:13px;line-height:1.8;color:#6b7280;">如果按钮无法打开，请复制下面的地址到浏览器：</p>
                    <div style="border:1px solid #eadfd6;background:#fff8f4;border-radius:8px;padding:12px 14px;word-break:break-all;font-size:13px;line-height:1.7;color:#9f2f22;">${safeResetUrl}</div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:18px 0 0;">
                      <tr>
                        <td style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;color:#6b7280;">有效时间</td>
                        <td align="right" style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;font-weight:700;color:#111827;">30 分钟</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;color:#6b7280;">收件邮箱</td>
                        <td align="right" style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;font-weight:700;color:#111827;">${safeMaskedAccount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px;background:#fbfaf8;border-top:1px solid #eee7df;font-size:12px;line-height:1.7;color:#8a8178;">
                    本邮件由 ${safeBrandName} 系统自动发送，请勿直接回复。<br />
                    官方网站：<a href="https://${officialSite}" style="color:#9f2f22;text-decoration:none;">${officialSite}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`.trim()
  };
}

function createAuthCodeEmail({ account = "", code, brandName = defaultBrandName, purpose = "register" } = {}) {
  const cleanCode = String(code || "").trim();
  const cleanBrandName = String(brandName || defaultBrandName).trim() || defaultBrandName;
  const maskedAccount = maskEmailAccount(account);
  const safeBrandName = escapeHtml(cleanBrandName);
  const safeCode = escapeHtml(cleanCode);
  const safeMaskedAccount = escapeHtml(maskedAccount);
  const mode = resolveAuthMailCopy(purpose);

  return {
    subject: `${cleanBrandName}｜${mode.subjectSuffix}`,
    text: [
      `【${cleanBrandName}】${mode.codeLabel}：${cleanCode}`,
      "",
      mode.textLead,
      "验证码 5 分钟内有效，请勿转发给他人。",
      maskedAccount ? `收件邮箱：${maskedAccount}` : "",
      `官方网站：https://${officialSite}`,
      "如非本人操作，无需处理。本邮件由系统自动发送，请勿直接回复。"
    ].filter(Boolean).join("\n"),
    html: `
      <div style="margin:0;padding:24px;background:#f6f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'Noto Sans SC',sans-serif;color:#1f2937;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e7e1d8;border-radius:8px;overflow:hidden;box-shadow:0 10px 28px rgba(55,45,35,0.08);">
                <tr>
                  <td style="padding:28px 32px 22px;">
                    <div style="font-size:13px;font-weight:700;color:#9f2f22;">${safeBrandName}</div>
                    <h1 style="margin:10px 0 8px;font-size:22px;line-height:1.35;color:#111827;font-weight:700;">${mode.heading}</h1>
                    <p style="margin:0 0 22px;font-size:14px;line-height:1.8;color:#4b5563;">${mode.htmlLead}</p>

                    <div style="border:1px solid #eadfd6;background:#fff8f4;border-radius:8px;padding:18px 20px;margin:0 0 18px;text-align:center;">
                      <div style="font-size:12px;color:#8a6f5d;margin-bottom:8px;">${mode.codeLabel}</div>
                      <div style="font-size:34px;line-height:1.2;font-weight:800;color:#9f2f22;letter-spacing:0;">${safeCode}</div>
                    </div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;">
                      <tr>
                        <td style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;color:#6b7280;">有效时间</td>
                        <td align="right" style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;font-weight:700;color:#111827;">5 分钟</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;color:#6b7280;">收件邮箱</td>
                        <td align="right" style="padding:10px 0;border-top:1px solid #f1ece6;font-size:13px;font-weight:700;color:#111827;">${safeMaskedAccount}</td>
                      </tr>
                    </table>

                    <p style="margin:0;font-size:13px;line-height:1.8;color:#6b7280;">请勿将验证码转发给他人。如非本人操作，无需处理。</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px;background:#fbfaf8;border-top:1px solid #eee7df;font-size:12px;line-height:1.7;color:#8a8178;">
                    本邮件由 ${safeBrandName} 系统自动发送，请勿直接回复。<br />
                    官方网站：<a href="https://${officialSite}" style="color:#9f2f22;text-decoration:none;">${officialSite}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>`.trim()
  };
}

function resolveAuthMailCopy(purpose) {
  if (purpose === "reset") {
    return {
      subjectSuffix: "重置密码验证码",
      heading: "密码重置验证",
      codeLabel: "重置密码验证码",
      textLead: "你正在重置墨境账号密码，请在重置页面输入此验证码。",
      htmlLead: "你正在重置墨境账号密码。请在重置页面输入以下验证码，并设置新的登录密码。"
    };
  }
  return {
    subjectSuffix: "注册回执码",
    heading: "官方注册验证",
    codeLabel: "注册回执码",
    textLead: "你正在注册墨境账号，请在注册页面输入此回执码。",
    htmlLead: "你正在注册墨境账号。请在注册页面输入以下回执码，完成邮箱验证。"
  };
}

function maskEmailAccount(account) {
  const [name = "", domain = ""] = String(account || "").trim().toLowerCase().split("@");
  if (!name || !domain) return "";
  const visible = name.length <= 2 ? name : `${name.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
