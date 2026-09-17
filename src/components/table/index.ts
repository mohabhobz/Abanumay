/** نقطة الدخول لجدول البيانات العام */
export { DataTable, type DataTableProps } from './DataTable'
export {
  aggregate, defaultCols, orderCols, readCols, writeCols, splitGroups,
  groupChain, groupTree, countLeaves, sheetOf, MAX_GROUP_DEPTH,
  type Agg, type Col, type Group, type GroupBy, type GroupNode, type SheetParts,
} from './model'
