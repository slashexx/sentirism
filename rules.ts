import * as fs from 'fs/promises';
import * as path from 'path';

export async function getRulesForLLM(context: any) {
    const { owner, repo } = context.repo();
    const { ref } = context.payload.pull_request.head;
    
    try {
        // Try to get repo-specific rules
        const response = await context.octokit.repos.getContent({
            owner,
            repo,
            path: 'yara-rules',
            ref
        });

        let yaraRules = '';
        
        if (Array.isArray(response.data)) {
            // Fetch and combine all .yar files
            for (const file of response.data) {
                if (path.extname(file.name) === '.yar') {
                    const ruleContent = await context.octokit.repos.getContent({
                        owner,
                        repo,
                        path: file.path,
                        ref
                    });
                    yaraRules += Buffer.from(ruleContent.data.content, 'base64').toString() + '\n';
                }
            }
        }

        // If no rules found, use default rules
        if (!yaraRules) {
            yaraRules = await fs.readFile(path.join(__dirname, 'yara-rules', 'default.yar'), 'utf8');
        }

        return {
            success: true,
            rules: yaraRules,
            metadata: {
                ref,
                repo: `${owner}/${repo}`,
                type: 'yara',
                timestamp: new Date().toISOString()
            }
        };
    } catch (error: any) {
        // Use default rules on error
        try {
            const defaultRules = await fs.readFile(path.join(__dirname, 'yara-rules', 'default.yar'), 'utf8');
            return {
                success: true,
                rules: defaultRules,
                metadata: {
                    ref,
                    repo: `${owner}/${repo}`,
                    type: 'yara',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (fallbackError) {
            return {
                success: false,
                error: 'Failed to load rules',
                metadata: {
                    ref,
                    repo: `${owner}/${repo}`,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
}