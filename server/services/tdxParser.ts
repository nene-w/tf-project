/**
 * 通达信指标语法解析器
 * 将通达信格式的技术指标代码转换为天勤量化（TQSdk）可执行的Python代码
 */

// ────────────────────────────────────────────────────────────────────────────
// 通达信内置函数映射到 numpy/pandas 等价实现
// ────────────────────────────────────────────────────────────────────────────
const TDX_FUNC_MAP: Record<string, string> = {
  // 均线类
  MA: "tqsdk_ma",
  EMA: "tqsdk_ema",
  SMA: "tqsdk_sma",
  WMA: "tqsdk_wma",
  DMA: "tqsdk_dma",
  EXPMEMA: "tqsdk_ema",
  // 最值类
  HHV: "tqsdk_hhv",
  LLV: "tqsdk_llv",
  HHVBARS: "tqsdk_hhvbars",
  LLVBARS: "tqsdk_llvbars",
  // 统计类
  STD: "tqsdk_std",
  VAR: "tqsdk_var",
  AVEDEV: "tqsdk_avedev",
  DEVSQ: "tqsdk_devsq",
  SLOPE: "tqsdk_slope",
  FORCAST: "tqsdk_forcast",
  // 逻辑类
  IF: "tqsdk_if",
  IFF: "tqsdk_if",
  IFAND: "tqsdk_ifand",
  IFOR: "tqsdk_ifor",
  // 引用类
  REF: "tqsdk_ref",
  REFV: "tqsdk_ref",
  BARS: "tqsdk_bars",
  BARSLAST: "tqsdk_barslast",
  BARSSINCE: "tqsdk_barssince",
  BARSSINCEN: "tqsdk_barssincen",
  // 数学类
  ABS: "np.abs",
  MAX: "np.maximum",
  MIN: "np.minimum",
  SQRT: "np.sqrt",
  LOG: "np.log",
  EXP: "np.exp",
  POW: "np.power",
  ROUND: "np.round",
  CEILING: "np.ceil",
  FLOOR: "np.floor",
  MOD: "tqsdk_mod",
  // 计数类
  COUNT: "tqsdk_count",
  EVERY: "tqsdk_every",
  EXIST: "tqsdk_exist",
  EXISTR: "tqsdk_existr",
  LAST: "tqsdk_last",
  // 行情数据
  OPEN: "klines['open']",
  HIGH: "klines['high']",
  LOW: "klines['low']",
  CLOSE: "klines['close']",
  VOL: "klines['volume']",
  VOLUME: "klines['volume']",
  AMOUNT: "klines['volume']",
  // 信号类
  CROSS: "tqsdk_cross",
  LONGCROSS: "tqsdk_longcross",
  UPNDAY: "tqsdk_upnday",
  DOWNNDAY: "tqsdk_downnday",
  NDAY: "tqsdk_nday",
  // 其他
  FILTER: "tqsdk_filter",
  SUMIF: "tqsdk_sumif",
  SUM: "tqsdk_sum",
  SUMbars: "tqsdk_sum",
};

// 行情字段别名（通达信变量 -> klines列）
const PRICE_VARS: Record<string, string> = {
  OPEN: "klines['open']",
  HIGH: "klines['high']",
  LOW: "klines['low']",
  CLOSE: "klines['close']",
  VOL: "klines['volume']",
  VOLUME: "klines['volume']",
  AMOUNT: "klines['volume']",
  C: "klines['close']",
  O: "klines['open']",
  H: "klines['high']",
  L: "klines['low']",
  V: "klines['volume']",
};

// ────────────────────────────────────────────────────────────────────────────
// 解析器主函数
// ────────────────────────────────────────────────────────────────────────────

export interface ParseResult {
  success: boolean;
  pythonCode: string;
  error?: string;
  outputVars: string[];  // 指标输出变量名列表
  signalVars: string[];  // 信号变量名列表（BUY/SELL/SIGNAL等）
}

