async function loadAndParseDataset(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();

    const { headers, data } = parseCSV(csvText);
    if (data.length === 0) {
      throw new Error("CSV file is empty or contains only headers");
    }

    return { headers, data };
  } catch (error) {
    console.error("Error loading or parsing the dataset:", error);
    throw error;
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let inQuotes = false;
  let currentValue = "";

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
    } else if (char === "," && !inQuotes) {
      row.push(currentValue);
      currentValue = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // Skip the \n in \r\n
      }
      if (currentValue !== "" || row.length > 0) {
        row.push(currentValue);
        rows.push(row);
        row = [];
        currentValue = "";
      }
    } else {
      currentValue += char;
    }
  }

  if (currentValue !== "" || row.length > 0) {
    row.push(currentValue);
    rows.push(row);
  }

  const headers = rows[0].map((header) => header.trim());
  const data = rows.slice(1).map((row) => {
    return headers.reduce((obj, header, index) => {
      const value = row[index] ? row[index].trim() : "";
      obj[header] = parseValue(value);
      return obj;
    }, {});
  });

  return { headers, data };
}

function parseValue(value) {
  if (value === "") return null;
  if (!isNaN(value) && value.trim() !== "") return Number(value);
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}

async function main() {
  console.log("Hello from the demo!");

  console.log("Loading and parsing the dataset...");

  const datasetUrl = "./demo/assets/titanic.csv";

  const dataset = await loadAndParseDataset(datasetUrl);

  console.log("Dataset:", dataset);

  const dataTable = document.querySelector("data-table");

  console.log(dataTable);

  dataTable.headers = dataset.headers;
  dataTable.rows = dataset.data;
  dataTable.config = {
    widths: {
      PassengerId: 100,
      Survived: 100,
      Pclass: 100,
      Name: 200,
      Sex: 100,
      Age: 100,
      SibSp: 100,
      Parch: 100,
      Ticket: 200,
      Fare: 100,
      Cabin: 200,
      Embarked: 100,
    },
    headerHeight: 40,
    rowHeight: 30,
    fontSize: 16,
    maxColWidth: 1000,
    rowColors: {
      Survived: {
        0: "pink",
        1: "lightgreen",
      },
    },
    scrollbarThickness: 20,
  };

  dataTable.render();

  console.log("Dataset loaded and displayed!");
}

main();
