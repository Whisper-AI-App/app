// scripts/generate-contributors.js
const fs = require('fs');
const path = require('path');

const GITHUB_API_URL = 'https://api.github.com/repos/Whisper-AI-App/app/contributors';
const MANUAL_FILE_PATH = path.join(__dirname, '../manual-contributors.json');
const OUTPUT_FILE_PATH = path.join(__dirname, '../assets/contributors.json');

async function generateContributors() {
  try {
    console.log('Fetching GitHub contributors...');
    
    // 1. Fetch code contributors (Requires Node 18+ for native fetch)
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'User-Agent': 'Whisper-AI-App-Build-Script'
      }
    });
    
    if (!response.ok) throw new Error(`GitHub API responded with ${response.status}`);
    const codeContributors = await response.json();

    // 2. Read manual contributors
    let manualContributors = [];
    if (fs.existsSync(MANUAL_FILE_PATH)) {
      const manualData = fs.readFileSync(MANUAL_FILE_PATH, 'utf-8');
      manualContributors = JSON.parse(manualData);
    }

   // 3. GitHub contributors first (by commit count), manual appended after
    const uniqueMap = new Map();
    
    codeContributors.forEach(contributor => {
      uniqueMap.set(contributor.login, {
        id: contributor.id,
        login: contributor.login,
        avatar_url: contributor.avatar_url,
        html_url: contributor.html_url,
      });
    });

    manualContributors.forEach(contributor => {
      if (!uniqueMap.has(contributor.login)) {
        uniqueMap.set(contributor.login, {
          id: contributor.id,
          login: contributor.login,
          avatar_url: contributor.avatar_url,
          html_url: contributor.html_url,
          type: contributor.type,
        });
      }
    });

    const finalContributorsList = Array.from(uniqueMap.values());

    // 4. Save to assets folder
    fs.writeFileSync(OUTPUT_FILE_PATH, JSON.stringify(finalContributorsList, null, 2));
    console.log(`Successfully generated ${finalContributorsList.length} contributors to assets/contributors.json`);

  } catch (error) {
    console.error('Failed to generate contributors:', error.message);
    process.exit(1);
  }
}

generateContributors();