export function parseTdxIndicator(tdxCode: string, indicatorName: string = "INDICATOR"): ParseResult {
  try {
    const lines = tdxCode
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("{") && !l.startsWith("//"));

    const outputVars: string[] = [];
    const signalVars: string[] = [];
    const pythonLines: string[] = [];
    const paramDefs: string[] = [];

    // 提取参数定义 (N:=5; 或 N:5,1,100;)
    const params: Record<string, string> = {};

    for (const line of lines) {
      const cleanLine = line.replace(/;$/, "").trim();
      if (!cleanLine) continue;

      // 跳过注释行 {注释}
      if (cleanLine.startsWith("{") && cleanLine.endsWith("}")) continue;

      // 参数声明: NAME:DEFAULT,MIN,MAX（三段式，纯数字）
      const paramDeclMatch = cleanLine.match(/^([A-Za-z_]\w*)\s*:\s*(\d+(?:\.\d+)?)\s*,\s*\d+\s*,\s*\d+\s*$/);
      if (paramDeclMatch) {
        const [, name, defaultVal] = paramDeclMatch;
        params[name] = defaultVal;
        paramDefs.push(`${name} = ${defaultVal}  # parameter`);
        continue;
      }

      // 纯数字常量参数: NAME:=NUMBER（右侧只有数字，无函数调用）
      const numParamMatch = cleanLine.match(/^([A-Za-z_]\w*)\s*:=\s*(\d+(?:\.\d+)?)\s*$/);
      if (numParamMatch) {
        const [, name, val] = numParamMatch;
        params[name] = val;
        paramDefs.push(`${name} = ${val}  # constant`);
        continue;
      }

      // 赋值语句: VAR := EXPR 或 VAR:EXPR
      const assignMatch = cleanLine.match(/^([A-Za-z_]\w*)\s*:=?\s*(.+)$/);
      if (assignMatch) {
        const [, varName, expr] = assignMatch;
        const pyExpr = convertExpression(expr, params);

        // 判断是否为输出变量（通达信中以DRAWLINE/STICKLINE等开头或包含颜色设置的不输出）
        const isOutput = !expr.toUpperCase().includes("DRAWLINE") &&
          !expr.toUpperCase().includes("STICKLINE") &&
          !expr.toUpperCase().includes("DRAWTEXT") &&
          !expr.toUpperCase().includes("DRAWNUMBER");

        if (isOutput) {
          // 检测信号变量
          const upperVar = varName.toUpperCase();
          if (upperVar.includes("BUY") || upperVar.includes("SELL") ||
            upperVar.includes("SIGNAL") || upperVar.includes("CROSS") ||
            upperVar === "BS" || upperVar === "SS") {
            signalVars.push(varName);
          } else {
            outputVars.push(varName);
          }
          pythonLines.push(`${varName} = ${pyExpr}`);
        }
        continue;
      }
    }

    // 生成完整Python代码
    const helperFunctions = generateHelperFunctions();
    const paramSection = paramDefs.length > 0 ? `    # Parameters\n    ${paramDefs.join("\n    ")}\n` : "";
    const calcSection = pythonLines.map(l => `    ${l}`).join("\n");

    const allOutputVars = [...outputVars, ...signalVars];
    const returnDict = allOutputVars.length > 0
      ? `    return {\n${allOutputVars.map(v => `        '${v}': ${v}`).join(",\n")}\n    }`
      : "    return {}";

    const pythonCode = `# Auto-generated from TDX indicator: ${indicatorName}
# Generated at: ${new Date().toISOString()}
import numpy as np
import pandas as pd
from tqsdk import tafunc

${helperFunctions}

def calculate_${indicatorName.replace(/[^a-zA-Z0-9_]/g, "_")}(klines):
    """
    计算指标: ${indicatorName}
    原始通达信代码已转换为Python/天勤量化格式
    
    参数:
        klines: 天勤量化K线数据 DataFrame
    返回:
        dict: 包含各指标值的字典
    """
${paramSection}
${calcSection}

${returnDict}
`;

    return { success: true, pythonCode, outputVars, signalVars };
  } catch (e: any) {
    return {
      success: false,
      pythonCode: "",
      error: e.message,
      outputVars: [],
      signalVars: [],
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 表达式转换
// ────────────────────────────────────────────────────────────────────────────

function convertExpression(expr: string, params: Record<string, string>): string {
  let result = expr.trim();

  // 替换行情变量（单字母优先处理，避免误替换）
  // 先处理长名称
  for (const [tdxVar, pyVar] of Object.entries(PRICE_VARS)) {
    if (tdxVar.length > 1) {
      result = result.replace(new RegExp(`\\b${tdxVar}\\b`, "gi"), pyVar);
    }
  }
  // 再处理单字母（C/O/H/L/V），只在非函数调用上下文中替换
  result = result.replace(/\bC\b/g, "klines['close']");
  result = result.replace(/\bO\b/g, "klines['open']");
  result = result.replace(/\bH\b/g, "klines['high']");
  result = result.replace(/\bL\b/g, "klines['low']");
  result = result.replace(/\bV\b/g, "klines['volume']");

  // 替换函数名（大写）
  for (const [tdxFunc, pyFunc] of Object.entries(TDX_FUNC_MAP)) {
    if (tdxFunc.length > 1) {
      result = result.replace(new RegExp(`\\b${tdxFunc}\\b`, "gi"), pyFunc);
    }
  }

  // 运算符转换
  result = result.replace(/\bAND\b/gi, "&");
  result = result.replace(/\bOR\b/gi, "|");
  result = result.replace(/\bNOT\b/gi, "~");

  // 幂运算
  result = result.replace(/\*\*/g, "**");

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// 辅助函数生成（天勤量化兼容的通达信函数实现）
// ────────────────────────────────────────────────────────────────────────────

function generateHelperFunctions(): string {
  return `
# ── TDX Helper Functions (TQSdk Compatible) ──────────────────────────────────

def tqsdk_ma(series, n):
    """简单移动平均"""
    return series.rolling(window=int(n), min_periods=1).mean()

def tqsdk_ema(series, n):
    """指数移动平均"""
    return series.ewm(span=int(n), adjust=False).mean()

def tqsdk_sma(series, n, m=1):
    """通达信SMA: SMA(X,N,M) = (M*X + (N-M)*SMA[-1]) / N"""
    result = series.copy()
    alpha = m / n
    for i in range(1, len(series)):
        result.iloc[i] = alpha * series.iloc[i] + (1 - alpha) * result.iloc[i-1]
    return result

def tqsdk_wma(series, n):
    """加权移动平均"""
    weights = np.arange(1, n + 1)
    return series.rolling(window=int(n)).apply(lambda x: np.dot(x, weights) / weights.sum(), raw=True)

def tqsdk_dma(series, a):
    """动态移动平均: DMA(X,A) = A*X + (1-A)*DMA[-1]"""
    result = series.copy()
    for i in range(1, len(series)):
        result.iloc[i] = a * series.iloc[i] + (1 - a) * result.iloc[i-1]
    return result

def tqsdk_hhv(series, n):
    """N周期最高值"""
    return series.rolling(window=int(n), min_periods=1).max()

def tqsdk_llv(series, n):
    """N周期最低值"""
    return series.rolling(window=int(n), min_periods=1).min()

def tqsdk_hhvbars(series, n):
    """距N周期最高值的K线数"""
    return series.rolling(window=int(n), min_periods=1).apply(lambda x: len(x) - 1 - np.argmax(x), raw=True)

def tqsdk_llvbars(series, n):
    """距N周期最低值的K线数"""
    return series.rolling(window=int(n), min_periods=1).apply(lambda x: len(x) - 1 - np.argmin(x), raw=True)

def tqsdk_std(series, n):
    """N周期标准差"""
    return series.rolling(window=int(n), min_periods=1).std()

def tqsdk_var(series, n):
    """N周期方差"""
    return series.rolling(window=int(n), min_periods=1).var()

def tqsdk_avedev(series, n):
    """平均绝对偏差"""
    return series.rolling(window=int(n), min_periods=1).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)

def tqsdk_ref(series, n):
    """引用N周期前的值"""
    return series.shift(int(n))

def tqsdk_sum(series, n):
    """N周期求和"""
    if n == 0:
        return series.cumsum()
    return series.rolling(window=int(n), min_periods=1).sum()

def tqsdk_count(cond, n):
    """统计N周期内条件成立次数"""
    return cond.astype(int).rolling(window=int(n), min_periods=1).sum()

def tqsdk_every(cond, n):
    """N周期内条件是否每次都成立"""
    return tqsdk_count(cond, n) == n

def tqsdk_exist(cond, n):
    """N周期内条件是否曾经成立"""
    return tqsdk_count(cond, n) > 0

def tqsdk_if(cond, true_val, false_val):
    """条件选择: IF(COND, A, B)"""
    return pd.Series(np.where(cond, true_val, false_val), index=cond.index if hasattr(cond, 'index') else None)

def tqsdk_ifand(cond1, cond2, true_val, false_val):
    """IFAND(COND1, COND2, A, B)"""
    return tqsdk_if(cond1 & cond2, true_val, false_val)

def tqsdk_ifor(cond1, cond2, true_val, false_val):
    """IFOR(COND1, COND2, A, B)"""
    return tqsdk_if(cond1 | cond2, true_val, false_val)

def tqsdk_cross(series_a, series_b):
    """金叉：A上穿B（前一根A<B，当前A>B）"""
    prev_a = series_a.shift(1)
    prev_b = series_b.shift(1)
    return (prev_a < prev_b) & (series_a > series_b)

def tqsdk_longcross(series_a, series_b, n):
    """N周期以上的金叉"""
    below_n = tqsdk_every(series_a < series_b, n)
    cross_now = series_a > series_b
    return below_n.shift(1).fillna(False) & cross_now

def tqsdk_barslast(cond):
    """上次条件成立距今的K线数"""
    result = pd.Series(np.nan, index=cond.index)
    last_true = -1
    for i, val in enumerate(cond):
        if val:
            last_true = i
        if last_true >= 0:
            result.iloc[i] = i - last_true
    return result

def tqsdk_barssince(cond):
    """第一次条件成立距今的K线数"""
    result = pd.Series(np.nan, index=cond.index)
    first_true = -1
    for i, val in enumerate(cond):
        if val and first_true < 0:
            first_true = i
        if first_true >= 0:
            result.iloc[i] = i - first_true
    return result

def tqsdk_filter(cond, n):
    """过滤：条件成立后N周期内不再触发"""
    result = pd.Series(False, index=cond.index)
    last_trigger = -n - 1
    for i, val in enumerate(cond):
        if val and (i - last_trigger) > n:
            result.iloc[i] = True
            last_trigger = i
    return result

def tqsdk_slope(series, n):
    """线性回归斜率"""
    def _slope(x):
        if len(x) < 2:
            return np.nan
        return np.polyfit(range(len(x)), x, 1)[0]
    return series.rolling(window=int(n), min_periods=2).apply(_slope, raw=True)

def tqsdk_mod(a, b):
    """取模"""
    return a % b

def tqsdk_bars(series, n):
    """引用N周期前的值（同REF）"""
    return series.shift(int(n))

def tqsdk_upnday(series, n):
    """连续N天上涨"""
    return tqsdk_every(series > series.shift(1), n)

def tqsdk_downnday(series, n):
    """连续N天下跌"""
    return tqsdk_every(series < series.shift(1), n)

def tqsdk_nday(series_a, series_b, n):
    """连续N天A>B"""
    return tqsdk_every(series_a > series_b, n)

def tqsdk_sumif(series, cond, n):
    """条件求和"""
    return (series * cond.astype(int)).rolling(window=int(n), min_periods=1).sum()

def tqsdk_devsq(series, n):
    """偏差平方和"""
    return series.rolling(window=int(n), min_periods=1).apply(
        lambda x: np.sum((x - np.mean(x)) ** 2), raw=True
    )

def tqsdk_forcast(series, n):
    """线性回归预测值"""
    def _forcast(x):
        if len(x) < 2:
            return np.nan
        coeffs = np.polyfit(range(len(x)), x, 1)
        return np.polyval(coeffs, len(x) - 1)
    return series.rolling(window=int(n), min_periods=2).apply(_forcast, raw=True)

def tqsdk_barssincen(cond, n):
    """N周期内上次条件成立距今的K线数"""
    result = pd.Series(np.nan, index=cond.index)
    for i in range(len(cond)):
        start = max(0, i - int(n) + 1)
        window = cond.iloc[start:i+1]
        true_indices = np.where(window.values)[0]
        if len(true_indices) > 0:
            result.iloc[i] = len(window) - 1 - true_indices[-1]
    return result

def tqsdk_existr(cond, n1, n2):
    """从N1到N2周期前条件是否成立"""
    shifted_cond = pd.DataFrame({i: cond.shift(i) for i in range(int(n1), int(n2)+1)})
    return shifted_cond.any(axis=1)

def tqsdk_last(cond, n1, n2):
    """从N1到N2周期前条件是否每次都成立"""
    shifted_cond = pd.DataFrame({i: cond.shift(i) for i in range(int(n1), int(n2)+1)})
    return shifted_cond.all(axis=1)
`;
}

// ────────────────────────────────────────────────────────────────────────────
// 信号检测：从指标结果中提取买卖信号
// ────────────────────────────────────────────────────────────────────────────

export function generateSignalDetectionCode(
  indicatorFuncName: string,
  signalVars: string[],
  outputVars: string[]
): string {
  const signalChecks = signalVars.map(v => {
    const upper = v.toUpperCase();
    const signalType = upper.includes("BUY") || upper.includes("GOLD") || upper.includes("LONG")
      ? "buy"
      : upper.includes("SELL") || upper.includes("DEAD") || upper.includes("SHORT")
        ? "sell"
        : "alert";
    return `    if '${v}' in result and bool(result['${v}'].iloc[-1]):
        signals.append({'type': '${signalType}', 'var': '${v}', 'value': float(result['${v}'].iloc[-1])})`;
  }).join("\n");

  return `
def detect_signals_${indicatorFuncName}(klines):
    """检测 ${indicatorFuncName} 指标信号"""
    result = ${indicatorFuncName}(klines)
    signals = []
${signalChecks || "    pass  # No signal variables detected"}
    return signals, result
`;
}
