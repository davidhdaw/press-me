import { neon } from '@neondatabase/serverless';

// Neon database connection
const DATABASE_URL = 'postgresql://neondb_owner:npg_3goAkB0KtVQP@ep-blue-shadow-afze8ju2-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sql = neon(DATABASE_URL);

// Function to generate login URL from alias (matching Login.jsx logic exactly)
// Login.jsx line 60: btoa(unescape(encodeURIComponent(alias)))
// Login.jsx line 62: encodeURIComponent(base64Alias)
function generateLoginUrl(alias) {
  // Step 1: encodeURIComponent(alias) - URL encode the alias
  const uriEncoded = encodeURIComponent(alias);
  
  // Step 2: unescape(uriEncoded) - convert %XX to character (Latin-1)
  // This simulates browser's unescape() behavior
  const unescaped = uriEncoded.replace(/%([0-9A-F]{2})/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  // Step 3: btoa(unescaped) - base64 encode (browser uses Latin-1)
  // Node.js Buffer with 'latin1' encoding matches browser btoa() behavior
  const base64Alias = Buffer.from(unescaped, 'latin1').toString('base64');
  
  // Step 4: encodeURIComponent(base64Alias) - URL encode the base64 string
  const encodedAlias = encodeURIComponent(base64Alias);
  
  return `/login/${encodedAlias}`;
}

async function generateAllLoginUrls() {
  try {
    // Get all users from database
    const users = await sql`
      SELECT id, firstname, lastname, alias_1, alias_2, ishere 
      FROM users 
      ORDER BY firstname
    `;
    
    console.log('\n=== Login URLs for All Users ===\n');
    console.log('Format: /login/{base64-encoded-alias}');
    console.log('Alias format: "alias_1 alias_2" (with space)\n');
    console.log('─'.repeat(80));
    
    users.forEach((user, index) => {
      // Generate alias with space (primary format from Login.jsx)
      const alias = `${user.alias_1} ${user.alias_2}`;
      const loginUrl = generateLoginUrl(alias);
      
      console.log(`\n${index + 1}. ${user.firstname} ${user.lastname}`);
      console.log(`   Alias: ${user.alias_1} ${user.alias_2}`);
      console.log(`   URL: ${loginUrl}`);
      console.log(`   Active: ${user.ishere ? 'Yes' : 'No'}`);
    });
    
    console.log('\n' + '─'.repeat(80));
    console.log(`\nTotal users: ${users.length}`);
    console.log(`Active users: ${users.filter(u => u.ishere).length}\n`);
    
    // Also output a simple list format
    console.log('\n=== Simple URL List ===\n');
    users
      .filter(user => user.ishere)
      .forEach((user) => {
        const alias = `${user.alias_1} ${user.alias_2}`;
        const loginUrl = generateLoginUrl(alias);
        console.log(`${user.alias_1} ${user.alias_2}: ${loginUrl}`);
      });
    
  } catch (error) {
    console.error('Error generating login URLs:', error);
    process.exit(1);
  }
}

generateAllLoginUrls();
