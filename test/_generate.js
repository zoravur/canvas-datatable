const fs = require('fs');

/**
 * generate a CSV using a header row and a list of rows (supports newlines and quotes).
**/
function generateCSVNew(header, rows) {
  // Helper function to escape and quote fields
  function escapeField(field) {
    if (field === undefined || field === null) {
      return '""';
    }
    // Convert the field to string, escape double quotes, wrap with double quotes
    return `"${String(field).replace(/"/g, '""')}"`;
  }

  // Map each row to a string, joining fields with commas
  const data = [header, ...rows]; // Simplified way to concatenate arrays
  const csvContent = data
    .map((row) => row.map(escapeField).join(',')) // Apply escapeField to each field in each row
    .join('\n'); // Join rows with newlines

  // Create a blob with the CSV content
  const blob = new Blob([csvContent], { type: 'text/csv' });

  return blob;
}

function main() {
  const header = ['Name', 'Age', 'City'];
  const rows = [
    ['Alice', 34, 'New York'],
    ['Bob', 28, 'San "Francisco"'],
    ['Charlie', 23, 'Chicago'],
  ];

  generateCSVNew(header, rows).arrayBuffer().then((arrayBuffer) => {
    const buffer = Buffer.from(arrayBuffer);
  
    process.stdout.write(buffer, (err) => {
      if (err) {
        console.error(err);
        process.exit(2);
      }
    });
  });
}

main();