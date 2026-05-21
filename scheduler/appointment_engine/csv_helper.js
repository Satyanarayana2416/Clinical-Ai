const fs = require('fs');
const path = require('path');

/**
 * Parses CSV string content into an array of objects
 */
function parseCsv(content) {
    const lines = [];
    let currentLine = [];
    let currentVal = '';
    let inQuotes = false;
    
    // Normalize newlines
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        
        if (inQuotes) {
            if (char === '"') {
                // Escaped double-quotes inside quotes
                if (i + 1 < normalized.length && normalized[i + 1] === '"') {
                    currentVal += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = false;
                }
            } else {
                currentVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentLine.push(currentVal.trim());
                currentVal = '';
            } else if (char === '\n') {
                currentLine.push(currentVal.trim());
                currentVal = '';
                lines.push(currentLine);
                currentLine = [];
            } else {
                currentVal += char;
            }
        }
    }
    
    if (currentVal || currentLine.length > 0) {
        currentLine.push(currentVal.trim());
        lines.push(currentLine);
    }
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].map(h => h.trim());
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0 || (line.length === 1 && !line[0])) continue;
        
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = line[idx] !== undefined ? line[idx] : '';
        });
        results.push(row);
    }
    return results;
}

/**
 * Converts an array of objects into a CSV string content
 */
function writeCsv(headers, rows) {
    const headerLine = headers.join(',');
    const dataLines = rows.map(row => {
        return headers.map(header => {
            let val = row[header] !== undefined ? row[header] : '';
            val = String(val);
            // Escape quotes and wrap in quotes if it has special characters
            if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',');
    });
    return [headerLine, ...dataLines].join('\n');
}

/**
 * Loads and parses a CSV file
 */
function readCsvFile(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return parseCsv(content);
    } catch (e) {
        console.error(`Error reading CSV file ${filePath}:`, e);
        return [];
    }
}

/**
 * Saves rows into a CSV file
 */
function writeCsvFile(filePath, headers, rows) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const content = writeCsv(headers, rows);
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    } catch (e) {
        console.error(`Error writing CSV file ${filePath}:`, e);
        return false;
    }
}

module.exports = {
    parseCsv,
    writeCsv,
    readCsvFile,
    writeCsvFile
};
