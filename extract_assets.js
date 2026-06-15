const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const cssDir = path.join(publicDir, 'css');
const jsDir = path.join(publicDir, 'js');

// Ensure directories exist
if (!fs.existsSync(cssDir)) fs.mkdirSync(cssDir);
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir);

const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const baseName = path.basename(file, '.html');
    
    // 1. Extract Styles
    let cssContent = '';
    const styleRegex = /<style>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    let styleReplaced = false;
    
    while ((styleMatch = styleRegex.exec(content)) !== null) {
        cssContent += styleMatch[1].trim() + '\n\n';
    }
    
    if (cssContent) {
        fs.writeFileSync(path.join(cssDir, `${baseName}.css`), cssContent);
        // Replace first style tag with link, remove the rest
        content = content.replace(styleRegex, (match, p1, offset, string) => {
            if (!styleReplaced) {
                styleReplaced = true;
                return `<link rel="stylesheet" href="css/${baseName}.css" />`;
            }
            return '';
        });
    }

    // 2. Extract Scripts (ignore those with src)
    let jsContent = '';
    // Regex matches <script> ... </script> but NOT <script src="...">
    const scriptRegex = /<script(?![^>]*src=)>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    let scriptReplaced = false;

    while ((scriptMatch = scriptRegex.exec(content)) !== null) {
        jsContent += scriptMatch[1].trim() + '\n\n';
    }

    if (jsContent) {
        fs.writeFileSync(path.join(jsDir, `${baseName}.js`), jsContent);
        content = content.replace(scriptRegex, (match, p1, offset, string) => {
            if (!scriptReplaced) {
                scriptReplaced = true;
                return `<script src="js/${baseName}.js"></script>`;
            }
            return '';
        });
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed ${file}: extracted CSS (${cssContent.length > 0}), extracted JS (${jsContent.length > 0})`);
});
