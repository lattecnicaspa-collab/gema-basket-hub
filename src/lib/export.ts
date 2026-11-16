export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV con ; e BOM: si apre correttamente in Excel italiano
export function downloadCSV(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
  downloadFile(name, "﻿" + csv, "text/csv;charset=utf-8");
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = l.split(sep);
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

export function buildICS(events: { id: string; title: string; date: string; description?: string }[], calName: string) {
  const d = (s: string) => s.replace(/-/g, "");
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const body = events
    .map((e) => {
      const next = new Date(e.date + "T00:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      return [
        "BEGIN:VEVENT", `UID:${e.id}@gema360`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART;VALUE=DATE:${d(e.date)}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`,
        `SUMMARY:${esc(e.title)}`, e.description ? `DESCRIPTION:${esc(e.description)}` : "", "END:VEVENT",
      ].filter(Boolean).join("\r\n");
    })
    .join("\r\n");
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GEMA360//IT\r\nX-WR-CALNAME:${calName}\r\n${body}\r\nEND:VCALENDAR`;
}
