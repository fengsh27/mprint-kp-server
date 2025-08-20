import { Database, Folder, FolderOpen, FileText } from 'lucide-react';

import { ATCData, LabelStatsData, StudyData, TypeData } from "../libs/database/types";

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