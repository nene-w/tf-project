import { spawn } from 'child_process';
import path from 'path';

export interface FLAMEData {
  dataType: string;
  indicator: string;
  value: number;
  unit?: string;
  releaseDate?: string;
  source: string;
  description?: string;
}

/**
 * 调用 Python 脚本获取 FLAME 数据
 */
export async function fetchFLAMEData(): Promise<FLAMEData[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), 'server', 'fetch_flame_data.py');
    const pythonProcess = spawn('python3', [pythonScript]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[FLAMEDataWrapper] Python process failed with code ${code}:`, stderrData);
        // 即使失败也返回空数组而不是拒绝，这样前端不会崩溃
        resolve([]);
        return;
      }

      try {
        const data = JSON.parse(stdoutData);
        if (Array.isArray(data)) {
          resolve(data);
        } else {
          console.warn('[FLAMEDataWrapper] Unexpected data format:', typeof data);
          resolve([]);
        }
      } catch (error) {
        console.error('[FLAMEDataWrapper] Failed to parse Python output:', error);
        resolve([]);
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('[FLAMEDataWrapper] Process error:', error);
      resolve([]);
    });

    // 设置超时
    setTimeout(() => {
      pythonProcess.kill();
      console.warn('[FLAMEDataWrapper] Python process timeout');
      resolve([]);
    }, 30000); // 30秒超时
  });
}
