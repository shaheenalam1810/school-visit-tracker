/** Builds an RFC 4180-ish CSV string from headers + rows (no library). */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (val: string | number): string => {
    const str = String(val ?? "");
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  const lines = [headers.map(escape).join(",")];
  rows.forEach((row) => lines.push(row.map(escape).join(",")));
  return lines.join("\r\n");
}

const UTF8_BOM = "﻿";

/**
 * Triggers a browser download of `csv` as a file. A UTF-8 BOM is
 * prepended so Excel (which otherwise guesses the wrong encoding)
 * renders special characters correctly.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([UTF8_BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
