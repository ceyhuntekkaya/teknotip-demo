export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
};

export type ExcelSheet = {
  name: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, unknown>>;
};

export function exportFilename(prefix: string): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.xlsx`;
}

type ExcelJSModule = typeof import("exceljs");

async function loadExcelJS(): Promise<ExcelJSModule> {
  const mod = (await import("exceljs")) as ExcelJSModule & {
    default?: ExcelJSModule;
  };
  if ("Workbook" in mod && typeof mod.Workbook === "function") {
    return mod;
  }
  if (mod.default && typeof mod.default.Workbook === "function") {
    return mod.default;
  }
  throw new Error("Excel kütüphanesi yüklenemedi.");
}

export async function downloadWorkbook(
  filename: string,
  sheets: ExcelSheet[],
): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TeknoTip";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width ?? 18,
      style: column.numFmt ? { numFmt: column.numFmt } : undefined,
    }));
    for (const row of sheet.rows) {
      worksheet.addRow(row);
    }
    const header = worksheet.getRow(1);
    header.font = { bold: true };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
