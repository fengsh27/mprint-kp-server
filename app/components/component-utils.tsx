import { Database, Folder, FolderOpen, FileText } from 'lucide-react';

import { ATCData, LabelStatsData, StudyData, TypeData } from "../libs/database/types";
import writeXlsxFile from 'write-excel-file';

// Types for react-data-grid
interface RenderCellProps {
  row: any;
  column: any;
}


export interface RCTreeNode {
  key: string;
  title: string;
  children: RCTreeNode[];
  level: number;
}

export const build_atc_tree = (atcData: ATCData[]) => {
  const build_node = (values: string[], level: number = 0): RCTreeNode => {    
    if (values.length === 1) {
      return {
        key: values[0],
        title: values[0],
        children: [],
        level: level
      }
    }
    return {
      key: values[0],
      title: values[0],
      children: [build_node(values.slice(1), level + 1)],
      level: level
    }
  }
  const atc_tree: RCTreeNode[] = [];
  for (const atc of atcData) {
    const L1 = atc.L1;
    const L2 = atc.L2;
    const L3 = atc.L3;
    const L4 = atc.L4;
    const atc_code = atc.atc_code;

    const L1_node = atc_tree.find(node => node.key === L1);
    if (!L1_node) {
      atc_tree.push(build_node([L1, L2, L3, L4, atc_code], 0));
    } else {
      const L2_node = L1_node.children.find(node => node.key === L2);
      if (!L2_node) {
        L1_node.children.push(build_node([L2, L3, L4, atc_code], 1));
      } else {
        const L3_node = L2_node.children.find(node => node.key === L3);
        if (!L3_node) {
          L2_node.children.push(build_node([L3, L4, atc_code], 2));
        } else {
          const L4_node = L3_node.children.find(node => node.key === L4);
          if (!L4_node) {
            L3_node.children.push(build_node([L4, atc_code], 3));
          } else {
            const atc_code_node = L4_node.children.find(node => node.key === atc_code);
            if (!atc_code_node) {
              L4_node.children.push(build_node([atc_code], 4));
            }
          }
        }
      }
    }
  }
  return atc_tree;
}

// Custom icon function for tree nodes
export const getAtcCustomIcon = (props: any) => {
  const { expanded, data } = props;
  const level = data.level || 0;
  
  // Different icons based on level and whether it's expanded
  if (level === 0) {
    // Root level - Database icon
    return <Database className="w-4 h-4 text-blue-600" />;
  } else if (level === 1) {
    // L1 level - Large folder
    return expanded ? 
      <FolderOpen className="w-4 h-4 text-green-600" /> : 
      <Folder className="w-4 h-4 text-green-600" />;
  } else if (level === 2) {
    // L2 level - Medium folder
    return expanded ? 
      <FolderOpen className="w-4 h-4 text-orange-600" /> : 
      <Folder className="w-4 h-4 text-orange-600" />;
  } else if (level === 3) {
    // L3 level - Small folder
    return expanded ? 
      <FolderOpen className="w-4 h-4 text-purple-600" /> : 
      <Folder className="w-4 h-4 text-purple-600" />;
  } else if (level === 4) {
    // L4 level - File icon
    return <FileText className="w-4 h-4 text-red-600" />;
  } else {
    // Leaf level - Small file
    return <FileText className="w-4 h-4 text-gray-600" />;
  }
};

export const LabelStatsTableColumns = [{
  key: "TITLE",
  name: "TITLE",
  width: 300,
  minWidth: 200,
  maxWidth: 500,
  resizable: true,
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate">
      {row[column.key]}
    </div>
  ),
}, {
  key: "nursing_mothers",
  name: "Nursing Mothers",
  width: 100,
  minWidth: 100,
  maxWidth: 150,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div 
      title={column.name}
      className="truncate font-medium text-center"
      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}, {
  key: "carcinogenesis_and_mutagenesis_and_impairment_of_fertility",
  name: "Carcinogenesis and Mutagenesis and Impairment of Fertility",
  width: 200,
  minWidth: 100,
  maxWidth: 250,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div title={column.name} className="truncate font-medium">
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}, {
  key: "pregnancy",
  name: "Pregnancy",
  width: 100,
  minWidth: 100,
  maxWidth: 150,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div title={column.name} className="truncate font-medium text-center">
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}, {
  key: "pediatric_use",
  name: "Pediatric Use",
  width: 100,
  minWidth: 100,
  maxWidth: 150,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div title={column.name} className="truncate font-medium text-center">
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}, {
  key: "teratogenic_effects",
  name: "Teratogenic Effects",
  width: 150,
  minWidth: 100,
  maxWidth: 200,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div title={column.name} className="truncate font-medium text-center">
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}, {
  key: "pregnancy_or_breast_feeding",
  name: "Pregnancy or Breast Feeding",
  width: 200,
  minWidth: 100,
  maxWidth: 250,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div title={column.name} className="truncate font-medium text-center">
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}, {
  key: "labor_and_delivery",
  name: "Labor and Delivery",
  width: 100,
  minWidth: 100,
  maxWidth: 150,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div title={column.name} className="truncate font-medium text-center">
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}, {
  key: "nonteratogenic_effects",
  name: "Non-Teratogenic Effects",
  width: 100,
  minWidth: 100,
  maxWidth: 150,
  resizable: true,
  headerRenderer: ({ column }: { column: any }) => (
    <div title={column.name} className="truncate font-medium text-center">
      {column.name}
    </div>
  ),
  renderCell: ({ row, column }: RenderCellProps) => (
    <div title={row[column.key]} className="truncate text-center">
      {row[column.key]}
    </div>
  ),
}]

