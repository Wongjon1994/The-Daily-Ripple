# Ripple Dashboard MVP 1: User-Driven Brief Upload System

## Executive Summary

**Pivot from n8n automation to user-driven uploads.** Subscribers upload daily briefs (HTML/documents) → System extracts and maps data intelligently → Archive builds over time → Users analyze trends and ask deep questions via chatbot.

**Scale**: 20 users, 5-10 briefs/subscriber/month = ~1000-2000 briefs/year  
**Cost**: ~$50-150/month (LLM + storage)  
**Timeline**: 4-6 weeks for MVP 1

---

## Architecture Overview

```
User Upload Flow:
  Subscriber uploads brief (HTML/document)
    ↓
  Auto-extract text (no preview needed)
    ↓
  Claude LLM: Intelligent data extraction
    ├─ Parse 8 sections
    ├─ Extract signals (e.g., "$14B ↓", "Multiple → Zero")
    ├─ Identify themes (oil, Taiwan, geopolitics, etc.)
    └─ Map Singapore lens
    ↓
  Store in database:
    ├─ Brief record (date, content, signals)
    ├─ Theme tags (auto-detected)
    └─ Embeddings for semantic search
    ↓
  Archive Dashboard:
    ├─ Timeline view of all uploaded briefs
    ├─ Trend analysis (theme frequency, narrative shifts)
    └─ Visual charts (oil mentions over time, STI sentiment, etc.)
    ↓
  Chatbot (with extended thinking):
    ├─ "How has the oil narrative shifted?"
    ├─ "What's the Taiwan risk trajectory?"
    └─ "Compare geopolitics across Q1 vs Q2"
```

---

## Database Schema

### New Tables

#### 1. `user_briefs`
```sql
CREATE TABLE user_briefs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  date_slug VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  source_url TEXT,
  raw_content LONGTEXT,
  extracted_content LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date_slug),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 2. `brief_sections`
```sql
CREATE TABLE brief_sections (
  id SERIAL PRIMARY KEY,
  brief_id INT NOT NULL,
  section_number INT,
  title VARCHAR(255),
  content LONGTEXT,
  category VARCHAR(100),
  singapore_lens TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brief_id) REFERENCES user_briefs(id) ON DELETE CASCADE
);
```

#### 3. `brief_signals`
```sql
CREATE TABLE brief_signals (
  id SERIAL PRIMARY KEY,
  brief_id INT NOT NULL,
  section_id INT,
  label VARCHAR(255),
  value VARCHAR(255),
  trend VARCHAR(50), -- "up", "down", "stable", "up_to_down", etc.
  confidence FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brief_id) REFERENCES user_briefs(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES brief_sections(id) ON DELETE CASCADE
);
```

#### 4. `brief_themes`
```sql
CREATE TABLE brief_themes (
  id SERIAL PRIMARY KEY,
  brief_id INT NOT NULL,
  theme_name VARCHAR(100),
  confidence FLOAT,
  mentions INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brief_id) REFERENCES user_briefs(id) ON DELETE CASCADE,
  INDEX(theme_name, brief_id)
);
```

#### 5. `brief_embeddings`
```sql
CREATE TABLE brief_embeddings (
  id SERIAL PRIMARY KEY,
  brief_id INT NOT NULL,
  section_id INT,
  embedding LONGTEXT, -- JSON array of floats (1536-dim for OpenAI)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brief_id) REFERENCES user_briefs(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES brief_sections(id) ON DELETE CASCADE
);
```

#### 6. `archive_cache`
```sql
CREATE TABLE archive_cache (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  cache_key VARCHAR(255),
  cache_data LONGTEXT, -- JSON: theme trends, signal history, etc.
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX(user_id, cache_key)
);
```

---

## Feature Breakdown

### Phase 1: Brief Upload & Extraction

**User Interface**:
- New tab: "Upload Brief"
- Input: HTML link OR document upload (PDF, DOCX, TXT)
- Auto-extract text (no preview)
- Submit → Processing indicator → Success/error notification

**Backend**:
1. **Document Parsing**
   - HTML: Use cheerio to extract text
   - PDF: Use pdf-parse or similar
   - DOCX: Use docx-parser
   - TXT: Direct use

2. **LLM Extraction** (Claude)
   - Input: Raw text from document
   - Prompt: Use existing system prompt (8 sections, Singapore lens, signals)
   - Output: Structured JSON with sections, signals, themes
   - Cost: ~$0.05-0.10 per brief (input tokens: 2000-5000, output: 1000-2000)

3. **Data Storage**
   - Store raw content + extracted structured data
   - Generate embeddings for semantic search
   - Tag with auto-detected themes

### Phase 2: Archive Dashboard

**User Interface**:
- New tab: "Archive & Trends"
- Timeline: All uploaded briefs by date
- Charts:
  - Theme frequency over time (oil, Taiwan, geopolitics, etc.)
  - Signal trends (e.g., oil price direction, STI sentiment)
  - Narrative shifts (e.g., "Taiwan mentions: High → Low → High")
- Filter by theme, date range

**Backend**:
1. **Theme Detection**
   - Extract themes from each brief during LLM processing
   - Store in `brief_themes` table
   - Aggregate for dashboard

2. **Trend Analysis**
   - Query theme frequency by date range
   - Calculate narrative shifts (compare consecutive briefs)
   - Generate time-series data for charts

3. **Caching**
   - Cache trend data in `archive_cache` for performance
   - Invalidate on new brief upload

### Phase 3: Chatbot with Extended Thinking

**User Interface**:
- Chat box in archive tab
- Questions like:
  - "How has the oil narrative shifted over the past 3 months?"
  - "What's the Taiwan risk trajectory?"
  - "Compare geopolitics across Q1 vs Q2"

**Backend**:
1. **Context Retrieval**
   - User asks question
   - Retrieve relevant briefs using semantic search (embeddings)
   - Fetch theme trends, signal history

2. **Extended Thinking**
   - Use Claude with `extended_thinking` mode
   - Budget: 5000-10000 tokens for thinking
   - Input context: Relevant briefs + trend data
   - Output: Deep analysis with reasoning

3. **Cost**
   - Extended thinking: ~$0.15-0.30 per query (vs. $0.01 for regular)
   - Expected: 5-10 queries/user/month = $7.50-30/month for chatbot

---

## Data Flow: Upload to Archive

```
1. User uploads brief (HTML link or document)
   ↓
