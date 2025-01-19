const fs = require('fs');
const path = require('path');

// Configuración
const directoryPath = './'; // Directorio raíz del proyecto
const fileExtension = '.js'; // Extensión de archivo a buscar
const searchTerm = 'function'; // Palabra a reemplazar
const replaceTerm = 'export function'; // Nueva palabra
const scriptFileName = path.basename(__filename); // Nombre del script para excluirlo

// Función para reemplazar texto en un archivo
function replaceInFile(filePath, search, replace) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error leyendo el archivo ${filePath}:`, err);
            return;
        }

        // Reemplazar todas las ocurrencias
        const result = data.replace(new RegExp(search, 'g'), replace);

        fs.writeFile(filePath, result, 'utf8', (err) => {
            if (err) {
                console.error(`Error escribiendo el archivo ${filePath}:`, err);
            } else {
                console.log(`Reemplazo completado en: ${filePath}`);
            }
        });
    });
}

// Función para recorrer directorios y encontrar archivos
function traverseDirectory(directory) {
    fs.readdir(directory, { withFileTypes: true }, (err, files) => {
        if (err) {
            console.error(`Error leyendo el directorio ${directory}:`, err);
            return;
        }

        files.forEach((file) => {
            const filePath = path.join(directory, file.name);

            if (file.isDirectory()) {
                traverseDirectory(filePath); // Recursión para subdirectorios
            } else if (file.isFile() && file.name.endsWith(fileExtension) && file.name !== scriptFileName) {
                replaceInFile(filePath, searchTerm, replaceTerm);
            }
        });
    });
}

// Ejecutar script
traverseDirectory(directoryPath);
