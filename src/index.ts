#!/usr/bin/env node
import { Page, webkit } from 'playwright';
import fs from 'fs';
const config = require('./config.json');

async function app() {
  const browser = await webkit.launch({
    headless: true
  });

  const page = await browser.newPage();
  const managers = await getManagers(page);
  let results: string[] = [];

  for (const manager of managers) {
    console.log('processing ' + manager);
    results.push(manager);
    const history = await getHistory(page, manager);
    results.push(history.map((x) => x.period).join(','));
    results.push(history.map((x) => x.value).join(','));
    results.push('');
  }

  try {
    fs.writeFileSync(`./results.txt`, results.join('\r\n'));
  } catch (err) {
    console.error(err);
  }

  await browser.close();
}

async function getManagers(page: Page): Promise<string[]> {
  let result: string[] = [];
  const url = `https://www.dataroma.com/m/managers.php`;

  await goto(page, url, 4);

  const table = await page.$('#grid');

  if (table) {
    const rows = await table.$$('tr');
    if (rows) {
      for (let row of rows) {
        if (row) {
          const mantd = await row.$('.man');
          const anchor = await mantd?.$('a');
          if (anchor) {
            const href = await anchor.getAttribute('href');
            if (href) {
              const manager = href.split('=')[1];
              result = result.concat(manager);
            }
          }
        }
      }
    }
  }
  return result;
}

interface IManagerResults {
  manager: string;
  results: IPeriodResult[];
}

interface IPeriodResult {
  period: string;
  value: number;
}
async function getHistory(
  page: Page,
  manager: string
): Promise<IPeriodResult[]> {
  let result: IPeriodResult[] = [];
  const url = `https://www.dataroma.com/m/hist/p_hist.php?f=${manager}`;
  await goto(page, url, 4);

  const table = await page.$('#grid');

  if (table) {
    const rows = await table.$$('tr');
    if (rows) {
      for (let row of rows) {
        if (row) {
          const tds = await row.$$('td');
          const period = await (await tds[0].innerText()).replace('   ', ' ');
          const rawValue = await (await tds[1].innerText()).replace('$', '');
          const value = processAsMillions(rawValue);

          result = result.concat({ period, value });
        }
      }
    }
  }

  return result.filter((x) => x.value > -1).reverse();
}

async function goto(page: Page, url: string, retry: number) {
  for (let i = 0; i < retry; i++) {
    try {
      await page.goto(url);
      await page.waitForLoadState('networkidle', { timeout: 0 });
      return;
    } catch {}
  }
}

function processAsMillions(val: string): number {
  if (val.includes('B')) {
    const bv = val.replace('B', '');
    const mnv = Number(bv);
    return mnv * 1000;
  }
  if (val.includes('M')) {
    const mv = val.replace('M', '');
    const mnv = Number(mv);
    const bnv = mnv;
    return bnv;
  }
  return -1;
}

app();
