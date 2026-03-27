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

// 债券研究页面 URL
const BOND_RESEARCH_URL = `${BASE_URL}/economy_3.html`;

// 期货研究页面 URL
const FUTURES_RESEARCH_URL = `${BASE_URL}/microns_8.html`;

// 国债期货搜索 URL
const TREASURY_FUTURES_SEARCH_URL = `${BASE_URL}/doceconomy/index_news.asp?S_S=%C6%DA%BB%F5%D1%D0%BE%BF&M_M=8&flag=0&liflag=7`;

/**
 * 从债券研究版块抓取研报
 */
export async function scrapeBondResearch(): Promise<ResearchReport[]> {
  try {
    const response = await axios.get(BOND_RESEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const reports: ResearchReport[] = [];

    // 从页面中提取研报列表
    // 根据慧博的页面结构，研报通常在特定的 div 中
    $('a[href*="repinfodetail"]').each((index: number, element: any) => {
      const $el = $(element);
      const title = $el.text().trim();
      const url = $el.attr('href') || '';
      const href = url.startsWith('http') ? url : `${BASE_URL}${url}`;

      // 提取发布日期（通常在标题后）
      const dateMatch = title.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
      const publishDate = dateMatch ? new Date(dateMatch[1]) : new Date();

      // 提取来源（通常是机构名称）
      const sourceMatch = title.match(/^([^-]+)-/);
      const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';

      if (title && title.length > 5) {
        reports.push({
          title: title.replace(/\s*\d{6}$/, '').trim(),
          source,
          publishDate,
          url: href,
          category: 'bond',
          keywords: ['利率债', '债券', '国债']
        });
      }
    });

    return reports;
  } catch (error) {
    console.error('[HiborScraper] Error scraping bond research:', error);
    return [];
  }
}

/**
 * 从期货研究版块抓取国债期货研报
 */
export async function scrapeTreasuryFuturesResearch(): Promise<ResearchReport[]> {
  try {
    const response = await axios.get(TREASURY_FUTURES_SEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const reports: ResearchReport[] = [];

    // 从页面中提取国债期货相关研报
    $('a[href*="repinfodetail"]').each((index: number, element: any) => {
      const $el = $(element);
      const title = $el.text().trim();
      const url = $el.attr('href') || '';
      const href = url.startsWith('http') ? url : `${BASE_URL}${url}`;

      // 检查是否是国债期货相关的研报
      if (title.includes('国债') || title.includes('期货')) {
        // 提取发布日期
        const dateMatch = title.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
        const publishDate = dateMatch ? new Date(dateMatch[1]) : new Date();

        // 提取来源
        const sourceMatch = title.match(/^([^-]+)-/);
        const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';

        if (title && title.length > 5) {
          reports.push({
            title: title.replace(/-?\s*\d{6}$/, '').trim(),
            source,
            publishDate,
            url: href,
            category: 'futures',
            keywords: ['国债期货', '期货', '交易']
          });
        }
      }
    });

    return reports;
  } catch (error) {
    console.error('[HiborScraper] Error scraping treasury futures research:', error);
    return [];
  }
}

/**
 * 从期货研究版块抓取所有期货相关研报
 */
export async function scrapeFuturesResearch(): Promise<ResearchReport[]> {
  try {
    const response = await axios.get(FUTURES_RESEARCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const reports: ResearchReport[] = [];

    // 从页面中提取研报列表
    $('a[href*="repinfodetail"]').each((index: number, element: any) => {
      const $el = $(element);
      const title = $el.text().trim();
      const url = $el.attr('href') || '';
      const href = url.startsWith('http') ? url : `${BASE_URL}${url}`;

      // 提取发布日期
      const dateMatch = title.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
      const publishDate = dateMatch ? new Date(dateMatch[1]) : new Date();

      // 提取来源
      const sourceMatch = title.match(/^([^-]+)-/);
      const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';

      if (title && title.length > 5) {
        // 判断是否是国债期货相关
        const isGovtBond = title.includes('国债') || title.includes('债券');
        
        reports.push({
          title: title.replace(/\s*\d{6}$/, '').trim(),
          source,
          publishDate,
          url: href,
          category: 'futures',
          keywords: isGovtBond ? ['国债期货', '期货', '债券'] : ['期货', '商品']
        });
      }
    });

    return reports;
  } catch (error) {
    console.error('[HiborScraper] Error scraping futures research:', error);
    return [];
  }
}

/**
 * 合并并去重研报
 */
export function mergeAndDeduplicateReports(reports: ResearchReport[]): ResearchReport[] {
  const seen = new Set<string>();
  const unique: ResearchReport[] = [];

  for (const report of reports) {
    // 使用标题作为去重键
    if (!seen.has(report.title)) {
      seen.add(report.title);
      unique.push(report);
    }
  }

  // 按发布日期倒序排列
  return unique.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());
}

/**
 * 抓取所有研报（债券 + 期货）
 */
export async function scrapeAllResearch(): Promise<ResearchReport[]> {
  try {
    const [bondReports, futuresReports] = await Promise.all([
      scrapeBondResearch(),
      scrapeFuturesResearch()
    ]);

    // 过滤出国债期货相关的期货研报
    const govtBondFuturesReports = futuresReports.filter(
      r => r.title.includes('国债') || r.title.includes('债券')
    );

    // 合并所有研报
    const allReports = [...bondReports, ...govtBondFuturesReports];

    // 去重并排序
    return mergeAndDeduplicateReports(allReports);
  } catch (error) {
    console.error('[HiborScraper] Error scraping all research:', error);
    return [];
  }
}
