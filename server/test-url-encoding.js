// Test script to verify URL encoding matches browser behavior
// This simulates the exact encoding logic from Login.jsx

function encodeAliasForUrl(alias) {
  // This is the exact logic from Login.jsx line 60-62
  // btoa(unescape(encodeURIComponent(alias)))
  // Then encodeURIComponent(base64Alias)
  
  // Step 1: encodeURIComponent(alias)
  const uriEncoded = encodeURIComponent(alias);
  
  // Step 2: unescape(uriEncoded) - converts %XX to character
  // In Node.js, we need to manually decode URI-encoded string to Latin-1
  const unescaped = uriEncoded.replace(/%([0-9A-F]{2})/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  // Step 3: btoa(unescaped) - base64 encode
  // Node.js Buffer.from with 'latin1' encoding mimics browser btoa behavior
  const base64Alias = Buffer.from(unescaped, 'latin1').toString('base64');
  
  // Step 4: encodeURIComponent(base64Alias) - URL encode the base64
  const encodedAlias = encodeURIComponent(base64Alias);
  
  return encodedAlias;
}

function decodeUrlToAlias(encodedAlias) {
  // This is the exact reverse logic from Login.jsx line 21-22
  // decodeURIComponent(urlAlias) -> atob -> escape -> decodeURIComponent
  
  // Step 1: decodeURIComponent to get base64 string
  const base64Alias = decodeURIComponent(encodedAlias);
  
  // Step 2: atob(base64Alias) - base64 decode
  const decoded = Buffer.from(base64Alias, 'base64').toString('latin1');
  
  // Step 3: escape(decoded) - convert characters to %XX format
  const escaped = decoded.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code < 128) {
      return encodeURIComponent(char);
    }
    return '%' + code.toString(16).toUpperCase().padStart(2, '0');
  }).join('');
  
  // Step 4: decodeURIComponent to get original alias
  const alias = decodeURIComponent(escaped);
  
  return alias;
}

// Test with a known alias
const testAlias = "Swift Spider";
const encoded = encodeAliasForUrl(testAlias);
const decoded = decodeUrlToAlias(encoded);

console.log('Test Encoding/Decoding:');
console.log('Original:', testAlias);
console.log('Encoded:', encoded);
console.log('Decoded:', decoded);
console.log('Match:', testAlias === decoded);

// Test what browser would generate
console.log('\n=== Browser-style encoding test ===');
console.log('Testing what browser btoa would produce...');

// Manual test of browser behavior simulation
const testCases = [
  "Swift Spider",
  "Normal Hawk",
  "Ominous Lizard"
];

testCases.forEach(alias => {
  const encoded = encodeAliasForUrl(alias);
  const url = `/login/${encoded}`;
  console.log(`${alias}: ${url}`);
});

