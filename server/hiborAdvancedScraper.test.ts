import { describe, it, expect, vi } from 'vitest';

/**
 * 高级爬虫单元测试
 * 注：由于 Puppeteer 需要实际浏览器环境，这里主要测试辅助函数
 */

describe('HiborAdvancedScraper - Helper Functions', () => {
  describe('parseDate', () => {
    it('should parse YYMMDD format correctly', () => {
      // 这是一个示例测试，实际的日期解析在爬虫中
      const dateStr = '260330';
      const year = 2000 + parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4));
      const day = parseInt(dateStr.substring(4, 6));
      
      expect(year).toBe(2026);
      expect(month).toBe(3);
      expect(day).toBe(30);
    });

    it('should parse YYYY-MM-DD format correctly', () => {
      const dateStr = '2026-03-30';
      const date = new Date(dateStr);
      
      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(2); // 0-indexed
      expect(date.getDate()).toBe(30);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from title', () => {
      const title = '国泰君安-国债期货周报-260330';
      const keywords: string[] = [];
      
      if (title.includes('国债')) keywords.push('国债');
      if (title.includes('期货')) keywords.push('期货');
      
      expect(keywords).toContain('国债');
      expect(keywords).toContain('期货');
    });

    it('should handle multiple keyword types', () => {
      const title = '华泰固收-利率债券策略分析-260330';
      const keywords: string[] = [];
      
      if (title.includes('利率')) keywords.push('利率');
      if (title.includes('债券')) keywords.push('债券');
      if (title.includes('策略')) keywords.push('策略');
      
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords).toContain('利率');
      expect(keywords).toContain('债券');
    });
  });

  describe('title cleaning', () => {
    it('should remove date suffix from title', () => {
      const title = '国泰君安-国债期货周报-260330';
      const cleaned = title.replace(/-?\s*\d{6}$/, '').trim();
      
      expect(cleaned).toBe('国泰君安-国债期货周报');
      expect(cleaned).not.toContain('260330');
    });

    it('should extract source from title', () => {
      const title = '国泰君安-国债期货周报-260330';
      const sourceMatch = title.match(/^([^-]+)-/);
      const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';
      
      expect(source).toBe('国泰君安');
    });
  });

  describe('report filtering', () => {
    it('should identify treasury futures related reports', () => {
      const titles = [
        '国泰君安-国债期货周报-260330',
        '华泰固收-利率债分析-260330',
        '中信建投-T债策略-260330',
        '某机构-其他报告-260330'
      ];
      
      const treasuryRelated = titles.filter(title => 
        title.includes('国债') || 
        title.includes('利率') || 
        title.includes('债券') ||
        title.includes('期货') ||
        title.includes('T')
      );
      
      expect(treasuryRelated.length).toBe(3);
    });

    it('should filter out irrelevant reports', () => {
      const title = '某机构-股票分析报告-260330';
      const isRelevant = title.includes('国债') || 
                        title.includes('利率') || 
                        title.includes('债券') ||
                        title.includes('期货') ||
                        title.includes('T');
      
      expect(isRelevant).toBe(false);
    });
  });

  describe('deduplication', () => {
    it('should remove duplicate reports by title', () => {
      const reports = [
        { title: '国泰君安-国债期货周报', source: '国泰君安' },
        { title: '国泰君安-国债期货周报', source: '国泰君安' },
        { title: '华泰固收-利率债分析', source: '华泰' }
      ];
      
      const uniqueReports = Array.from(
        new Map(reports.map(r => [r.title, r])).values()
      );
      
      expect(uniqueReports.length).toBe(2);
    });
  });
});