2. Extract text via document parser
   ↓
3. Call Claude with extraction prompt
   ├─ Input: Raw text
   └─ Output: { sections: [...], signals: [...], themes: [...] }
   ↓
4. Store in database:
   ├─ user_briefs (raw + extracted content)
   ├─ brief_sections (8 sections)
   ├─ brief_signals (extracted signals)
   ├─ brief_themes (auto-detected themes)
   └─ brief_embeddings (semantic search)
   ↓
5. Invalidate archive cache
   ↓
6. Archive dashboard auto-updates with new trends
```

---

## Cost Breakdown

### Monthly Costs (Estimated)

| Component | Usage | Cost |
|-----------|-------|------|
| **LLM - Brief Extraction** | 100-200 briefs/month × $0.075 avg | $7.50-15 |
| **LLM - Embeddings** | 100-200 briefs × 8 sections × $0.02/1K tokens | $1-2 |
| **LLM - Chatbot (extended thinking)** | 50 queries/month × $0.20 avg | $10 |
| **Database Storage** | 1000-2000 briefs + embeddings (~500MB) | $5-10 |
| **File Storage (S3)** | Documents + cache (~100MB) | $2-3 |
| **Compute (Manus)** | Included in Manus hosting | $0 |
| **Total** | | **$25-40/month** |

**Peak scenario** (200 briefs/month + 100 chatbot queries): ~$50-60/month

### One-Time Costs
- Development: Included (Manus infrastructure)
- No additional API keys needed (using Manus built-in LLM)

---

## Implementation Roadmap

### Week 1-2: Core Upload & Extraction
- [ ] Add database schema
- [ ] Build upload UI (HTML link + document upload)
- [ ] Implement document parser (HTML, PDF, DOCX)
- [ ] Create LLM extraction pipeline
- [ ] Store extracted data in database

### Week 2-3: Archive Dashboard
- [ ] Build archive timeline view
- [ ] Implement theme detection
- [ ] Create trend analysis engine
- [ ] Build charts (theme frequency, signal trends)
- [ ] Add filtering by theme/date

### Week 3-4: Chatbot
- [ ] Implement semantic search (embeddings)
- [ ] Build chatbot UI
- [ ] Integrate extended thinking mode
- [ ] Add context retrieval logic
- [ ] Test deep reasoning capabilities

### Week 4-5: Polish & Testing
- [ ] End-to-end testing
- [ ] Error handling & edge cases
- [ ] Performance optimization
- [ ] User acceptance testing

### Week 5-6: Deployment
- [ ] Deploy to production
- [ ] Monitor costs & performance
- [ ] Gather user feedback

---

## Key Decisions

### 1. Why Replace n8n?
- **Simpler**: No workflow maintenance, no cron jobs
- **Flexible**: Users control when briefs are uploaded
- **Scalable**: Easy to add more briefs later
- **Cost-effective**: Pay only for what's used

### 2. Intelligent Data Mapping
- Reuse existing Claude system prompt
- Extract signals contextually (e.g., "$14B ↓" → label: "US Arms Package", value: "$14B", trend: "down")
- Auto-detect themes (oil, Taiwan, geopolitics, etc.)

### 3. Archive & Trends
- Start with automatic theme detection (no manual tagging)
- Add manual search/filter later if needed
- Use embeddings for semantic search (future enhancement)

### 4. Chatbot Reasoning
- Use extended thinking for deep analysis
- Budget 5000-10000 tokens per query
- Keep context window focused (last 30 days of briefs)

---

## Future Enhancements (Post-MVP)

1. **Automated n8n Integration**: Re-enable n8n to auto-upload daily briefs
2. **Subscriber Collaboration**: Share briefs, comments, annotations
3. **Export Reports**: Generate PDF/Excel reports from archive
4. **API Access**: Let subscribers query archive programmatically
5. **Mobile App**: iOS/Android for on-the-go brief uploads
6. **Predictive Alerts**: "Oil risk rising, STI may decline"
7. **Multi-language Support**: Translate briefs to other languages

---

## Success Metrics

- [ ] 20 users successfully upload briefs
- [ ] Average extraction accuracy: >90%
- [ ] Chatbot answers 80%+ of questions satisfactorily
- [ ] Archive dashboard shows clear trend patterns
- [ ] Monthly costs stay under $50
- [ ] System uptime: >99.5%

---

## Questions for Clarification

1. **Subscriber Authentication**: Should only logged-in users upload? (Yes, assumed)
2. **Brief Versioning**: If a user re-uploads the same date, should we version or replace?
3. **Theme Customization**: Should users be able to define custom themes?
4. **Export**: Should users be able to export trend reports?
5. **Collaboration**: Should subscribers share archives or keep them private?

---

## Next Steps

1. Approve this specification
2. I'll create the database schema and update the codebase
3. Build the upload interface
4. Implement LLM extraction pipeline
5. Build archive dashboard
6. Implement chatbot with extended thinking
7. Deploy and monitor costs

Ready to proceed?
