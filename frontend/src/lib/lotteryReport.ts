export interface ReportSummaryItem {
  label: string;
  value: string;
}

export interface PrintReportOptions {
  title: string;
  subtitle?: string;
  summary?: ReportSummaryItem[];
  columns: string[];
  rows: string[][];
  footer?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCsv(value: string | number): string {
  const text = String(value ?? '');
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadCsv(
  filename: string,
  columns: string[],
  rows: Array<Array<string | number>>,
): void {
  const content = [
    columns.map(escapeCsv).join(';'),
    ...rows.map((row) => row.map(escapeCsv).join(';')),
  ].join('\r\n');

  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printReport(options: PrintReportOptions): void {
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) {
    window.alert('El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.');
    return;
  }

  const summaryHtml = (options.summary ?? [])
    .map(
      (item) => `
        <div class="summary-item">
          <span class="summary-label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>`,
    )
    .join('');

  const headHtml = options.columns
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join('');

  const bodyHtml = options.rows
    .map(
      (row) => `
        <tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
    )
    .join('');

  popup.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 13px; font-weight: 400; color: #4b5563; margin: 0 0 16px; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .summary-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; min-width: 130px; }
    .summary-label { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .03em; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f3f4f6; text-align: left; padding: 6px; border-bottom: 1px solid #d1d5db; }
    td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .footer { margin-top: 16px; font-size: 10px; color: #6b7280; }
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(options.title)}</h1>
  ${options.subtitle ? `<h2>${escapeHtml(options.subtitle)}</h2>` : ''}
  ${summaryHtml ? `<div class="summary">${summaryHtml}</div>` : ''}
  <table>
    <thead><tr>${headHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  ${options.footer ? `<p class="footer">${escapeHtml(options.footer)}</p>` : ''}
  <p class="footer no-print">Se abrirá el diálogo de impresión. Elige "Guardar como PDF" si quieres descargarlo.</p>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  popup.document.close();
}
