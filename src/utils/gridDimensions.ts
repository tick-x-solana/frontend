import type { RemoteCell } from "@/src/features/trade/store";

export interface GridRow {
  lowerPrice: number;
  upperPrice: number;
  key: string;
}

export interface GridColumn {
  startTs: number;
  endTs: number;
  key: string;
}

export interface GridDimensions {
  rows: GridRow[];
  columns: GridColumn[];
  rowCount: number;
  columnCount: number;
  priceStep: number;
  intervalMs: number;
  cellsByPosition: Map<string, RemoteCell>;
}

const positionKey = (rowKey: string, colKey: string) => `${rowKey}|${colKey}`;

export const rowKey = (lowerPrice: string | number, upperPrice: string | number) =>
  `${lowerPrice}:${upperPrice}`;

export const columnKey = (startTs: number, endTs: number) => `${startTs}:${endTs}`;

/**
 * Derive grid rows/columns from a flat list of remote cells.
 * - Rows group cells sharing the same (lowerPrice, upperPrice).
 * - Columns group cells sharing the same (startTs, endTs) — expected 5s apart.
 */
export function computeGridDimensions(cells: RemoteCell[]): GridDimensions {
  const rowMap = new Map<string, GridRow>();
  const colMap = new Map<string, GridColumn>();
  const cellsByPosition = new Map<string, RemoteCell>();

  for (const cell of cells) {
    const rKey = rowKey(cell.lowerPrice, cell.upperPrice);
    if (!rowMap.has(rKey)) {
      rowMap.set(rKey, {
        lowerPrice: parseFloat(cell.lowerPrice),
        upperPrice: parseFloat(cell.upperPrice),
        key: rKey,
      });
    }

    const cKey = columnKey(cell.startTs, cell.endTs);
    if (!colMap.has(cKey)) {
      colMap.set(cKey, {
        startTs: cell.startTs,
        endTs: cell.endTs,
        key: cKey,
      });
    }

    cellsByPosition.set(positionKey(rKey, cKey), cell);
  }

  // Rows: sorted by price descending (highest price at top of grid)
  const rows = Array.from(rowMap.values()).sort(
    (a, b) => b.lowerPrice - a.lowerPrice,
  );
  // Columns: sorted by time ascending (earliest left, latest right)
  const columns = Array.from(colMap.values()).sort(
    (a, b) => a.startTs - b.startTs,
  );

  const priceStep =
    rows.length > 0 ? rows[0].upperPrice - rows[0].lowerPrice : 0;
  const intervalMs =
    columns.length > 0 ? columns[0].endTs - columns[0].startTs : 0;

  return {
    rows,
    columns,
    rowCount: rows.length,
    columnCount: columns.length,
    priceStep,
    intervalMs,
    cellsByPosition,
  };
}

/** Look up the cell at a given row/column position (or undefined if missing). */
export function getCellAt(
  dims: GridDimensions,
  row: GridRow,
  column: GridColumn,
): RemoteCell | undefined {
  return dims.cellsByPosition.get(positionKey(row.key, column.key));
}
