import { Article } from './fetchUpdates';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(url: string | undefined): string {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return escapeHtml(parsed.href);
    }
    return '#';
  } catch {
    return '#';
  }
}

export function renderNewsletter(articles: Article[]): string {
  const rows = articles.map(
    (a) => `
      <tr>
        <td style="padding:10px 40px;font-family:Arial;font-size:14px;line-height:1.5">
          <h3 style="margin:0 0 5px 0">${escapeHtml(a.title)}</h3>
          <p style="margin:0 0 5px 0">${escapeHtml(a.summary_text)}</p>
          <a href="${sanitizeUrl(a.link)}" style="color:#2C74FF;text-decoration:underline">Learn more</a>
        </td>
      </tr>
    `
  ).join('');

  return `
    <div style="background-color:#f5f5f5;padding:20px">
      <table align="center" width="700" style="background-color:#ffffff;border-collapse:collapse;margin:0 auto">
        <tbody>
          <tr>
            <td style="padding:10px;text-align:right;font-family:Arial;font-size:14px">Vol. 1 — Jan 5, 2026</td>
          </tr>
          <tr>
            <td style="padding:20px;text-align:center;font-family:Arial;font-size:24px;color:#3C8BFF;font-weight:bold">
              REGULATORY UPDATES
            </td>
          </tr>
          ${rows}
          <tr>
            <td style="padding:20px;text-align:center;font-family:Arial;font-size:12px;color:#888">
              © 2026 Regintels. All rights reserved.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
