async function loadAndParseDataset(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      throw new Error('CSV file is empty or contains only headers');
    }
    
    const headers = rows[0];
    
    const parsedData = rows.slice(1).map(row => {
      return headers.reduce((obj, header, index) => {
        const value = row[index];
        obj[header] = parseValue(value);
        return obj;
      }, {});
    });

    return { headers, data: parsedData };
  } catch (error) {
    console.error('Error loading or parsing the dataset:', error);
    throw error;
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim());
      currentValue = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(currentValue.trim());
      rows.push(row);
      row = [];
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  if (currentValue) {
    row.push(currentValue.trim());
  }
  if (row.length > 0) {
    rows.push(row);
  }

  return rows;
}

function parseValue(value) {
  if (value === '') return null;
  if (!isNaN(value) && value.trim() !== '') return Number(value);
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}

async function main() {
  console.log('Hello from the demo!');

  console.log('Loading and parsing the dataset...');
  
  const datasetUrl = './demo/assets/titanic.csv';

  const dataset = await loadAndParseDataset(datasetUrl);

  console.log('Dataset:', dataset);

  const dataTable = document.querySelector('data-table');

  console.log(dataTable);

  dataTable.headers = dataset.headers;
  dataTable.rows = dataset.data;
  dataTable.config = {
    widths: {
      'PassengerId': 100,
      'Survived': 100,
      'Pclass': 100,
      'Name': 200,
      'Sex': 100,
      'Age': 100,
      'SibSp': 100,
      'Parch': 100,
      'Ticket': 200,
      'Fare': 100,
      'Cabin': 200,
      'Embarked': 100
    },
    headerHeight: 40,
    rowHeight: 29,
    fontSize: 16,
    maxColWidth: 1000,
  }


  dataTable.render();
  setTimeout(() => {

    // dataTable.createHtml();
  }, 500)
  // setTimeout(() => {
  //   dataTable.render();
  // }, 1000)

  console.log('Dataset loaded and displayed!');
}

main();