export interface LabelStatsTableRow {
  TITLE: string;
  nursing_mothers: string;
  carcinogenesis_and_mutagenesis_and_impairment_of_fertility: string;
  pregnancy: string;
  pediatric_use: string;
  teratogenic_effects: string;
  pregnancy_or_breast_feeding: string;
  labor_and_delivery: string;
  nonteratogenic_effects: string;
}
export const buildLabelStatsTable = (data: LabelStatsData[]): LabelStatsTableRow[] => {
  return data.map(item => {
    return {
      TITLE: item.TITLE,
      nursing_mothers: item.nursing_mothers === 1 ? "✅️" : "❌️",
      carcinogenesis_and_mutagenesis_and_impairment_of_fertility: item.carcinogenesis_and_mutagenesis_and_impairment_of_fertility === 1 ? "✅️" : "❌️",
      pregnancy: item.pregnancy === 1 ? "✅️" : "❌️",
      pediatric_use: item.pediatric_use === 1 ? "✅️" : "❌️",
      teratogenic_effects: item.teratogenic_effects === 1 ? "✅️" : "❌️",
      pregnancy_or_breast_feeding: item.pregnancy_or_breast_feeding === 1 ? "✅️" : "❌️",
      labor_and_delivery: item.labor_and_delivery === 1 ? "✅️" : "❌️",
      nonteratogenic_effects: item.nonteratogenic_effects === 1 ? "✅️" : "❌️",
    }
  })
}

export interface PublicationTableRow {
  PMID: string;
  Title: string;
  Year: string;
  StudiedDrugs: string;
  StudiedDiseases: string;
  StudyType: string;
  Population: string;
}
export const buildPublicationTable = (data: StudyData[], typeData: TypeData[]): PublicationTableRow[] => {
  const typeMap = new Map<string, TypeData>(typeData.map(item => [item.pmid, item]));

  return data.map(item => {
    const type = typeMap.get(item.PMID);
    return {
      ...item,
      StudyType: type?.study_type || "",
      Population: type?.population || "",
    }
  })
}


// --- Helper Function to Sanitize Data for CSV/TSV ---
const sanitizeCell = (cell: string) => {
  let value = cell === null || cell === undefined ? '' : cell.toString();
  // If the value contains a comma, a quote, or a newline, wrap it in double quotes.
  if (value.search(/("|,|\n)/g) >= 0) {
    // Also, escape any existing double quotes by doubling them.
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

// --- Helper Function to Generate Timestamp for File Names ---
const generateTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

interface DownloadTableColumn {
  label: string;
  value: (item: any) => string;
}


// --- The Reusable Download Function ---
function downloadDelimitedFile(data: any[], columns: Array<DownloadTableColumn>, delimiter: string, fileName: string, mimeType: string) {
  // 1. Create the header row
  const header = columns.map(col => col.label).join(delimiter);

  // 2. Create the data rows
  const rows = data.map(item => {
    const rowData = columns.map(col => sanitizeCell(col.value(item)));
    return rowData.join(delimiter);
  });

  // 3. Combine header and rows with a newline
  const content = [header, ...rows].join('\n');

  // 4. Create a Blob
  const blob = new Blob([content], { type: mimeType });

  // 5. Trigger the download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// --- Specific Functions for CSV and TSV ---
const columns: Array<DownloadTableColumn> = [
  { label: 'PMID', value: (item: PublicationTableRow) => item.PMID },
  { label: 'Title', value: (item: PublicationTableRow) => item.Title },
  { label: 'Year', value: (item: PublicationTableRow) => item.Year },
  { label: 'Studied Drugs', value: (item: PublicationTableRow) => item.StudiedDrugs },
  { label: 'Studied Diseases', value: (item: PublicationTableRow) => item.StudiedDiseases },
  { label: 'study_type', value: (item: PublicationTableRow) => item.StudyType },
  { label: 'population', value: (item: PublicationTableRow) => item.Population },
]
export function downloadPublicationTableAsCsv(publicationData: PublicationTableRow[]) { 
  const timestamp = generateTimestamp();
  downloadDelimitedFile(
    publicationData,
    columns,
    ',', // Comma delimiter
    `publication_table_${timestamp}.csv`,
    'text/csv;charset=utf-8;'
  );
}

export function downloadPublicationTableAsTsv(publicationData: PublicationTableRow[]) {
  const timestamp = generateTimestamp();
  downloadDelimitedFile(
    publicationData,
    columns,
    '\t', // Tab delimiter
    `publication_table_${timestamp}.tsv`,
    'text/tab-separated-values;charset=utf-8;'
  );
}


const publicationSchema = [{
  column: "PMID",
  type: String,
  value: (item: PublicationTableRow) => item.PMID,
}, {
  column: "Year",
  type: String,
  value: (item: PublicationTableRow) => item.Year,
}, {
  column: "Title",
  type: String,
  value: (item: PublicationTableRow) => item.Title,
}, {
  column: "Studied Drugs",
  type: String,
  value: (item: PublicationTableRow) => item.StudiedDrugs,
}, {
  column: "Studied Diseases",
  type: String,
  value: (item: PublicationTableRow) => item.StudiedDiseases,
}, {
  column: "study_type",
  type: String,
  value: (item: PublicationTableRow) => item.StudyType,
}, {
  column: "population",
  type: String,
  value: (item: PublicationTableRow) => item.Population,
}];

export const downloadPublicationTableAsXlsx = (publicationData: PublicationTableRow[]) => {
  const timestamp = generateTimestamp();
  writeXlsxFile(publicationData, { schema: publicationSchema, fileName: `publications_table_${timestamp}.xlsx` });
}
