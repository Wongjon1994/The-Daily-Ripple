import { db } from './server/db.ts';
import { n8nBriefs } from './drizzle/schema.ts';
import fs from 'fs';

const briefData = JSON.parse(fs.readFileSync('./may31_brief_data.json', 'utf-8'));

async function insertBrief() {
  try {
    const result = await db.insert(n8nBriefs).values({
      date: briefData.date,
      dateSlug: briefData.dateSlug,
      sections: JSON.stringify(briefData.sections),
      telegraphUrl: briefData.telegraphUrl,
      dashboardUrl: briefData.dashboardUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✓ May 31 brief inserted successfully');
    console.log('Sections:', briefData.sections.length);
    console.log('Date:', briefData.date);
    console.log('Telegraph URL:', briefData.telegraphUrl);
  } catch (error) {
    console.error('✗ Failed to insert brief:', error);
    process.exit(1);
  }
}

insertBrief();
