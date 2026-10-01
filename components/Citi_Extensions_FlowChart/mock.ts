// @ts-nocheck
const configProps = {
  title: 'Organisation Chart',
  dataPageName: '',          // set to a real data page in Pega; leave blank to use treeData below
  idField: 'id',
  labelField: 'label',
  parentField: 'parentId',
  colorField: '',
  treeData: JSON.stringify({
    id: 'root',
    label: 'CEO',
    children: [
      {
        id: 'cto', label: 'CTO',
        children: [
          { id: 'fe', label: 'Front-end' },
          { id: 'be', label: 'Back-end' },
          { id: 'qa', label: 'QA' },
        ],
      },
      {
        id: 'cfo', label: 'CFO',
        children: [
          { id: 'acc', label: 'Accounting' },
          { id: 'aud', label: 'Audit' },
        ],
      },
      { id: 'cmo', label: 'CMO' },
    ],
  }),
  // Example of 3 filter fields configured in App Studio
  filterFields: [
    { fieldName: 'department', label: 'Department', fieldType: 'select', options: 'Engineering,Finance,Marketing', defaultValue: '' },
    { fieldName: 'location',   label: 'Location',   fieldType: 'text',   defaultValue: '' },
    { fieldName: 'activeDate', label: 'Active as of', fieldType: 'date', defaultValue: '' },
  ],
};

export default configProps;
