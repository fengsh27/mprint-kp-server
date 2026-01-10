// app/api/study/export/route.ts
import { NextResponse } from "next/server";
import writeXlsxFile from "write-excel-file/node";
import { queriedStudy } from "../../../libs/database/query_db";
import { withRateLimit, searchRateLimiter } from "../../../libs/middleware/rateLimiter";
import {
  InputValidator,
  addSecurityHeaders,
  validateRequestSize,
  detectSQLInjection,
  sanitizeInput,
  logSecurityEvent
} from "../../../libs/middleware/security";
import { MAX_QUERIED_ARRAY_LENGTH } from "../../../libs/constants";

type ExportFormat = "csv" | "tsv" | "xlsx";

type PublicationExportRow = {
  PMID: string;
  Title: string;
  Year: string;
  StudiedDrugs: string;
  StudiedDiseases: string;
  StudyType: string;
  Population: string;
  PKScore: string;
  PEScore: string;
  CTScore: string;
};

const exportColumns = [
  { label: "PMID", value: (item: PublicationExportRow) => item.PMID },
  { label: "Title", value: (item: PublicationExportRow) => item.Title },
  { label: "Year", value: (item: PublicationExportRow) => item.Year },
  { label: "Studied Drugs", value: (item: PublicationExportRow) => item.StudiedDrugs },
  { label: "Studied Diseases", value: (item: PublicationExportRow) => item.StudiedDiseases },
  { label: "study_type", value: (item: PublicationExportRow) => item.StudyType },
  { label: "population", value: (item: PublicationExportRow) => item.Population },
  { label: "PK Score", value: (item: PublicationExportRow) => item.PKScore },
  { label: "PE Score", value: (item: PublicationExportRow) => item.PEScore },
  { label: "CT Score", value: (item: PublicationExportRow) => item.CTScore }
];

const exportSchema = [
  { column: "PMID", type: String, value: (item: PublicationExportRow) => item.PMID },
  { column: "Year", type: String, value: (item: PublicationExportRow) => item.Year },
  { column: "Title", type: String, value: (item: PublicationExportRow) => item.Title },
  { column: "Studied Drugs", type: String, value: (item: PublicationExportRow) => item.StudiedDrugs },
  { column: "Studied Diseases", type: String, value: (item: PublicationExportRow) => item.StudiedDiseases },
  { column: "study_type", type: String, value: (item: PublicationExportRow) => item.StudyType },
  { column: "population", type: String, value: (item: PublicationExportRow) => item.Population },
  { column: "PK Score", type: String, value: (item: PublicationExportRow) => item.PKScore },
  { column: "PE Score", type: String, value: (item: PublicationExportRow) => item.PEScore },
  { column: "CT Score", type: String, value: (item: PublicationExportRow) => item.CTScore }
];

