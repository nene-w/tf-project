import puppeteer, { Browser, Page } from 'puppeteer';
import { ENV } from './_core/env';

/**
 * 慧博投研资讯 Puppeteer 爬虫
 * 支持登录和动态页面加载
 */

export interface ResearchReport {
  title: string;
  summary?: string;
  source: string;
  author?: string;
  publishDate: Date;
  url: string;
  category: string;
  keywords: string[];
}

const BASE_URL = 'https://www.hibor.com.cn';

// 版块 URL 映射
const SECTIONS = {
  macro: `${BASE_URL}/economy_1.html`,           // 宏观经济
  bond: `${BASE_URL}/economy_3.html`,            // 债券研究
  futures: `${BASE_URL}/microns_8.html`,         // 期货研究
  hotspot: `${BASE_URL}/doceconomy/index_news.asp?S_S=&M_M=0&flag=0&liflag=7`, // 热点研报
  strategy: `${BASE_URL}/doceconomy/index_news.asp?S_S=&M_M=0&flag=0&liflag=2`, // 投资策略
  classic: `${BASE_URL}/doceconomy/index_news.asp?S_S=&flag=0&liflag=1`        // 经典研报
};

/**
 * 使用账号登录慧博
 */
async function loginHibor(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  
  try {
    console.log('[HiborPuppeteerScraper] Starting login...');
    
    // 访问登录页面
    await page.goto(`${BASE_URL}/login.html`, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // 等待登录表单加载
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    
    // 输入用户名
    await page.type('input[name="username"]', ENV.hiborUsername || '', { delay: 50 });
    
    // 输入密码
    await page.type('input[name="password"]', ENV.hiborPassword || '', { delay: 50 });
    
    // 点击登录按钮
    await page.click('button[type="submit"]');
    
    // 等待登录完成（导航到首页或仪表板）
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log('[HiborPuppeteerScraper] Login successful');
    return page;
  } catch (error) {
    console.error('[HiborPuppeteerScraper] Login failed:', error);
    await page.close();
    throw error;
  }
}

/**
 * 从指定 URL 抓取研报
 */
async function scrapeFromUrl(page: Page, url: string, category: string): Promise<ResearchReport[]> {
  const reports: ResearchReport[] = [];
  
  try {
    console.log(`[HiborPuppeteerScraper] Scraping ${category} from ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // 等待页面加载完成
    await page.waitForSelector('a', { timeout: 10000 }).catch(() => {});
    
    // 滚动页面以加载更多内容
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    
    // 等待动态内容加载
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 提取所有研报链接
    const reportData = await page.evaluate(() => {
      const reports: any[] = [];
      const links = document.querySelectorAll('a');
      
      links.forEach((link) => {
        const text = link.textContent?.trim() || '';
        const href = link.href || '';
        
        // 过滤出研报链接
        if (text.length > 8 && text.length < 200 && 
            (text.includes('债') || text.includes('期货') || text.includes('利率') || 
             text.includes('国债') || text.includes('研究') || text.includes('分析'))) {
          
          reports.push({
            title: text,
            url: href
          });
        }
      });
      
      return reports;
    });
    
    console.log(`[HiborPuppeteerScraper] Found ${reportData.length} potential reports in ${category}`);
    
    // 处理提取的数据
    reportData.forEach((item: any) => {
      const title = item.title.replace(/-?\s*\d{6}$/, '').trim();
      
      if (title.length > 5) {
        // 提取日期
        const dateMatch = item.title.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
        const publishDate = dateMatch ? parseDate(dateMatch[1]) : new Date();
        
        // 提取来源
        const sourceMatch = title.match(/^([^-]+)-/);
        const source = sourceMatch ? sourceMatch[1].trim() : '慧博投研';
        
        reports.push({
          title,
          source,
          publishDate,
          url: item.url,
          category,
          keywords: extractKeywords(title)
        });
      }
    });
    
    console.log(`[HiborPuppeteerScraper] Scraped ${reports.length} reports from ${category}`);
    return reports;
  } catch (error) {
    console.error(`[HiborPuppeteerScraper] Error scraping ${category}:`, error);
    return [];
  }
}

/**
 * 主爬虫函数：自动登录并抓取多个版块
 */
export async function scrapeHiborWithPuppeteer(): Promise<ResearchReport[]> {
  let browser: Browser | null = null;
  
  try {
    console.log('[HiborPuppeteerScraper] Starting Puppeteer browser...');
    
    // 启动浏览器
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    // 登录
    const loginPage = await loginHibor(browser);
    
    // 从多个版块抓取研报
    const allReports: ResearchReport[] = [];
    
    for (const [sectionKey, sectionUrl] of Object.entries(SECTIONS)) {
      try {
        const reports = await scrapeFromUrl(loginPage, sectionUrl, sectionKey);
        allReports.push(...reports);
      } catch (error) {
        console.error(`[HiborPuppeteerScraper] Error scraping section ${sectionKey}:`, error);
      }
    }
    
    // 关闭登录页面
    await loginPage.close();
    
    // 去重
    const uniqueReports = Array.from(
      new Map(allReports.map(r => [r.title, r])).values()
    );
    
    console.log(`[HiborPuppeteerScraper] Total scraped: ${uniqueReports.length} reports`);
    return uniqueReports;
  } catch (error) {
    console.error('[HiborPuppeteerScraper] Fatal error:', error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 辅助函数：解析日期字符串
 */
function parseDate(dateStr: string): Date {
  // 处理 "260330" 格式
  if (dateStr.match(/^\d{6}$/)) {
    const year = 2000 + parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const day = parseInt(dateStr.substring(4, 6));
    return new Date(year, month - 1, day);
  }
  
  // 处理 "2026-03-30" 格式
  return new Date(dateStr);
}

/**
 * 辅助函数：从标题提取关键词
 */
function extractKeywords(title: string): string[] {
  const keywords: string[] = [];
  
  if (title.includes('国债')) keywords.push('国债');
  if (title.includes('利率')) keywords.push('利率');
  if (title.includes('债券')) keywords.push('债券');
  if (title.includes('期货')) keywords.push('期货');
  if (title.includes('T债')) keywords.push('T债');
  if (title.includes('F债')) keywords.push('F债');
  if (title.includes('策略')) keywords.push('策略');
  if (title.includes('分析')) keywords.push('分析');
  
  return keywords.length > 0 ? keywords : ['国债期货'];
}
