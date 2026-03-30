import { ENV } from './_core/env';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * 慧博投研资讯爬虫（优化版 v2）
 * 专注于债券研究版块，重点抓取利率债和国债期货相关研报
 * 排除商品期货（黄金、原油、农产品等）
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

// 目标关键词：只抓取包含这些关键词的研报
const TARGET_KEYWORDS = [
  '国债', '利率债', '债券', 'T债', 'F债',
  '利率', '收益率', '曲线', '配置', '交易',
  '策略', '分析', '展望', '观点', '建议'
];

// 排除关键词：过滤掉不相关的研报
const EXCLUDE_KEYWORDS = [
  '股票', '股权', '基金', '房地产', '消费', '医药',
  '科技', '互联网', '电商', '教育', '游戏',
  // 商品期货排除
  '黄金', '原油', '煤炭', '铁矿', '铜', '铝',
  '玉米', '大豆', '棉花', '糖', '农产品',
  '能源', '有色', '化工', '贵金属',
  // 其他期货排除
  '股指', '沪深', 'IF', 'IC', 'IH', 'T', 'TF'
];

/**
 * 检查标题是否包含目标关键词且不包含排除关键词
 */
function isRelevantReport(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  
  // 检查排除关键词
  for (const keyword of EXCLUDE_KEYWORDS) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      return false;
    }
  }
  
  // 检查包含目标关键词
  for (const keyword of TARGET_KEYWORDS) {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * 从债券研究版块抓取研报
 */
async function scrapeBondResearch(): Promise<ResearchReport[]> {
  const reports: ResearchReport[] = [];
  
  try {
    console.log('[HiborScraper] Scraping bond research section (economy_3.html)...');
    
    const url = `${BASE_URL}/economy_3.html`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // 方案1：查找所有链接
    const links = $('a[href*="repinfodetail"], a[href*="report"], a[href*="research"]');
    
    if (links.length === 0) {
      console.log('[HiborScraper] No links found with specific selectors, trying generic links...');
      
      // 方案2：查找所有链接
      $('a').each((index, element) => {
        const $link = $(element);
        const title = $link.text().trim();
        const href = $link.attr('href') || '';
        
        // 过滤有效的研报
        if (title.length > 5 && title.length < 200 && href.length > 0 && isRelevantReport(title)) {
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          
          reports.push({
            title: title.replace(/\s+/g, ' '),
            source: '慧博投研 - 债券研究',
            publishDate: new Date(),
            url: fullUrl,
            category: 'bond',
            keywords: extractKeywords(title)
          });
        }
      });
    } else {
      // 处理特定选择器找到的链接
      links.each((index, element) => {
        const $link = $(element);
        const title = $link.text().trim();
        const href = $link.attr('href') || '';
        
        if (title.length > 5 && title.length < 200 && isRelevantReport(title)) {
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          
          reports.push({
            title: title.replace(/\s+/g, ' '),
            source: '慧博投研 - 债券研究',
            publishDate: new Date(),
            url: fullUrl,
            category: 'bond',
            keywords: extractKeywords(title)
          });
        }
      });
    }
    
    console.log(`[HiborScraper] Found ${reports.length} relevant bond research reports`);
    return reports;
  } catch (error) {
    console.error('[HiborScraper] Error scraping bond research:', error);
    return [];
  }
}

/**
 * 主爬虫函数：专注于债券研究版块
 */
export async function scrapeHiborWithPuppeteer(): Promise<ResearchReport[]> {
  try {
    console.log('[HiborScraper] Starting optimized bond research scraper...');
    
    // 只抓取债券研究版块
    const bondReports = await scrapeBondResearch();
    
    // 去重
    const uniqueReports = Array.from(
      new Map(bondReports.map(r => [r.title, r])).values()
    );
    
    console.log(`[HiborScraper] Total scraped: ${uniqueReports.length} bond research reports`);
    return uniqueReports;
  } catch (error) {
    console.error('[HiborScraper] Fatal error:', error);
    return [];
  }
}

/**
 * 辅助函数：从标题提取关键词
 */
function extractKeywords(title: string): string[] {
  const keywords: string[] = [];
  
  if (title.includes('国债')) keywords.push('国债');
  if (title.includes('利率')) keywords.push('利率');
  if (title.includes('债券')) keywords.push('债券');
  if (title.includes('利率债')) keywords.push('利率债');
  if (title.includes('T债')) keywords.push('T债');
  if (title.includes('F债')) keywords.push('F债');
  if (title.includes('策略')) keywords.push('策略');
  if (title.includes('收益率')) keywords.push('收益率');
  if (title.includes('曲线')) keywords.push('曲线');
  if (title.includes('配置')) keywords.push('配置');
  
  return keywords.length > 0 ? keywords : ['债券研究'];
}
