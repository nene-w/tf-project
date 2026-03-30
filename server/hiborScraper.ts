import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * 从慧博投研资讯平台抓取研报
 * 支持债券研究和期货研究版块
 */

export interface ResearchReport {
  title: string;
  summary?: string;
  source: string;
  author?: string;
  publishDate: Date;
  url: string;
  category: 'bond' | 'futures';
  keywords: string[];
}

const BASE_URL = 'https://www.hibor.com.cn';

// 期货研究页面 URL
const FUTURES_RESEARCH_URL = `${BASE_URL}/microns_8.html`;

/**
 * 从期货研究版块抓取所有期货相关研报
 * 重点关注国债期货、利率债相关内容
 */
export async function scrapeFuturesResearch(): Promise<ResearchReport[]> {
  try {
    const response = await axios.get(FUTURES_RESEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const reports: ResearchReport[] = [];

    // 慧博的研报列表结构：每个研报是一个 table 行或 div 块
    // 标题通常在第一个 <a> 标签中
    // 日期在 "2026-03-30" 格式的文本中
    
    // 方案1：查找所有包含研报标题的 <a> 标签
    // 从网页结构看，研报标题在 <a> 标签中，且 href 包含报告 ID
    const titleLinks = $('a[href*="report"]').filter((i, el) => {
      const text = $(el).text().trim();
      return text.length > 5 && !text.includes('首页') && !text.includes('详细');
    });

    // 方案2：直接从页面的表格结构提取
    // 查找所有 <table> 或 <div> 中的研报信息
    $('table tbody tr, div.report-item').each((index: number, element: any) => {
      const $row = $(element);
      
      // 获取标题
      const titleEl = $row.find('a').first();
      const title = titleEl.text().trim();
      const url = titleEl.attr('href') || '';
      
      if (!title || title.length < 5) return;
      
      // 获取完整 URL
      const href = url.startsWith('http') ? url : `${BASE_URL}${url}`;
      
      // 获取日期（查找 "2026-03-30" 格式）
      const rowText = $row.text();
      const dateMatch = rowText.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
      const publishDate = dateMatch ? parseDate(dateMatch[1]) : new Date();
      
      // 获取作者信息
      const authorText = $row.text();
      const authorMatch = authorText.match(/作者[：:]\s*([^分]+)/);
      const author = authorMatch ? authorMatch[1].trim() : undefined;
      
      // 获取摘要
      const summary = $row.find('.summary, .abstract').text().trim() || undefined;
      
      // 提取来源（通常是机构名称，在标题的第一个 "-" 前）
      const sourceMatch = title.match(/^([^-]+)-/);
      const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';
      
      // 判断是否是国债/利率债相关的报告
      const isRelevant = title.includes('国债') || 
                        title.includes('利率') || 
                        title.includes('债券') ||
                        title.includes('期货') ||
                        title.includes('T') ||
                        title.includes('TF');
      
      if (isRelevant && title.length > 5) {
        reports.push({
          title: title.replace(/-?\s*\d{6}$/, '').trim(),
          summary,
          source,
          author,
          publishDate,
          url: href,
          category: 'futures',
          keywords: extractKeywords(title)
        });
      }
    });

    // 如果上面的方法没有找到结果，尝试备用方法
    if (reports.length === 0) {
      // 备用方法：查找所有 <a> 标签，过滤出研报
      $('a').each((index: number, element: any) => {
        const $el = $(element);
        const title = $el.text().trim();
        const url = $el.attr('href') || '';
        
        // 过滤条件：标题长度合理，包含日期或机构名称
        if (title.length > 10 && title.length < 200 && 
            (title.match(/\d{6}$/) || title.includes('-'))) {
          
          const href = url.startsWith('http') ? url : `${BASE_URL}${url}`;
          
          // 获取日期
          const dateMatch = title.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
          const publishDate = dateMatch ? parseDate(dateMatch[1]) : new Date();
          
          // 获取来源
          const sourceMatch = title.match(/^([^-]+)-/);
          const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';
          
          // 判断是否相关
          const isRelevant = title.includes('国债') || 
                            title.includes('利率') || 
                            title.includes('债券') ||
                            title.includes('期货') ||
                            title.includes('T') ||
                            title.includes('TF');
          
          if (isRelevant) {
            reports.push({
              title: title.replace(/-?\s*\d{6}$/, '').trim(),
              source,
              publishDate,
              url: href,
              category: 'futures',
              keywords: extractKeywords(title)
            });
          }
        }
      });
    }

    // 去重
    const uniqueReports = Array.from(
      new Map(reports.map(r => [r.title, r])).values()
    );

    console.log(`[HiborScraper] Successfully scraped ${uniqueReports.length} futures research reports`);
    return uniqueReports;
  } catch (error) {
    console.error('[HiborScraper] Error scraping futures research:', error);
    return [];
  }
}

/**
 * 从债券研究版块抓取研报
 */
export async function scrapeBondResearch(): Promise<ResearchReport[]> {
  try {
    const BOND_RESEARCH_URL = `${BASE_URL}/economy_3.html`;
    
    const response = await axios.get(BOND_RESEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const reports: ResearchReport[] = [];

    // 使用相同的逻辑提取债券研究报告
    $('a').each((index: number, element: any) => {
      const $el = $(element);
      const title = $el.text().trim();
      const url = $el.attr('href') || '';
      
      if (title.length > 10 && title.length < 200 && 
          (title.match(/\d{6}$/) || title.includes('-'))) {
        
        const href = url.startsWith('http') ? url : `${BASE_URL}${url}`;
        
        const dateMatch = title.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
        const publishDate = dateMatch ? parseDate(dateMatch[1]) : new Date();
        
        const sourceMatch = title.match(/^([^-]+)-/);
        const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';
        
        const isRelevant = title.includes('利率') || 
                          title.includes('债券') ||
                          title.includes('国债');
        
        if (isRelevant) {
          reports.push({
            title: title.replace(/-?\s*\d{6}$/, '').trim(),
            source,
            publishDate,
            url: href,
            category: 'bond',
            keywords: extractKeywords(title)
          });
        }
      }
    });

    // 去重
    const uniqueReports = Array.from(
      new Map(reports.map(r => [r.title, r])).values()
    );

    console.log(`[HiborScraper] Successfully scraped ${uniqueReports.length} bond research reports`);
    return uniqueReports;
  } catch (error) {
    console.error('[HiborScraper] Error scraping bond research:', error);
    return [];
  }
}

/**
 * 聚合爬取债券和期货研报
 */
export async function scrapeHibor(): Promise<ResearchReport[]> {
  try {
    const [futuresReports, bondReports] = await Promise.all([
      scrapeFuturesResearch(),
      scrapeBondResearch()
    ]);
    
    // 合并并去重
    const allReports = [...futuresReports, ...bondReports];
    const uniqueReports = Array.from(
      new Map(allReports.map(r => [r.title, r])).values()
    );
    
    console.log(`[HiborScraper] Total scraped: ${uniqueReports.length} reports`);
    return uniqueReports;
  } catch (error) {
    console.error('[HiborScraper] Error in scrapeHibor:', error);
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
  if (title.includes('T')) keywords.push('T债');
  if (title.includes('TF')) keywords.push('TF');
  if (title.includes('TS')) keywords.push('TS');
  if (title.includes('基差')) keywords.push('基差');
  if (title.includes('收益率')) keywords.push('收益率');
  
  return keywords.length > 0 ? keywords : ['期货', '债券'];
}
