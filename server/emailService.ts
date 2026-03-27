import Imap from "imap";
// @ts-ignore - mailparser types
import { simpleParser } from "mailparser";
import { getDb } from "./db";
import { emailSignals } from "../drizzle/schema";

interface ParsedSignal {
  contract: string;
  signalType: "buy" | "sell" | "hold";
  period: "15" | "30" | "60" | "day";
  variety: string; // 二债、五债、十债、30债
  date: Date;
}

/**
 * 从邮件主题中解析交易信号
 * 主题格式: "二债 2026-03-27 买入_15 卖出_30 ..."
 */
export function parseEmailSubject(subject: string): ParsedSignal | null {
  try {
    // 品种映射
    const varietyMap: Record<string, string> = {
      二债: "T2",
      五债: "T5",
      十债: "T10",
      "30债": "T30",
    };

    // 提取品种
    let variety = "";
    let varietyKey = "";
    for (const [key, value] of Object.entries(varietyMap)) {
      if (subject.includes(key)) {
        variety = value;
        varietyKey = key;
        break;
      }
    }

    if (!variety) return null;

    // 提取日期 (YYYY-MM-DD 格式)
    const dateMatch = subject.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) return null;
    const date = new Date(dateMatch[0]);

    // 提取交易类型和周期
    // 支持格式: 买入_15, 卖出_30, 买入_60, 卖出_日 等
    const signalPatterns = [
      { pattern: /买入_(\d+|日)/g, type: "buy" as const },
      { pattern: /卖出_(\d+|日)/g, type: "sell" as const },
    ];

    for (const { pattern, type } of signalPatterns) {
      const match = pattern.exec(subject);
      if (match) {
        const periodStr = match[1];
        let period: "15" | "30" | "60" | "day";

        if (periodStr === "日") {
          period = "day";
        } else if (periodStr === "15" || periodStr === "30" || periodStr === "60") {
          period = periodStr as "15" | "30" | "60";
        } else {
          continue;
        }

        // 构建合约代码 (e.g., T2406 for 二债 June 2026)
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = String(date.getFullYear()).slice(-2);
        const contract = `${variety}${month}${year}`;

        return {
          contract,
          signalType: type,
          period,
          variety: varietyKey,
          date,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("[Email Parser] Error parsing subject:", subject, error);
    return null;
  }
}

/**
 * 连接到 IMAP 邮箱并抓取未读邮件
 */
export async function fetchEmailSignals(): Promise<void> {
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;
  const sender = process.env.EMAIL_SENDER;

  if (!user || !password || !sender) {
    console.error("[Email Service] Missing email configuration");
    return;
  }

  const imap = new Imap({
    user,
    password,
    host: "imap.163.com",
    port: 993,
    tls: true,
  });

  return new Promise((resolve, reject) => {
    imap.openBox("INBOX", false, async (err: any, box: any) => {
      if (err) {
        console.error("[Email Service] Error opening inbox:", err);
        imap.end();
        reject(err);
        return;
      }

      try {
        // 查找来自特定发件人的未读邮件
        const searchCriteria = ["UNSEEN", ["FROM", sender]];
        const results = await new Promise<number[]>((resolve, reject) => {
          imap.search(searchCriteria, (err: any, results: number[] | undefined) => {
            if (err) reject(err);
            else resolve(results || []);
          });
        });

        if (results.length === 0) {
          console.log("[Email Service] No new emails from", sender);
          imap.end();
          resolve();
          return;
        }

        console.log(`[Email Service] Found ${results.length} new emails`);

        // 获取邮件
        const f = imap.fetch(results, { bodies: "" });

        f.on("message", (msg: any, seqno: any) => {
          let emailSubject = "";

          msg.on("headers", (headers: any) => {
            emailSubject = (headers.subject as string[])?.[0] || "";
            console.log(`[Email Service] Processing email: ${emailSubject}`);
          });

          msg.on("body", async (stream: any) => {
            try {
              const parsed = await simpleParser(stream);

              // 解析邮件主题中的交易信号
              const signal = parseEmailSubject(emailSubject);

              if (signal) {
                // 保存到数据库
                const db = await getDb();
                if (db) {
                  await db.insert(emailSignals).values({
                    userId: 1, // 默认用户 ID，实际应从 context 获取
                    emailSubject: emailSubject,
                    contract: signal.contract,
                    signalType: signal.signalType,
                    price: null, // 可以从邮件内容中进一步解析
                    confidence: 85, // 默认置信度
                    status: "pending",
                    signalTime: signal.date,
                    emailContent: parsed.text || "",
                  });

                  console.log(
                    `[Email Service] Saved signal: ${signal.contract} ${signal.signalType}`
                  );
                }
              } else {
                console.log(
                  "[Email Service] Could not parse signal from subject:",
                  emailSubject
                );
              }
            } catch (error) {
              console.error("[Email Service] Error processing email:", error);
            }
          });
        });

        f.on("error", (err: any) => {
          console.error("[Email Service] Fetch error:", err);
          reject(err);
        });

        f.on("end", () => {
          console.log("[Email Service] All emails processed");
          imap.end();
          resolve();
        });
      } catch (error) {
        console.error("[Email Service] Error:", error);
        imap.end();
        reject(error);
      }
    });

    imap.on("error", (err: any) => {
      console.error("[Email Service] IMAP error:", err);
      reject(err);
    });

    imap.on("end", () => {
      console.log("[Email Service] Connection closed");
    });

    imap.on("ready", () => {
      console.log("[Email Service] IMAP connection ready");
    });

    imap.openBox("INBOX", false, (err: any) => {
      if (err) console.error("[Email Service] Error opening box:", err);
    });

    imap.connect();
  });
}

/**
 * 启动定时任务，定期检查邮件
 */
export function startEmailPolling(intervalMinutes: number = 1): NodeJS.Timeout {
  console.log(
    `[Email Service] Starting email polling every ${intervalMinutes} minute(s)`
  );

  // 立即执行一次
  fetchEmailSignals().catch((err) => {
    console.error("[Email Service] Initial fetch failed:", err);
  });

  // 然后定期执行
  return setInterval(() => {
    fetchEmailSignals().catch((err) => {
      console.error("[Email Service] Polling failed:", err);
    });
  }, intervalMinutes * 60 * 1000);
}
