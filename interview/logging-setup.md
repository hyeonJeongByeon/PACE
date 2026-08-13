# Session logging to Google Sheets — setup (about 2 minutes)

The app can post each session (transcript, coach notes, report, full JSON) to
a Google Sheet you own, via a Google Apps Script web app. The app never sees
your Google credentials; it only knows one POST URL.

Data note: enabling this stores participant transcripts outside their browser,
which deviates from the original client-side-only design. Choose the Google
account accordingly (an institutional account is safer for research data than
a personal one).

## Steps (do these in the Google account that should own the data)

1. Create a new Google Sheet (sheets.new). Name it e.g. "PACE session logs".
2. In the sheet: **Extensions → Apps Script**. Delete any code there and paste
   the script below. Save (name it anything).
3. Click **Deploy → New deployment**. Click the gear next to "Select type" →
   **Web app**. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click Deploy, approve the permissions prompt (it asks because the script
   writes to your sheet), and copy the **Web app URL** (ends in `/exec`).
5. Send that URL to Claude (or paste it into `js/config.js` → `LOG_ENDPOINT`
   yourself) and redeploy the site.

"Who has access: Anyone" means anyone who knows the URL can append rows to the
log sheet (they cannot read it). The URL is only ever embedded in the study
site; that is the accepted tradeoff for this no-backend setup.

## The Apps Script

```javascript
const HEADERS = [
  'logged_at', 'event', 'session_id', 'topic', 'scenario', 'resolution',
  'turns', 'coach_notes', 'transcript', 'report_json', 'session_json'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('log');
    if (!sheet) {
      sheet = ss.insertSheet('log');
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
    }
    const d = JSON.parse(e.postData.contents);
    sheet.appendRow([
      new Date(), d.event || '', d.session_id || '', d.topic || '',
      d.scenario_seed || '', d.resolution || '', d.turns || 0,
      d.coach_notes || 0, d.transcript_text || '', d.report_json || '',
      d.session_json || ''
    ]);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err);
  } finally {
    lock.releaseLock();
  }
}
```

## What gets logged, when

- `visit_closed` — when the role-play ends (transcript complete, no report yet)
- `report_ready` — when the summary finishes generating (includes the report)
- `abandoned_midvisit` — best effort, if the tab closes mid-role-play

Each event is one row; `session_id` ties rows from the same session together.
Long fields are clipped to fit Google's 50,000-character cell limit.
