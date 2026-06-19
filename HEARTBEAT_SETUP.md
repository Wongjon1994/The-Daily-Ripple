# Heartbeat Setup Guide

This document describes how to set up Heartbeat cron jobs for the Ripple Dashboard.

## Market Ticker Update (Every 60 seconds)

The market ticker endpoint fetches live market data from Yahoo Finance and updates the dashboard every 60 seconds.

### Setup Instructions

1. **Save a checkpoint** (already done)
2. **Deploy the project** to production
3. **Create the Heartbeat job** using the CLI:

```bash
manus-heartbeat create \
  --name ripple-market-ticker \
  --cron "0 * * * * *" \
  --path /api/scheduled/market-ticker \
  --description "Update live market ticker data every 60 seconds"
```

### Cron Expression Breakdown

- `0 * * * * *` = Every minute at second 0 (UTC)
- Format: `sec min hour dom mon dow`

### Endpoint Details

**URL**: `/api/scheduled/market-ticker`  
**Method**: `POST`  
**Authentication**: Automatic (Heartbeat provides cron credentials)  
**Timeout**: 2 minutes per call

### Response Format

**Success (200)**:
```json
{
  "ok": true,
  "timestamp": "2026-06-01T05:35:00.000Z",
  "tickerCount": 7,
  "data": [
    {
      "label": "S&P 500",
      "value": "5432.10",
      "change": "+0.25%",
      "direction": "up"
    }
  ]
}
```

**Error (500)**:
```json
{
  "error": "Market ticker update failed: ...",
  "timestamp": "2026-06-01T05:35:00.000Z",
  "context": {
    "url": "/api/scheduled/market-ticker",
    "method": "POST"
  }
}
```

### Market Symbols Tracked

1. **BZ=F** - Brent Crude Oil
2. **^GSPC** - S&P 500 Index
3. **^IXIC** - Nasdaq Composite
4. **^STI** - SGX Straits Times Index
5. **SGD=X** - USD/SGD Exchange Rate
6. **GC=F** - Gold Futures
7. **^VIX** - Volatility Index

### Monitoring

To view recent executions of the market ticker job:

```bash
manus-heartbeat logs --task-uid <task_uid> --status all
```

To pause the job:

```bash
manus-heartbeat update --task-uid <task_uid> --enable=false
```

To resume the job:

```bash
manus-heartbeat update --task-uid <task_uid> --enable=true
```

## n8n Brief Publishing

The n8n workflow publishes daily briefs to the dashboard via `/api/scheduled/publish-n8n-brief`.

### Setup Instructions

1. **Configure n8n workflow** to POST to:
   ```
   https://rippledash-ht3duhth.manus.space/api/scheduled/publish-n8n-brief
   ```

2. **Payload format**:
   ```json
   {
     "date": "June 1, 2026",
     "dateSlug": "june-1-2026",
     "sections": [
       {
         "title": "Section Title",
         "summary": "Brief summary",
         "content": "Full content",
         "category": "Geopolitics",
         "singaporeLens": "Singapore context"
       }
     ],
     "telegraphUrl": "https://telegra.ph/...",
     "dashboardUrl": "https://rippledash-ht3duhth.manus.space/brief?date=june-1-2026"
   }
   ```

3. **Response**:
   ```json
   {
     "ok": true,
     "briefId": "june-1-2026",
     "dashboardUrl": "https://rippledash-ht3duhth.manus.space/brief?date=june-1-2026",
     "telegraphUrl": "https://telegra.ph/..."
   }
   ```

## Troubleshooting

### Market Ticker Not Updating

1. Check that Forge API credentials are set:
   ```bash
   echo $BUILT_IN_FORGE_API_KEY
   echo $BUILT_IN_FORGE_API_URL
   ```

2. View recent logs:
   ```bash
   manus-heartbeat logs --task-uid <task_uid> --with-body
   ```

3. Check for API errors in the response body

### Brief Not Publishing

1. Verify n8n workflow is sending POST requests to correct URL
2. Check response status code (should be 200)
3. Verify payload format matches schema
4. Check database connection in logs

## CLI Reference

| Command | Purpose |
|---------|---------|
| `manus-heartbeat create` | Create a new cron job |
| `manus-heartbeat list` | List all cron jobs |
| `manus-heartbeat update` | Update a cron job |
| `manus-heartbeat delete` | Delete a cron job |
| `manus-heartbeat logs` | View execution history |

For full details: `manus-heartbeat --help`
