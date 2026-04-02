import nodemailer from "nodemailer";
import type { EmailConfig } from "../drizzle/schema";

export interface AlertPayload {
  contract: string;
  indicatorName: string;
  signalType: "buy" | "sell" | "alert";
  price?: number;
  signalValue?: number;
  description?: string;
  triggeredAt: Date;
}

// 冷却时间追踪（内存级，防止重启后立即重复发送）
const lastSentMap = new Map<string, number>();

export async function sendAlertEmail(
  config: EmailConfig,
  payload: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  if (!config.isEnabled) {
    return { success: false, error: "Email alerts are disabled" };
  }

  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
    return { success: false, error: "Incomplete SMTP configuration" };
  }

  const toEmails = (config.toEmails as string[]) || [];
  if (toEmails.length === 0) {
    return { success: false, error: "No recipient email addresses configured" };
  }

  // 冷却检查
  const cooldownKey = `${payload.contract}_${payload.indicatorName}_${payload.signalType}`;
  const lastSent = lastSentMap.get(cooldownKey) || 0;
  const cooldownMs = (config.cooldownMinutes || 30) * 60 * 1000;
  if (Date.now() - lastSent < cooldownMs) {
    return { success: false, error: `Cooldown active, last sent ${Math.floor((Date.now() - lastSent) / 60000)} minutes ago` };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 465,
      secure: config.smtpSecure !== false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });

    const signalEmoji = payload.signalType === "buy" ? "🟢" : payload.signalType === "sell" ? "🔴" : "🟡";
    const signalText = payload.signalType === "buy" ? "买入信号" : payload.signalType === "sell" ? "卖出信号" : "报警信号";
    const contractDisplay = getContractDisplayName(payload.contract);

    const subject = `${signalEmoji} 国债期货信号报警 - ${contractDisplay} ${signalText}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: ${payload.signalType === "buy" ? "#16a34a" : payload.signalType === "sell" ? "#dc2626" : "#d97706"}; color: white; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
    .body { padding: 24px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
    .info-item { background: #f9fafb; border-radius: 6px; padding: 12px; }
    .info-item .label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
    .info-item .value { font-size: 16px; font-weight: 600; color: #111827; }
    .signal-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;
      background: ${payload.signalType === "buy" ? "#dcfce7" : payload.signalType === "sell" ? "#fee2e2" : "#fef3c7"};
      color: ${payload.signalType === "buy" ? "#16a34a" : payload.signalType === "sell" ? "#dc2626" : "#d97706"}; }
    .footer { background: #f9fafb; padding: 16px 24px; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${signalEmoji} 国债期货交易信号报警</h1>
      <p>系统检测到新的交易信号，请及时查看</p>
    </div>
    <div class="body">
      <p>您好，系统在 <strong>${payload.triggeredAt.toLocaleString("zh-CN")}</strong> 检测到以下交易信号：</p>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">合约品种</div>
          <div class="value">${contractDisplay}</div>
        </div>
        <div class="info-item">
          <div class="label">信号类型</div>
          <div class="value"><span class="signal-badge">${signalText}</span></div>
        </div>
        <div class="info-item">
          <div class="label">指标名称</div>
          <div class="value">${payload.indicatorName}</div>
        </div>
        <div class="info-item">
          <div class="label">触发价格</div>
          <div class="value">${payload.price ? payload.price.toFixed(3) : "N/A"}</div>
        </div>
        ${payload.signalValue !== undefined ? `
        <div class="info-item">
          <div class="label">指标值</div>
          <div class="value">${payload.signalValue.toFixed(4)}</div>
        </div>` : ""}
        <div class="info-item">
          <div class="label">触发时间</div>
          <div class="value" style="font-size:13px">${payload.triggeredAt.toLocaleString("zh-CN")}</div>
        </div>
      </div>
      ${payload.description ? `<p style="color:#6b7280;font-size:14px;margin-top:16px">${payload.description}</p>` : ""}
      <p style="margin-top:20px;padding:12px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;font-size:13px;color:#92400e">
        ⚠️ 本信号仅供参考，不构成投资建议。请结合市场情况谨慎决策。
      </p>
    </div>
    <div class="footer">
      此邮件由国债期货监控平台自动发送 · 如需关闭报警，请登录系统修改配置
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"国债期货监控" <${config.fromEmail || config.smtpUser}>`,
      to: toEmails.join(", "),
      subject,
      html,
    });

    lastSentMap.set(cooldownKey, Date.now());
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function testEmailConnection(config: Partial<EmailConfig>): Promise<{ success: boolean; error?: string }> {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
    return { success: false, error: "请填写完整的SMTP配置信息" };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 465,
      secure: config.smtpSecure !== false,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
    });
    await transporter.verify();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

function getContractDisplayName(contract: string): string {
  const map: Record<string, string> = {
    "KQ.m@CFFEX.T": "T主连（10年期国债期货）",
    "KQ.m@CFFEX.TF": "TF主连（5年期国债期货）",
    "KQ.m@CFFEX.TS": "TS主连（2年期国债期货）",
    "KQ.m@CFFEX.TL": "TL主连（30年期国债期货）",
  };
  return map[contract] || contract;
}
