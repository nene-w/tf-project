import { ENV } from './_core/env';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * 慧博投研资讯爬虫（优化版）
 * 专注于债券、宏观、利率债、国债期货相关的研报
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

// 关键词过滤：只抓取包含这些关键词的研报
const KEYWORDS = [
  '国债', '利率债', '期货', '债券', 'T债', 'F债',
  '利率', '宏观', '经济', '央行', '流动性',
  '收益率', '曲线', '策略', '配置', '交易'
];

// 排除关键词：过滤掉不相关的研报
const EXCLUDE_KEYWORDS = [
  '股票', '股权', '基金', '房地产', '消费', '医药',
  '科技', '互联网', '电商', '教育', '游戏'
];

/**
 * 检查标题是否包含目标关键词
 */
function isRelevantReport(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  
  // 检查排除关键词
  for (const keyword of EXCLUDE_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      return false;
    }
  }
  
  // 检查包含关键词
  for (const keyword of KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 从债券研究版块抓取研报
 */
async function scrapeBondSection(): Promise<ResearchReport[]> {
  const reports: ResearchReport[] = [];
  
  try {
    console.log('[HiborPuppeteerScraper] Scraping bond research section...');
    
    const url = `${BASE_URL}/economy_3.html`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // 查找所有可能的研报链接
    const links = $('a');
    
    links.each((index, element) => {
      const $link = $(element);
      const title = $link.text().trim();
      const href = $link.attr('href') || '';
      
      // 过滤有效的研报
      if (title.length > 5 && title.length < 150 && isRelevantReport(title)) {
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
    
    console.log(`[HiborPuppeteerScraper] Found ${reports.length} bond reports`);
    return reports;
  } catch (error) {
    console.error('[HiborPuppeteerScraper] Error scraping bond section:', error);
    return [];
  }
}

/**
 * 从宏观经济版块抓取研报
 */
async function scrapeMacroSection(): Promise<ResearchReport[]> {
  const reports: ResearchReport[] = [];
  
  try {
    console.log('[HiborPuppeteerScraper] Scraping macro economy section...');
    
    const url = `${BASE_URL}/economy_1.html`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // 查找所有可能的研报链接
    const links = $('a');
    
    links.each((index, element) => {
      const $link = $(element);
      const title = $link.text().trim();
      const href = $link.attr('href') || '';
      
      // 过滤有效的研报
      if (title.length > 5 && title.length < 150 && isRelevantReport(title)) {
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        
        reports.push({
          title: title.replace(/\s+/g, ' '),
          source: '慧博投研 - 宏观经济',
          publishDate: new Date(),
          url: fullUrl,
          category: 'macro',
          keywords: extractKeywords(title)
        });
      }
    });
    
    console.log(`[HiborPuppeteerScraper] Found ${reports.length} macro reports`);
    return reports;
  } catch (error) {
    console.error('[HiborPuppeteerScraper] Error scraping macro section:', error);
    return [];
  }
}

/**
 * 从期货研究版块抓取研报
 */
async function scrapeFuturesSection(): Promise<ResearchReport[]> {
  const reports: ResearchReport[] = [];
  
  try {
    console.log('[HiborPuppeteerScraper] Scraping futures research section...');
    
    const url = `${BASE_URL}/microns_8.html`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // 查找所有可能的研报链接
    const links = $('a');
    
    links.each((index, element) => {
      const $link = $(element);
      const title = $link.text().trim();
      const href = $link.attr('href') || '';
      
      // 过滤有效的研报
      if (title.length > 5 && title.length < 150 && isRelevantReport(title)) {
        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        
        reports.push({
          title: title.replace(/\s+/g, ' '),
          source: '慧博投研 - 期货研究',
          publishDate: new Date(),
          url: fullUrl,
          category: 'futures',
          keywords: extractKeywords(title)
        });
      }
    });
    
    console.log(`[HiborPuppeteerScraper] Found ${reports.length} futures reports`);
    return reports;
  } catch (error) {
    console.error('[HiborPuppeteerScraper] Error scraping futures section:', error);
    return [];
  }
}

/**
 * 主爬虫函数：抓取债券、宏观、期货相关的研报
 */
export async function scrapeHiborWithPuppeteer(): Promise<ResearchReport[]> {
  try {
    console.log('[HiborPuppeteerScraper] Starting optimized scraper...');
    
    // 并行抓取多个版块
    const [bondReports, macroReports, futuresReports] = await Promise.all([
      scrapeBondSection(),
      scrapeMacroSection(),
      scrapeFuturesSection()
    ]);
    
    // 合并所有报告
    const allReports = [...bondReports, ...macroReports, ...futuresReports];
    
    // 去重
    const uniqueReports = Array.from(
      new Map(allReports.map(r => [r.title, r])).values()
    );
    
    console.log(`[HiborPuppeteerScraper] Total scraped: ${uniqueReports.length} reports`);
    return uniqueReports;
  } catch (error) {
    console.error('[HiborPuppeteerScraper] Fatal error:', error);
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
  if (title.includes('期货')) keywords.push('期货');
  if (title.includes('T债')) keywords.push('T债');
  if (title.includes('F债')) keywords.push('F债');
  if (title.includes('利率债')) keywords.push('利率债');
  if (title.includes('策略')) keywords.push('策略');
  if (title.includes('宏观')) keywords.push('宏观');
  if (title.includes('央行')) keywords.push('央行');
  
  return keywords.length > 0 ? keywords : ['国债期货'];
}
