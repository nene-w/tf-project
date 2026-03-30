import axios from 'axios';
import * as cheerio from 'cheerio';
import { ENV } from './_core/env';

/**
 * 慧博投研资讯高级爬虫
 * 支持多个版块的自动抓取
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
};

/**
 * 从指定 URL 抓取研报
 */
async function scrapeFromUrl(url: string, category: string): Promise<ResearchReport[]> {
  const reports: ResearchReport[] = [];
  
  try {
    console.log(`[HiborAdvancedScraper] Scraping ${category} from ${url}`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // 提取所有可能的研报链接
    const links = $('a[href*="repinfodetail"], a[href*="doc"], a[href*="report"]');
    
    console.log(`[HiborAdvancedScraper] Found ${links.length} potential links in ${category}`);
    
    links.each((index, element) => {
      const $link = $(element);
      const text = $link.text().trim();
      const href = $link.attr('href') || '';
      
      // 过滤出研报链接（标题长度合理，包含关键词）
      if (text.length > 8 && text.length < 200 && 
          (text.includes('债') || text.includes('期货') || text.includes('利率') || 
           text.includes('国债') || text.includes('研究') || text.includes('分析'))) {
        
        const title = text.replace(/-?\s*\d{6}$/, '').trim();
        
        if (title.length > 5) {
          // 提取日期
          const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
          const publishDate = dateMatch ? parseDate(dateMatch[1]) : new Date();
          
          // 提取来源
          const sourceMatch = title.match(/^([^-]+)-/);
          const source = sourceMatch ? sourceMatch[1].trim() : '慧博投研';
          
          // 构建完整 URL
          let fullUrl = href;
          if (!fullUrl.startsWith('http')) {
            fullUrl = new URL(href, BASE_URL).href;
          }
          
          reports.push({
            title,
            source,
            publishDate,
            url: fullUrl,
            category,
            keywords: extractKeywords(title)
          });
        }
      }
    });
    
    console.log(`[HiborAdvancedScraper] Scraped ${reports.length} reports from ${category}`);
    return reports;
  } catch (error) {
    console.error(`[HiborAdvancedScraper] Error scraping ${category}:`, error);
    return [];
  }
}

/**
 * 主爬虫函数：抓取多个版块
 */
export async function scrapeHiborMultipleSections(): Promise<ResearchReport[]> {
  try {
    // 从多个版块抓取研报
    const allReports: ResearchReport[] = [];
    
    for (const [sectionKey, sectionUrl] of Object.entries(SECTIONS)) {
      try {
        const reports = await scrapeFromUrl(sectionUrl, sectionKey);
        allReports.push(...reports);
      } catch (error) {
        console.error(`[HiborAdvancedScraper] Error scraping section ${sectionKey}:`, error);
      }
    }
    
    // 去重
    const uniqueReports = Array.from(
      new Map(allReports.map(r => [r.title, r])).values()
    );
    
    console.log(`[HiborAdvancedScraper] Total scraped: ${uniqueReports.length} reports`);
    return uniqueReports;
  } catch (error) {
    console.error('[HiborAdvancedScraper] Fatal error:', error);
    return [];
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
