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
    const defaultComment = `## 🤖 PRism Bot Analysis Started
    
Hello! I'm PRism Bot and I'll be analyzing this PR.

### What I'm checking:
- 📝 Code quality and conventions
- 🔒 Security considerations
- 🧹 Linting issues
- 📚 Documentation updates

Please wait while I review your changes...

---
_This is an automated message. I'll post my analysis results shortly._`;

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

export default async (app: {
    log: { info: (arg0: string, arg1?: any) => void; error: (arg0: string, arg1?: any) => void };
    on: (arg0: string | string[], arg1: (context: any) => Promise<void>) => void;
}) => {
    // Initialize config first
    try {
        config = await promptUserConfig();
        if (!config) throw new Error('Configuration not initialized');
        app.log.info('Bot configuration:', JSON.stringify(config, null, 2));
    } catch (error) {
        app.log.error('Configuration error:', error);
    }

    // Handle PR opened event
    app.on('pull_request.opened', async (context) => {
        app.log.info(`New PR opened: #${context.payload.pull_request.number}`);
        try {
            await postDefaultComment(context, app);
        } catch (error) {
            app.log.error('Error in PR opened handler:', error);
        }
    });

    // Handle PR synchronize event
    app.on('pull_request.synchronize', async (context) => {
        app.log.info(`PR synchronized: #${context.payload.pull_request.number}`);
        try {
            const prData = await getAllPrDetails(context, app);
            const llmOutput = await handlePrAnalysis(context, prData, config.apiEndpoint, config.selectedModel, app);
            await reviewPR(context, app, llmOutput);
        } catch (error) {
            app.log.error('Error in PR sync handler:', error);
            await handleError(context, app, error);
        }
    });

    app.log.info('PRism bot initialized successfully');
};
