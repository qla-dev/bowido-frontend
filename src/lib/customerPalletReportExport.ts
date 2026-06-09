export type CustomerPalletReportRow = {
  palletName: string;
  palletType: string;
  statusLabel: string;
  sentDate: string;
  daysAtClient: number;
  graceDays: number;
  overdueDays: number;
  debt: number;
  location: string;
};

export type CustomerPalletReportGroup = {
  clientId: number;
  clientName: string;
  rows: CustomerPalletReportRow[];
  totalDebt: number;
  totalPallets: number;
  overduePallets: number;
};

export type CustomerPalletReportText = {
  workbookTitle: string;
  summarySheetName: string;
  summaryTitle: string;
  summaryClientLabel: string;
  summaryPalletsLabel: string;
  summaryOverdueLabel: string;
  summaryDebtLabel: string;
  clientSheetPrefix: string;
  palletLabel: string;
  typeLabel: string;
  statusLabel: string;
  sentDateLabel: string;
  daysAtClientLabel: string;
  graceDaysLabel: string;
  overdueDaysLabel: string;
  debtLabel: string;
  locationLabel: string;
  totalLabel: string;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const sanitizeSheetName = (value: string, fallback: string) => {
  const sanitized = value.replace(/[\\/*?:[\]]/g, ' ').trim();
  return (sanitized || fallback).slice(0, 31);
};

const getNumberCell = (value: number, styleId: string) =>
  `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${value}</Data></Cell>`;

const getTextCell = (value: string, styleId: string, mergeAcross = 0) =>
  `<Cell ss:StyleID="${styleId}"${mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : ''}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;

const wrapWorksheet = (name: string, columnWidths: number[], rows: string[]) => {
  const columns = columnWidths
    .map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`)
    .join('');

  return `
    <Worksheet ss:Name="${escapeXml(name)}">
      <Table>
        ${columns}
        ${rows.join('')}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <ProtectObjects>False</ProtectObjects>
        <ProtectScenarios>False</ProtectScenarios>
      </WorksheetOptions>
    </Worksheet>
  `;
};

const buildSummaryWorksheet = (
  groups: CustomerPalletReportGroup[],
  text: CustomerPalletReportText
) => {
  const rows = [
    `<Row>${getTextCell(text.summaryTitle, 'Title', 3)}</Row>`,
    '<Row />',
    `<Row>${getTextCell(text.summaryClientLabel, 'Header')}${getTextCell(text.summaryPalletsLabel, 'Header')}${getTextCell(text.summaryOverdueLabel, 'Header')}${getTextCell(text.summaryDebtLabel, 'Header')}</Row>`,
    ...groups.map(
      (group) =>
        `<Row>${getTextCell(group.clientName, 'Text')}${getNumberCell(group.totalPallets, 'Integer')}${getNumberCell(group.overduePallets, 'Integer')}${getNumberCell(Number(group.totalDebt.toFixed(2)), 'Currency')}</Row>`
    ),
    `<Row>${getTextCell(text.totalLabel, 'TotalLabel')}${getNumberCell(
      groups.reduce((sum, group) => sum + group.totalPallets, 0),
      'TotalInteger'
    )}${getNumberCell(
      groups.reduce((sum, group) => sum + group.overduePallets, 0),
      'TotalInteger'
    )}${getNumberCell(
      Number(groups.reduce((sum, group) => sum + group.totalDebt, 0).toFixed(2)),
      'TotalCurrency'
    )}</Row>`,
  ];

  return wrapWorksheet(text.summarySheetName, [220, 110, 120, 120], rows);
};

const buildClientWorksheet = (
  group: CustomerPalletReportGroup,
  text: CustomerPalletReportText
) => {
  const title = `${text.clientSheetPrefix}: ${group.clientName}`;
  const rows = [
    `<Row>${getTextCell(title, 'Title', 8)}</Row>`,
    `<Row>${getTextCell(text.summaryPalletsLabel, 'SubtleLabel')}${getNumberCell(group.totalPallets, 'Integer')}${getTextCell(text.summaryOverdueLabel, 'SubtleLabel')}${getNumberCell(group.overduePallets, 'Integer')}${getTextCell(text.summaryDebtLabel, 'SubtleLabel')}${getNumberCell(Number(group.totalDebt.toFixed(2)), 'Currency')}${getTextCell('', 'Text', 2)}</Row>`,
    '<Row />',
    `<Row>${getTextCell(text.palletLabel, 'Header')}${getTextCell(text.typeLabel, 'Header')}${getTextCell(text.statusLabel, 'Header')}${getTextCell(text.sentDateLabel, 'Header')}${getTextCell(text.daysAtClientLabel, 'Header')}${getTextCell(text.graceDaysLabel, 'Header')}${getTextCell(text.overdueDaysLabel, 'Header')}${getTextCell(text.debtLabel, 'Header')}${getTextCell(text.locationLabel, 'Header')}</Row>`,
    ...group.rows.map(
      (row) =>
        `<Row>${getTextCell(row.palletName, 'Text')}${getTextCell(row.palletType, 'Text')}${getTextCell(row.statusLabel, 'Text')}${getTextCell(row.sentDate, 'Text')}${getNumberCell(row.daysAtClient, 'Integer')}${getNumberCell(row.graceDays, 'Integer')}${getNumberCell(row.overdueDays, 'Integer')}${getNumberCell(Number(row.debt.toFixed(2)), 'Currency')}${getTextCell(row.location, 'Text')}</Row>`
    ),
    `<Row>${getTextCell(text.totalLabel, 'TotalLabel', 6)}${getNumberCell(
      Number(group.totalDebt.toFixed(2)),
      'TotalCurrency'
    )}${getTextCell('', 'TotalLabel')}</Row>`,
  ];

  return wrapWorksheet(
    sanitizeSheetName(group.clientName, `Client-${group.clientId}`),
    [120, 85, 110, 85, 85, 75, 85, 90, 210],
    rows
  );
};

export const buildCustomerPalletReportWorkbook = (
  groups: CustomerPalletReportGroup[],
  text: CustomerPalletReportText
) => {
  const worksheets = [
    ...(groups.length > 1 ? [buildSummaryWorksheet(groups, text)] : []),
    ...groups.map((group) => buildClientWorksheet(group, text)),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXml(text.workbookTitle)}</Title>
  </DocumentProperties>
  <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
    <WindowHeight>9000</WindowHeight>
    <WindowWidth>13860</WindowWidth>
    <ProtectStructure>False</ProtectStructure>
    <ProtectWindows>False</ProtectWindows>
  </ExcelWorkbook>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/>
    </Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>
      <Interior ss:Color="#E8F5EE" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C7D2D9"/>
      </Borders>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="Text">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="Integer">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
      <NumberFormat ss:Format="0"/>
    </Style>
    <Style ss:ID="Currency">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
      <NumberFormat ss:Format="0.00"/>
    </Style>
    <Style ss:ID="SubtleLabel">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#4B5563"/>
      <Interior ss:Color="#FAFAFA" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalLabel">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalInteger">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
      </Borders>
      <NumberFormat ss:Format="0"/>
    </Style>
    <Style ss:ID="TotalCurrency">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>
      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
      </Borders>
      <NumberFormat ss:Format="0.00"/>
    </Style>
  </Styles>
  ${worksheets.join('')}
</Workbook>`;
};
