## **AI Answer Engine**

An AI-powered Answer Engine built with Next.js and TypeScript that provides accurate, source-grounded responses by scraping and analyzing content from the web. The system mitigates LLM hallucinations by citing original sources for every answer, similar to tools like Perplexity.

**Features**

- Multi-Source Context Ingestion
- Source-Cited Answers
- Shareable Conversations
- Real-Time AI Chat
- Rate Limiting

**Tech Stack**
- **Frontend**: Next.js (App Router), TypeScript, React
- **Backend**: Next.js API Routes
- **AI / LLM**: Groq API
- **Web Scraping**: Cheerio, Puppeteer
- **Infrastructure**: Redis (rate limiting)

### **Challenges & Technical Solutions**
Multi-Format Data Extraction
- Abstracted scraper interface per data type
- YouTube: transcript extraction via metadata APIs
- PDFs: text extraction using PDF parsing libraries
- CSVs: schema inference and row sampling
- Images: OCR and AI-based caption extraction
- Normalized all outputs into a unified text format

**Data Visualization Generation**
- Converts extracted data into structured JSON
- Identifies numeric and temporal columns automatically
- Uses chart configuration schema (bar, line, histogram)
- Renders visualizations client-side using chart libraries
- Supports AI-generated chart descriptions

**Hierarchical Web Crawler**
- Starts from a root URL
- Extracts: Internal hyperlinks & Embedded media URLs
- Applies depth and domain constraints
- Deduplicates visited URLs using hashing
- Scrapes and indexes content recursively
- Prioritizes relevance using keyword similarity scoring

**Performance & Scalability**
- Chunk-based context injection to avoid token overflow
- Parallel scraping with request throttling
- Cached scraped results per URL
