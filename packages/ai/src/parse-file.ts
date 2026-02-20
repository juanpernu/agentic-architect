import * as XLSX from 'xlsx';

export function parseExcelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', blankrows: false });
    if (csv.trim()) {
      sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
  }

  return sheets.join('\n\n');
}

export async function parsePdfToText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;

  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    if (text.trim()) {
      pages.push(`=== Page ${i} ===\n${text}`);
    }
  }

  return pages.join('\n\n');
}

export function getFileType(mimeType: string): 'excel' | 'pdf' | null {
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  return null;
}
