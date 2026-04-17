import { Request, Response } from "express";
import * as xlsx from "xlsx";
import { parse } from "csv-parse/sync";
import { createFundamentalData, getFundamentalData } from "./db";

export async function handleUpload(req: Request, res: Response) {
  try {
    const { filename, content, contentType } = req.body;

    if (!filename || !content) {
      return res.status(400).json({ error: "Missing filename or content" });
    }

    console.log(`[Upload] Receiving file: ${filename}, type: ${contentType}`);

    // content is base64 encoded
    const buffer = Buffer.from(content, "base64");
    let data: any[] = [];

    if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (filename.endsWith(".csv")) {
      data = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
      });
    } else {
      return res.status(400).json({ error: "Unsupported file format" });
    }

    console.log(`[Upload] Parsed ${data.length} rows from ${filename}`);

    // Expected format in CSV/Excel:
    // indicator, value, unit, releaseDate, dataType, source, description
    let savedCount = 0;
    for (const row of data) {
      const indicator = row.indicator || row["指标名称"] || row["指标"];
      const value = row.value || row["指标值"] || row["数值"];
      const dataType = row.dataType || row["数据分类"] || row["分类"] || "未分类";
      
      if (!indicator || value === undefined) continue;

      await createFundamentalData({
        indicator: String(indicator),
        value: value !== null ? String(value) : null,
        unit: row.unit || row["单位"] || "",
        dataType: String(dataType),
        releaseDate: row.releaseDate ? new Date(row.releaseDate) : new Date(),
        source: row.source || row["来源"] || "Local Upload",
        description: row.description || row["描述"] || "",
      });
      savedCount++;
    }

    res.json({ success: true, savedCount, totalRows: data.length });
  } catch (error: any) {
    console.error("[Upload] Error processing upload:", error);
    res.status(500).json({ error: error.message });
  }
}

export async function handleGetData(req: Request, res: Response) {
  try {
    const dataType = req.query.dataType as string | undefined;
    const limit = parseInt(req.query.limit as string || "100");
    const data = await getFundamentalData(dataType, limit);
    res.json(data);
  } catch (error: any) {
    console.error("[Data] Error fetching data:", error);
    res.status(500).json({ error: error.message });
  }
}
