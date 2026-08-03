const fs = require('fs');
const xml = fs.readFileSync('metadata.xml', 'utf8');

const regex = /<EntityType Name="([^"]+)">([\s\S]*?)<\/EntityType>/g;
let match;
while ((match = regex.exec(xml)) !== null) {
  const entityName = match[1];
  const propsMatch = match[2].match(/<Property Name="[^"]+"/g);
  if (propsMatch) {
    const props = propsMatch.map(p => p.match(/Name="([^"]+)"/)[1]);
    const paymentProps = props.filter(p => p.toLowerCase().includes('payment') || p.toLowerCase().includes('schedule') || p.toLowerCase().includes('provision') || p.toLowerCase().includes('hold'));
    if (paymentProps.length > 0) {
      console.log(entityName + ': ' + paymentProps.join(', '));
    }
  }
}
