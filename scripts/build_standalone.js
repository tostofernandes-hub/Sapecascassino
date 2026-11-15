import fs from 'fs';
import path from 'path';

// Cleanly synchronize sapecas-cassino.html to public/sapecas-cassino.html
const htmlContent = fs.readFileSync(path.resolve('sapecas-cassino.html'), 'utf-8');
fs.mkdirSync(path.resolve('public'), { recursive: true });
fs.writeFileSync(path.resolve('public/sapecas-cassino.html'), htmlContent, 'utf-8');
console.log('Successfully generated sapecas-cassino.html and public/sapecas-cassino.html! File length:', htmlContent.length);
