const fs = require('fs');
const xml = fs.readFileSync('metadata.xml', 'utf8');
const lines = xml.split('<EntityType Name="');
console.log("Entity Types:");
for(let i=1; i<lines.length; i++){
  console.log(lines[i].substring(0, lines[i].indexOf('"')));
}
