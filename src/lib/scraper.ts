// src/lib/scraper.ts
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

export interface ScrapedContent {
  title: string;
  mainContent: string;
  paragraphs?: string[];
  url: string;
  wordCount?: number;
  scrapedWith?: 'cheerio' | 'puppeteer';
}

export function isContentValid(content: any): boolean {
  return (
    content &&
    content.mainContent &&
    typeof content.mainContent === 'string' &&
    content.mainContent.length > 100
  );
}


export async function scrapeWebsite(url: string): Promise<ScrapedContent> {
  // Validate URL
  try {
    new URL(url);
  } catch {
    throw new Error('Invalid URL provided');
  }

  try {
    console.log('Attempting to scrape with Cheerio...');
    const content = await scrapeWithCheerio(url);

    if (isContentValid(content)) {
      console.log('Successfully scraped with Cheerio');
      return { ...content, scrapedWith: 'cheerio' };
    }

    console.log('Cheerio result insufficient, trying Puppeteer...');
  } catch (error) {
    console.log('Cheerio failed:', error);
  }

  // Fallback to Puppeteer for dynamic content
  console.log('Attempting to scrape with Puppeteer...');
  const content = await scrapeWithPuppeteer(url);
  return { ...content, scrapedWith: 'puppeteer' };
}


export async function scrapeWithCheerio(url: string): Promise<ScrapedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside').remove();

    // Extract title
    const title = $('title').text().trim() ||
      $('h1').first().text().trim() ||
      'Untitled';

    // Try multiple content selectors
    let mainContent = '';
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content',
      '.entry-content',
      '#content',
    ];

    for (const selector of contentSelectors) {
      const content = $(selector).text().trim();
      if (content.length > mainContent.length) {
        mainContent = content;
      }
    }

    // Fallback to body
    if (!mainContent || mainContent.length < 100) {
      mainContent = $('body').text().trim();
    }

    // Extract paragraphs
    const paragraphs = $('p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(p => p.length > 30);

    // Clean whitespace
    mainContent = mainContent.replace(/\s+/g, ' ').trim();

    return {
      title,
      mainContent: mainContent.slice(0, 10000), // Limit to 10k chars
      paragraphs: paragraphs.slice(0, 20),
      url,
      wordCount: mainContent.split(/\s+/).length,
    };
  } catch (error: any) {
    console.error('Cheerio scraping error:', error);
    throw new Error(`Cheerio scraping failed: ${error.message}`);
  }
}

export async function scrapeWithPuppeteer(url: string): Promise<ScrapedContent> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    // Navigate with timeout
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for content to render
    // await page.waitForTimeout(2000);

    // Extract content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const unwanted = document.querySelectorAll(
        'script, style, nav, header, footer, aside'
      );
      unwanted.forEach(el => el.remove());

      const title = document.title ||
        document.querySelector('h1')?.textContent ||
        'Untitled';

      // Try to find main content
      const mainSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.post-content',
      ];

      let mainContent = '';
      for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element?.textContent) {
          const text = element.textContent.trim();
          if (text.length > mainContent.length) {
            mainContent = text;
          }
        }
      }

      // Fallback to body
      if (!mainContent || mainContent.length < 100) {
        mainContent = document.body.textContent || '';
      }

      // Extract paragraphs
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.textContent?.trim() || '')
        .filter(p => p.length > 30);

      return {
        title: title.trim(),
        mainContent: mainContent.replace(/\s+/g, ' ').trim(),
        paragraphs: paragraphs.slice(0, 20),
      };
    });

    return {
      ...content,
      mainContent: content.mainContent.slice(0, 10000),
      url,
      wordCount: content.mainContent.split(/\s+/).length,
    };
  } catch (error: any) {
    console.error('Puppeteer scraping error:', error);
    throw new Error(`Puppeteer scraping failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}