import fs from 'fs';
import path from 'path';

const REPORTS_PATH = path.join(process.cwd(), 'database', 'admin-reports.json');

function ensureFile() {
  if (!fs.existsSync(REPORTS_PATH)) {
    fs.mkdirSync(path.dirname(REPORTS_PATH), { recursive: true });
    fs.writeFileSync(REPORTS_PATH, JSON.stringify({ reports: [] }, null, 2));
  }
}

export function listReports() {
  ensureFile();
  const raw = fs.readFileSync(REPORTS_PATH, 'utf-8');
  const json = JSON.parse(raw);
  return json.reports || [];
}

export function saveReports(reports: any[]) {
  ensureFile();
  fs.writeFileSync(REPORTS_PATH, JSON.stringify({ reports }, null, 2));
}

export function createReport(report: any) {
  const reports = listReports();
  const id = reports.length > 0 ? Math.max(...reports.map((r:any)=>r.id)) + 1 : 1;
  const now = new Date().toISOString();
  const newRep = { id, name: report.name, filters: report.filters || {}, createdAt: now, updatedAt: now };
  reports.push(newRep);
  saveReports(reports);
  return newRep;
}

export function updateReport(id: number, data: any) {
  const reports = listReports();
  const idx = reports.findIndex((r:any) => r.id === id);
  if (idx === -1) return null;
  reports[idx] = { ...reports[idx], ...data, updatedAt: new Date().toISOString() };
  saveReports(reports);
  return reports[idx];
}

export function deleteReport(id: number) {
  const reports = listReports();
  const newReports = reports.filter((r:any) => r.id !== id);
  saveReports(newReports);
  return true;
}
