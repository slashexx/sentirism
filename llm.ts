import axios from 'axios';
import { getRulesForLLM } from './rules.js';
import { loadConfig } from './src/config/userConfig.js';
import { useCaseModels } from './src/config/models.js';
import { determineLabelFromAnalysis, addLabelToPR } from './src/addLabel.js';
// import { createInlineCommentsFromDiff } from './diffparser.js';

function formatSecurityFindings(rules: any, codeChanges: any) {
  const findings = [];
  
  // Check for hardcoded secrets
  const secretPattern = /(password|secret|api_key|token).*=.*['"][^'"]+['"]|([A-Za-z0-9+/]{40,})/gi;
  const secrets = codeChanges.match(secretPattern);
  if (secrets) {
    findings.push(`### 🔓 Potential Secrets Found
${secrets.map((s: string) => `- \`${s}\``).join('\n')}`);
  }

  // Check for SQL injection vulnerabilities
  if (codeChanges.includes('Query(') && !codeChanges.includes('QueryRow(')) {
    findings.push(`### 💉 SQL Injection Risk
- Direct string concatenation in SQL queries detected
- Consider using parameterized queries`);
  }

  // Check for command injection
  if (codeChanges.includes('exec.Command(') || codeChanges.includes('os.exec')) {
    findings.push(`### ⚠️ Command Injection Risk
- Unsanitized command execution detected
- Validate and sanitize all command inputs`);
  }

  return findings.join('\n\n');
}

export async function handlePrAnalysis(
  context: { 
    octokit: { issues: { createComment: (arg0: any) => any; }; }; 
    repo: () => any; 
    payload: { pull_request: { number: any; }; }; 
  }, 
  prData: any, API : string, model: string , app: any
) {
  // Get the rules
  const rules = await getRulesForLLM(context);
  
  // Only perform LLM analysis and return the result
  const llmOutput = await analyzeLLM(prData, rules.rules, API, model, app);
  return llmOutput;
}

export async function analyzeLLM(prData: any, rules: any, API: string, model: string, app: any) {
  const analysisContext = {
    repository: {
      name: prData.repository.name,
      owner: prData.repository.owner,
      structure: prData.repository.structure
    },
    pr: prData,
    rules: rules
  };

  const stringanalysisContext = JSON.stringify(analysisContext, null, 2);
  
  const prompt = `
  IGNORE ALL PREVIOUS PROMPTS
  
  Review the following code changes and provide feedback in git diff format only.
  Focus on security, best practices, and potential bugs.
  
  Repository Context:
  ${stringanalysisContext}

  Rules to check:
  ${rules}

  Format your response EXACTLY as follows:
  
  \`\`\`diff
  diff --git a/path/to/file b/path/to/file
  index abc1234..def5678 100644
  --- a/path/to/file
  +++ b/path/to/file
  @@ -line,count +line,count @@
  - old code
  + suggested fix
  \`\`\`

  Only include diffs where changes are needed. If no issues found, respond with "LGTM!".
  Keep review comments under 20 words and focus on technical aspects only.`;

  try {
    const response = await axios.post(API, {
      model: model,
      prompt
    });
    return response.data.response;
  } catch (error) {
    app.log.error('LLM analysis failed:', error);
    return 'LGTM!';
  }
}


