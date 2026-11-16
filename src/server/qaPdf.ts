import PDFDocument from 'pdfkit';
import type {
  ProductQaLog,
  ProductQaReport,
  QaCodeHotspotItem
} from '../shared/types.ts';

function truncateText(text: string, maxLen: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 1))}…`;
}

export async function renderQaEodPdfBuffer(
  report: ProductQaReport,
  logs: ProductQaLog[],
  hotspots: QaCodeHotspotItem[]
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      bufferPages: true,
      info: {
        Title: report.subject,
        Author: 'GitStack Live QA Agent',
        Subject: `Product QA & Telemetry Summary (${report.report_date})`
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - 88; // 595.28 - 88 = 507.28
    const healthColor =
      report.health_score >= 90
        ? '#16A34A'
        : report.health_score >= 70
          ? '#D97706'
          : '#DC2626';

    // --- HEADER BANNER ---
    doc.rect(0, 0, doc.page.width, 96).fill('#0F172A');
    doc.rect(0, 96, doc.page.width, 4).fill('#2563EB');

    doc
      .fillColor('#93C5FD')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('GITSTACK PRODUCT QA & TELEMETRY AGENT', 44, 24, { characterSpacing: 0.8 });

    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('End-of-Day Product Health & Error Report', 44, 40);

    doc
      .fillColor('#CBD5E1')
      .font('Helvetica')
      .fontSize(9.5)
      .text(
        `Report Date: ${report.report_date}   |   Generated: ${new Date(report.created_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC`,
        44,
        68
      );

    // Health Score Badge in Top Right
    doc.roundedRect(doc.page.width - 134, 22, 90, 52, 6).fill('#1E293B');
    doc
      .fillColor('#94A3B8')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('HEALTH SCORE', doc.page.width - 134, 30, { width: 90, align: 'center' });
    doc
      .fillColor(healthColor)
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(`${report.health_score}%`, doc.page.width - 134, 44, { width: 90, align: 'center' });

    let y = 118;

    // --- 4 KPI SUMMARY CARDS ---
    const cardGap = 10;
    const cardW = (pageWidth - cardGap * 3) / 4;
    const kpis = [
      { label: 'TOTAL LOGS', value: String(report.total_logs), sub: 'Captured events', color: '#0F172A' },
      { label: 'ERRORS', value: String(report.error_count), sub: 'Failures & 5xx', color: report.error_count > 0 ? '#DC2626' : '#16A34A' },
      { label: 'WARNINGS', value: String(report.warn_count), sub: '4xx & minor faults', color: report.warn_count > 0 ? '#D97706' : '#475569' },
      { label: 'TOP MODULE', value: truncateText(report.top_module || 'None', 14), sub: truncateText(report.top_page || '/', 18), color: '#1D4ED8' }
    ];

    kpis.forEach((k, idx) => {
      const cx = 44 + idx * (cardW + cardGap);
      doc.roundedRect(cx, y, cardW, 62, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc
        .fillColor('#64748B')
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(k.label, cx + 10, y + 10, { width: cardW - 20 });
      doc
        .fillColor(k.color)
        .font('Helvetica-Bold')
        .fontSize(idx === 3 ? 11 : 17)
        .text(k.value, cx + 10, y + (idx === 3 ? 25 : 22), { width: cardW - 20 });
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(8)
        .text(k.sub, cx + 10, y + 44, { width: cardW - 20 });
    });

    y += 80;

    // --- EXECUTIVE SUMMARY ---
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Executive Summary', 44, y);
    y += 18;

    const summaryText = report.executive_summary || 'All monitored product modules operated smoothly with no critical regressions detected.';
    const summaryHeight = Math.max(
      48,
      doc.heightOfString(summaryText, { width: pageWidth - 24, lineGap: 3 }) + 20
    );
    doc.roundedRect(44, y, pageWidth, summaryHeight, 6).fillAndStroke('#F8FAFC', '#E2E8F0');
    doc
      .fillColor('#1E293B')
      .font('Helvetica')
      .fontSize(9.5)
      .text(summaryText, 56, y + 11, { width: pageWidth - 24, lineGap: 3 });

    y += summaryHeight + 18;

    const ensureSpace = (needed: number) => {
      if (y + needed > doc.page.height - 56) {
        doc.addPage();
        y = 48;
      }
    };

    // --- ERRORS BY PRODUCT MODULE (VISUAL BARS) ---
    ensureSpace(120);
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Where Errors Originated — By Product Module', 44, y);
    y += 18;

    if (report.module_breakdown.length === 0) {
      doc
        .fillColor('#16A34A')
        .font('Helvetica')
        .fontSize(9.5)
        .text('No module errors or warnings recorded during this window.', 44, y);
      y += 22;
    } else {
      const maxCount = Math.max(1, ...report.module_breakdown.map((m) => m.total_count));
      for (const mod of report.module_breakdown.slice(0, 7)) {
        ensureSpace(44);
        doc.roundedRect(44, y, pageWidth, 38, 5).fillAndStroke('#FFFFFF', '#E2E8F0');
        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .text(mod.module_name, 54, y + 7, { width: 170 });

        doc
          .fillColor('#64748B')
          .font('Courier')
          .fontSize(8)
          .text(truncateText(mod.top_code_location || mod.top_error, 48), 54, y + 21, { width: 280 });

        // Visual horizontal bar
        const barAreaX = 240;
        const barAreaW = 140;
        const fillW = Math.max(6, Math.round((mod.total_count / maxCount) * barAreaW));
        doc.roundedRect(barAreaX, y + 10, barAreaW, 7, 3).fill('#E2E8F0');
        doc.roundedRect(barAreaX, y + 10, fillW, 7, 3).fill(mod.error_count > 0 ? '#DC2626' : '#D97706');

        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(
            `${mod.error_count} err · ${mod.warn_count} warn`,
            392,
            y + 8,
            { width: pageWidth - 358, align: 'right' }
          );

        y += 44;
      }
      y += 6;
    }

    // --- ERRORS BY PAGE / ROUTE ---
    ensureSpace(100);
    doc
      .fillColor('#0F172A')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Affected Pages & Routes', 44, y);
    y += 18;

    if (report.page_breakdown.length === 0) {
      doc
        .fillColor('#64748B')
        .font('Helvetica')
        .fontSize(9.5)
        .text('No failing pages recorded.', 44, y);
      y += 22;
    } else {
      // Table header
      doc.rect(44, y, pageWidth, 22).fill('#F1F5F9');
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
      doc.text('PAGE / ROUTE', 52, y + 7, { width: 130 });
      doc.text('MODULE', 186, y + 7, { width: 120 });
      doc.text('PRIMARY ERROR', 310, y + 7, { width: 170 });
      doc.text('COUNT', pageWidth - 10, y + 7, { width: 46, align: 'right' });
      y += 22;

      for (const pgItem of report.page_breakdown.slice(0, 8)) {
        ensureSpace(26);
        doc.rect(44, y, pageWidth, 24).stroke('#E2E8F0');
        doc.fillColor('#1D4ED8').font('Courier-Bold').fontSize(8).text(truncateText(pgItem.page_path, 24), 52, y + 8, { width: 130 });
        doc.fillColor('#0F172A').font('Helvetica').fontSize(8.5).text(truncateText(pgItem.top_module, 22), 186, y + 7, { width: 120 });
        doc.fillColor('#475569').font('Helvetica').fontSize(8).text(truncateText(pgItem.top_error, 34), 310, y + 8, { width: 170 });
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5).text(String(pgItem.total_count), pageWidth - 10, y + 7, { width: 46, align: 'right' });
        y += 24;
      }
      y += 14;
    }

    // --- CODE HOTSPOTS & ROOT-CAUSE FIXES ---
    if (hotspots.length > 0) {
      ensureSpace(95);
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Exact Code Hotspots & Root-Cause Guidance', 44, y);
      y += 18;

      for (const hs of hotspots.slice(0, 5)) {
        const matchingLog = logs.find((l) => l.code_location === hs.code_location);
        const fixLine = matchingLog?.ai_fix_suggestion || 'Inspect handler validation and add structured error boundary.';
        const boxH = 54;
        ensureSpace(boxH + 8);
        doc.roundedRect(44, y, pageWidth, boxH, 5).fillAndStroke('#F8FAFC', '#E2E8F0');
        doc
          .fillColor('#1D4ED8')
          .font('Courier-Bold')
          .fontSize(8.5)
          .text(truncateText(hs.code_location || 'Unknown Source Location', 66), 54, y + 8, { width: pageWidth - 90 });
        doc
          .fillColor('#DC2626')
          .font('Helvetica-Bold')
          .fontSize(8.5)
          .text(`${hs.count}x`, pageWidth - 20, y + 8, { width: 54, align: 'right' });
        doc
          .fillColor('#0F172A')
          .font('Helvetica')
          .fontSize(8.5)
          .text(`Module: ${hs.module_name} — ${truncateText(hs.latest_message, 68)}`, 54, y + 22, { width: pageWidth - 20 });
        doc
          .fillColor('#15803D')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`Fix: ${truncateText(fixLine, 92)}`, 54, y + 36, { width: pageWidth - 20 });
        y += boxH + 6;
      }
      y += 10;
    }

    // --- RECOMMENDED ENGINEERING ACTIONS ---
    if (report.recommended_actions.length > 0) {
      ensureSpace(90);
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Recommended Engineering Next Steps', 44, y);
      y += 16;

      report.recommended_actions.slice(0, 6).forEach((action, idx) => {
        const textH = doc.heightOfString(`${idx + 1}. ${action}`, { width: pageWidth - 16 }) + 6;
        ensureSpace(textH);
        doc
          .fillColor('#1E293B')
          .font('Helvetica')
          .fontSize(9.5)
          .text(`${idx + 1}. ${action}`, 48, y, { width: pageWidth - 16 });
        y += textH + 2;
      });
      y += 10;
    }

    // --- RECENT CRITICAL ERRORS APPENDIX ---
    const errLogs = logs.filter((l) => l.level === 'error' || l.level === 'warn').slice(0, 10);
    if (errLogs.length > 0) {
      ensureSpace(90);
      doc
        .fillColor('#0F172A')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Recent Error & Warning Log Appendix', 44, y);
      y += 16;

      for (const item of errLogs) {
        ensureSpace(34);
        doc.rect(44, y, pageWidth, 30).stroke('#E2E8F0');
        doc
          .fillColor(item.level === 'error' ? '#DC2626' : '#D97706')
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .text(item.level.toUpperCase(), 50, y + 6, { width: 42 });
        doc
          .fillColor('#0F172A')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(truncateText(`${item.module_name} (${item.page_path})`, 46), 94, y + 5, { width: 220 });
        doc
          .fillColor('#64748B')
          .font('Courier')
          .fontSize(7.5)
          .text(new Date(item.created_at).toISOString().replace('T', ' ').slice(0, 19) + 'Z', pageWidth - 95, y + 5, { width: 130, align: 'right' });
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(8)
          .text(truncateText(`${item.code_location ? `[${item.code_location}] ` : ''}${item.message}`, 96), 94, y + 17, { width: pageWidth - 58 });
        y += 30;
      }
    }

    // --- FOOTER ON ALL PAGES ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor('#94A3B8')
        .font('Helvetica')
        .fontSize(8)
        .text(
          `GitStack Product QA Monitor  ·  Report ID ${report.id}  ·  Page ${i + 1} of ${range.count}`,
          44,
          doc.page.height - 30,
          { width: pageWidth, align: 'center' }
        );
    }

    doc.end();
  });
}
