const fs = require('fs');
const path = require('path');

/**
 * Recursively get all file paths in a directory with the specified extensions.
 * @param {string} dir - The directory to search.
 * @param {Array<string>} extensions - The file extensions to filter by (e.g., ['.js', '.txt']).
 * @returns {Array<string>} - An array of file paths.
 */
function getAllFilesWithExtensions(dir, extensions) {
    let results = [];

    // Read the contents of the directory
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        // Build the full path of the file
        const filePath = path.join(dir, file);
        
        // Get the file stats to check if it's a file or directory
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            // If it's a directory, recursively get files from this directory
            results = results.concat(getAllFilesWithExtensions(filePath, extensions));
        } else {
            // If it's a file, check if it has one of the desired extensions
            if (extensions.includes(path.extname(file))) {
                results.push(filePath);
            }
        }
    });

    return results;
}

// Example usage:
const dirPath = './contracts'; // Replace with your folder path
const extensions = ['.sol', '.js']; // Replace with your desired extensions
const files = getAllFilesWithExtensions(dirPath, extensions);

console.log(files);
