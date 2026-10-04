/** Entry point for the generic data table. */
export { DataTable, type DataTableProps } from './DataTable'
export {
  aggregate, defaultCols, orderCols, readCols, writeCols, splitGroups,
  groupChain, groupTree, countLeaves, sheetOf, MAX_GROUP_DEPTH, readSort, writeSort, nextSort, sortRows,
  type Agg, type Col, type Group, type GroupBy, type GroupNode, type SheetParts, type ColSort, type SortDir,
} from './model'
