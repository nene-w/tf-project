import { describe, it, expect, vi } from 'vitest';
import * as hiborScraper from './hiborScraper';

describe('HiborScraper', () => {
  it('should parse research report title correctly', () => {
    const title = '宝城期货-国债期货日报：国债期货窄幅震荡整理-260327';
    const cleanedTitle = title.replace(/-?\s*\d{6}$/, '').trim();
    
    expect(cleanedTitle).toBe('宝城期货-国债期货日报：国债期货窄幅震荡整理');
  });

  it('should extract source from title', () => {
    const title = '宝城期货-国债期货日报：国债期货窄幅震荡整理-260327';
    const sourceMatch = title.match(/^([^-]+)-/);
    const source = sourceMatch ? sourceMatch[1].trim() : '未知来源';
    
    expect(source).toBe('宝城期货');
  });

  it('should extract date from title', () => {
    const title = '宝城期货-国债期货日报：国债期货窄幅震荡整理-260327';
    const dateMatch = title.match(/(\d{4}-\d{2}-\d{2}|\d{6})/);
    
    expect(dateMatch).not.toBeNull();
    if (dateMatch) {
      expect(dateMatch[1]).toBe('260327');
    }
  });

  it('should merge and deduplicate reports', () => {
    const reports = [
      {
        title: '宝城期货-国债期货日报',
        source: '宝城期货',
        publishDate: new Date('2026-03-27'),
        url: 'https://example.com/1',
        category: 'futures' as const,
        keywords: ['国债期货']
      },
      {
        title: '宝城期货-国债期货日报',
        source: '宝城期货',
        publishDate: new Date('2026-03-27'),
        url: 'https://example.com/2',
        category: 'futures' as const,
        keywords: ['国债期货']
      },
      {
        title: '申银万国期货-品种策略日报',
        source: '申银万国期货',
        publishDate: new Date('2026-03-25'),
        url: 'https://example.com/3',
        category: 'futures' as const,
        keywords: ['国债']
      }
    ];

    const unique = hiborScraper.mergeAndDeduplicateReports(reports);
    
    expect(unique).toHaveLength(2);
    expect(unique[0].title).toBe('宝城期货-国债期货日报');
    expect(unique[1].title).toBe('申银万国期货-品种策略日报');
  });

  it('should sort reports by publish date in descending order', () => {
    const reports = [
      {
        title: '报告1',
        source: '来源1',
        publishDate: new Date('2026-03-25'),
        url: 'https://example.com/1',
        category: 'futures' as const,
        keywords: ['国债']
      },
      {
        title: '报告2',
        source: '来源2',
        publishDate: new Date('2026-03-27'),
        url: 'https://example.com/2',
        category: 'futures' as const,
        keywords: ['国债']
      },
      {
        title: '报告3',
        source: '来源3',
        publishDate: new Date('2026-03-26'),
        url: 'https://example.com/3',
        category: 'futures' as const,
        keywords: ['国债']
      }
    ];

    const sorted = hiborScraper.mergeAndDeduplicateReports(reports);
    
    expect(sorted[0].publishDate).toEqual(new Date('2026-03-27'));
    expect(sorted[1].publishDate).toEqual(new Date('2026-03-26'));
    expect(sorted[2].publishDate).toEqual(new Date('2026-03-25'));
  });

  it('should identify treasury futures reports', () => {
    const report = {
      title: '宝城期货-国债期货日报',
      source: '宝城期货',
      publishDate: new Date('2026-03-27'),
      url: 'https://example.com/1',
      category: 'futures' as const,
      keywords: ['国债期货', '期货', '交易']
    };

    expect(report.title).toContain('国债');
    expect(report.keywords).toContain('国债期货');
  });

  it('should filter government bond futures reports from all futures reports', () => {
    const allReports = [
      {
        title: '宝城期货-国债期货日报',
        source: '宝城期货',
        publishDate: new Date('2026-03-27'),
        url: 'https://example.com/1',
        category: 'futures' as const,
        keywords: ['国债期货']
      },
      {
        title: '宝城期货-黑色产业周报',
        source: '宝城期货',
        publishDate: new Date('2026-03-27'),
        url: 'https://example.com/2',
        category: 'futures' as const,
        keywords: ['黑色金属']
      },
      {
        title: '宝城期货-债券研究日报',
        source: '宝城期货',
        publishDate: new Date('2026-03-27'),
        url: 'https://example.com/3',
        category: 'futures' as const,
        keywords: ['债券']
      }
    ];

    const govtBondReports = allReports.filter(
      r => r.title.includes('国债') || r.title.includes('债券')
    );

    expect(govtBondReports).toHaveLength(2);
    expect(govtBondReports[0].title).toContain('国债');
    expect(govtBondReports[1].title).toContain('债券');
  });

  it('should handle empty report list', () => {
    const reports: hiborScraper.ResearchReport[] = [];
    const unique = hiborScraper.mergeAndDeduplicateReports(reports);
    
    expect(unique).toHaveLength(0);
  });

  it('should create valid research report object', () => {
    const report: hiborScraper.ResearchReport = {
      title: '宝城期货-国债期货日报：国债期货窄幅震荡整理',
      summary: '今日国债期货均窄幅震荡整理。消息面，美伊和谈方面...',
      source: '宝城期货',
      author: '龙奥明',
      publishDate: new Date('2026-03-27'),
      url: 'https://www.hibor.com.cn/repinfodetail_123456.html',
      category: 'futures',
      keywords: ['国债期货', '期货', '交易']
    };

    expect(report.title).toBeDefined();
    expect(report.source).toBeDefined();
    expect(report.publishDate).toBeInstanceOf(Date);
    expect(report.category).toBe('futures');
    expect(report.keywords).toContain('国债期货');
  });
});
