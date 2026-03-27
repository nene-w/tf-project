// @ts-ignore - mailparser types
import { simpleParser } from "mailparser";
import { getDb } from "./db";
import { emailSignals } from "../drizzle/schema";
import Imap from "imap";

interface ParsedSignal {
  contract: string;
  signalType: "buy" | "sell" | "hold";
  period: "15" | "30" | "60" | "day";
  variety: string; // 二债、五债、十债、30债
  date: Date;
}

interface EmailSignalData {
  emailSubject: string;
  contract: string;
  signalType: "buy" | "sell" | "hold";
  price?: string;
  confidence: number;
  signalTime: Date;
  emailContent: string;
  emailId: string;
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
 * 连接到 IMAP 邮箱并抓取未读邮件，返回解析的信号数组
 */
export async function fetchEmailSignals(): Promise<EmailSignalData[]> {
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;
  const sender = process.env.EMAIL_SENDER;

  if (!user || !password || !sender) {
    console.error("[Email Service] Missing email configuration");
    return [];
  }

  const imap = new Imap({
    user,
    password,
    host: "imap.163.com",
    port: 993,
    tls: true,
  });

  return new Promise((resolve, reject) => {
    const signals: EmailSignalData[] = [];
    let processedCount = 0;
    let totalEmails = 0;

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
          resolve([]);
          return;
        }

        console.log(`[Email Service] Found ${results.length} new emails`);
        totalEmails = results.length;

        // 获取邮件
        const f = imap.fetch(results, { bodies: "" });

        f.on("message", (msg: any, seqno: any) => {
          let emailSubject = "";
          let emailId = `${Date.now()}-${seqno}`;

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
                signals.push({
                  emailSubject: emailSubject,
                  contract: signal.contract,
                  signalType: signal.signalType,
                  price: undefined,
                  confidence: 85,
                  signalTime: signal.date,
                  emailContent: parsed.text || "",
                  emailId: emailId,
                });

                console.log(
                  `[Email Service] Parsed signal: ${signal.contract} ${signal.signalType}`
                );
              } else {
                console.log(
                  "[Email Service] Could not parse signal from subject:",
                  emailSubject
                );
              }

              processedCount++;
              if (processedCount === totalEmails) {
                console.log(
                  `[Email Service] All emails processed. Found ${signals.length} signals`
                );
                imap.end();
              }
            } catch (error) {
              console.error("[Email Service] Error processing email:", error);
              processedCount++;
              if (processedCount === totalEmails) {
                imap.end();
              }
            }
          });
        });

        f.on("error", (err: any) => {
          console.error("[Email Service] Fetch error:", err);
          imap.end();
          reject(err);
        });

        f.on("end", () => {
          console.log("[Email Service] Fetch completed");
          // 等待所有邮件处理完成后再关闭连接
          setTimeout(() => {
            if (processedCount === totalEmails) {
              resolve(signals);
            }
          }, 1000);
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
      resolve(signals);
    });

    imap.on("ready", () => {
      console.log("[Email Service] IMAP connection ready");
    });

    imap.openBox("INBOX", false, (err: any) => {
      if (err) console.error("[Email Service] Error opening box:", err);
      else imap.openBox("INBOX", false, () => imap.openBox("INBOX", false, () => {}));
    });

    imap.connect();
  });
}

/**
 * 启动定时轮询邮件
 */
export function startEmailPolling(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log(
    `[Email Service] Starting email polling every ${intervalMs / 1000} seconds`
  );

  const interval = setInterval(async () => {
    try {
      const signals = await fetchEmailSignals();
      console.log(`[Email Service] Polling completed. Found ${signals.length} signals`);
    } catch (error) {
      console.error("[Email Service] Polling error:", error);
    }
  }, intervalMs);

  return interval;
}
