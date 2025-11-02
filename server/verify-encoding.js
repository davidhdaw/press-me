// Verify encoding/decoding cycle matches browser behavior exactly

function encodeAliasForUrl(alias) {
  // Simulating browser: btoa(unescape(encodeURIComponent(alias)))
  // Then: encodeURIComponent(base64Alias)
  
  const uriEncoded = encodeURIComponent(alias);
  const unescaped = uriEncoded.replace(/%([0-9A-F]{2})/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  const base64Alias = Buffer.from(unescaped, 'latin1').toString('base64');
  const encodedAlias = encodeURIComponent(base64Alias);
  return encodedAlias;
}

function decodeUrlToAlias(encodedAlias) {
  // Simulating browser: decodeURIComponent -> atob -> escape -> decodeURIComponent
  
  const base64Alias = decodeURIComponent(encodedAlias);
  const decoded = Buffer.from(base64Alias, 'base64').toString('latin1');
  
  // escape() converts special chars to %XX (only for non-ASCII)
  const escaped = decoded.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code > 255) {
      return '%u' + code.toString(16).toUpperCase().padStart(4, '0');
    } else if (code > 127 || /[^a-zA-Z0-9@*_+\-./]/.test(char)) {
      return '%' + code.toString(16).toUpperCase().padStart(2, '0');
    }
    return char;
  }).join('');
  
  const alias = decodeURIComponent(escaped);
  return alias;
}

// Test with all aliases from the database
const testAliases = [
  "Swift Spider",
  "Normal Hawk",
  "Ominous Lizard",
  "Invisible Mouse",
  "Impossible Dealer",
  "Fast Jaguar",
  "Tranquil Diamond",
  "Exploding Panther",
  "Hidden Jewel",
  "Smooth Operator",
  "Ominous Hand",
  "Smooth Infiltrator"
];

console.log('=== Verifying Encoding/Decoding Round-trip ===\n');

let allMatch = true;
testAliases.forEach(alias => {
  const encoded = encodeAliasForUrl(alias);
  const decoded = decodeUrlToAlias(encoded);
  const matches = alias === decoded;
  
  if (!matches) {
    console.log(`❌ FAIL: ${alias}`);
    console.log(`   Encoded: ${encoded}`);
    console.log(`   Decoded: ${decoded}`);
    allMatch = false;
  }
});

if (allMatch) {
  console.log('✅ All encoding/decoding cycles match!');
  console.log('\n=== Final URL List (verified) ===\n');
  testAliases.forEach(alias => {
    const encoded = encodeAliasForUrl(alias);
    console.log(`${alias}: /login/${encoded}`);
  });
} else {
  console.log('\n⚠️  Some encodings failed verification!');
}

