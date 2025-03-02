// Deployments API example
// See: https://developer.github.com/v3/repos/deployments/ to learn more

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
import { getAllPrDetails } from "./pr.js";
import { handlePrAnalysis } from "./llm.js";
import { handleError } from "./utils.js";
import { promptUserConfig } from './src/cli.js';
import { reviewPR } from './diffparser.js';
import { handleSecurityWorkflowTrigger } from "./security.js";
import { handleLintWorkflowTrigger } from "./lint.js";

let config: any;

async function postDefaultComment(context: any, app: any) {
    const defaultComment = `## 🤖 PRism Bot Starting Analysis
    
Hello! I'm analyzing this PR for:
- 🔒 Security vulnerabilities
- 🎯 Code quality
- 📝 Best practices
- 🔬 Potential issues

Starting comprehensive scan...`;

    try {
        app.log.info('Posting default comment...');
        const response = await context.octokit.issues.createComment({
            ...context.repo(),
            issue_number: context.payload.pull_request.number,
            body: defaultComment
        });
        app.log.info('Default comment posted successfully:', response.data.url);
        return response;
    } catch (error) {
        app.log.error('Failed to post default comment:', error);
        throw error;
    }
}

export default async (app: any) => {
    // Initialize config first
    try {
        config = await promptUserConfig();
        if (!config) throw new Error('Configuration not initialized');
        app.log.info('Bot configuration:', JSON.stringify(config, null, 2));
    } catch (error) {
        app.log.error('Configuration error:', error);
    }

    app.on(['pull_request.opened', 'pull_request.synchronize'], async (context: any) => {
        app.log.info(`Processing PR #${context.payload.pull_request.number}`);
        
        try {
            await postDefaultComment(context, app);
            const prData = await getAllPrDetails(context, app);
            
            // Run all analyses in parallel
            const [llmOutput, securityResults, lintResults] = await Promise.all([
                handlePrAnalysis(context, prData, config.apiEndpoint, config.selectedModel, app),
                handleSecurityWorkflowTrigger(context),
                handleLintWorkflowTrigger(context)
            ]);

            await reviewPR(context, app, llmOutput);
        } catch (error) {
            app.log.error('Error processing PR:', error);
            await handleError(context, app, error);
        }
    });

    app.log.info('PRism bot initialized successfully');
};
