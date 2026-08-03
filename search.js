const fs = require('fs');
const lines = fs.readFileSync('C:/Users/danie/.gemini/antigravity/brain/700dfe9a-b770-4858-ab15-0c84db421761/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
for(let i=0; i<lines.length; i++){
  if(lines[i].includes('CRZ-PI')) {
    if(lines[i].includes('CS_ApprovalEntries')) {
      console.log('FOUND IN CS_ApprovalEntries:');
      console.log(lines[i].substring(0, 1000));
      break;
    }
  }
}