const sanitizeCell = (cell: string) => {
  let value = cell === null || cell === undefined ? "" : cell.toString();
  if (value.search(/("|,|\n)/g) >= 0) {
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const generateTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

const buildDelimitedContent = (rows: PublicationExportRow[], delimiter: string) => {
  const header = exportColumns.map((col) => col.label).join(delimiter);
  const dataRows = rows.map((row) =>
    exportColumns.map((col) => sanitizeCell(col.value(row))).join(delimiter)
  );
  return [header, ...dataRows].join("\n");
};

async function studyExportHandler(req: Request) {
  const requestStartTime = performance.now();

  const sizeValidation = validateRequestSize(req as any, 5);
  if (!sizeValidation.valid) {
    logSecurityEvent(req as any, "REQUEST_SIZE_EXCEEDED", { size: req.headers.get("content-length") });
    return NextResponse.json(
      { error: "Request too large", message: sizeValidation.error },
      { status: 413 }
    );
  }

  try {
    const body = await req.json();
    const items = body?.pmids;
    const format = body?.format as ExportFormat | undefined;

    if (!Array.isArray(items) || !format) {
      logSecurityEvent(req as any, "INVALID_INPUT", { error: "Request body must include pmids and format" });
      return NextResponse.json(
        { error: "Invalid input", message: "Request body must include pmids and format" },
        { status: 400 }
      );
    }

    if (!["csv", "tsv", "xlsx"].includes(format)) {
      logSecurityEvent(req as any, "INVALID_INPUT", { error: "Invalid export format" });
      return NextResponse.json(
        { error: "Invalid input", message: "Format must be one of csv, tsv, xlsx" },
        { status: 400 }
      );
    }

    const arrayValidation = InputValidator.validateArray(items, "request body", MAX_QUERIED_ARRAY_LENGTH);
    if (!arrayValidation.valid) {
      logSecurityEvent(req as any, "INVALID_INPUT", { error: arrayValidation.error });
      return NextResponse.json(
        { error: "Invalid input", message: arrayValidation.error },
        { status: 400 }
      );
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") {
        logSecurityEvent(req as any, "INVALID_INPUT", { error: `Invalid item at index ${i}` });
        return NextResponse.json(
          { error: "Invalid input", message: `Invalid item at index ${i}` },
          { status: 400 }
        );
      }
      if (!item.pmid || typeof item.pmid !== "string") {
        logSecurityEvent(req as any, "INVALID_INPUT", { error: `Missing or invalid PMID at index ${i}` });
        return NextResponse.json(
          { error: "Invalid input", message: `Missing or invalid PMID at index ${i}` },
          { status: 400 }
        );
      }
      const pmidValidation = InputValidator.validatePMID(item.pmid);
      if (!pmidValidation.valid) {
        logSecurityEvent(req as any, "INVALID_INPUT", {
          error: pmidValidation.error,
          pmid: item.pmid,
          index: i
        });
        return NextResponse.json(
          { error: "Invalid input", message: pmidValidation.error },
          { status: 400 }
        );
      }
      if (detectSQLInjection(item.pmid)) {
        logSecurityEvent(req as any, "SQL_INJECTION_ATTEMPT", { pmid: item.pmid, index: i });
        return NextResponse.json(
          { error: "Invalid input", message: "Suspicious input detected" },
          { status: 400 }
        );
      }
    }

    const pmids = items.map((item: any) => item.pmid);
    const sanitizedPmids = sanitizeInput(pmids);

    const studyRows = await queriedStudy(sanitizedPmids);
    const exportRows: PublicationExportRow[] = studyRows.map((row) => {
      const pkScore = row.maternal_score_pk ?? row.pediatric_score_pk;
      const peScore = row.maternal_score_pe ?? row.pediatric_score_pe;
      const ctScore = row.maternal_score_ct ?? row.pediatric_score_ct;
      return {
        PMID: row.PMID,
        Title: row.Title ?? "",
        Year: row.Year ?? "",
        StudiedDrugs: row.StudiedDrugs ?? "",
        StudiedDiseases: row.StudiedDiseases ?? "",
        StudyType: row.StudyType ?? "",
        Population: row.Population ?? "",
        PKScore: pkScore !== undefined && pkScore !== null ? String(pkScore) : "",
        PEScore: peScore !== undefined && peScore !== null ? String(peScore) : "",
        CTScore: ctScore !== undefined && ctScore !== null ? String(ctScore) : ""
      };
    });

    const timestamp = generateTimestamp();
    const filename = `publication_table_${timestamp}.${format}`;

    let content: string | Buffer;
    let contentType: string;

    if (format === "xlsx") {
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      content = await writeXlsxFile(exportRows, { schema: exportSchema, buffer: true });
    } else if (format === "tsv") {
      contentType = "text/tab-separated-values;charset=utf-8;";
      content = buildDelimitedContent(exportRows, "\t");
    } else {
      contentType = "text/csv;charset=utf-8;";
      content = buildDelimitedContent(exportRows, ",");
    }

    const requestEndTime = performance.now();
    const requestDurationMs = requestEndTime - requestStartTime;

    logSecurityEvent(req as any, "SUCCESSFUL_QUERY", {
      pmidCount: pmids.length,
      resultCount: exportRows.length,
      requestDurationMs: Math.round(requestDurationMs * 100) / 100,
      format
    });

    const response = new NextResponse(content as any, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error("Error in study export API:", error);
    logSecurityEvent(req as any, "DATABASE_ERROR", { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to export study data"
      },
      { status: 500 }
    );
  }
}

export const POST = withRateLimit(studyExportHandler, searchRateLimiter);
