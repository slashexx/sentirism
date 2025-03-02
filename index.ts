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

// Add this new function for the default comment
async function postDefaultComment(context: any) {
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
        await context.octokit.issues.createComment({
            ...context.repo(),
            issue_number: context.payload.pull_request.number,
            body: defaultComment
        });
    } catch (error) {
        context.log.error('Failed to post default comment:', error);
    }
}

export default async (app: {
    log: { info: (arg0: string, arg1?: string) => void, error: (arg0: string, arg1?: string) => void };

    on: (arg0: string[], arg1: (context: any) => Promise<void>) => void;
}) => {
    try {
        // Get user configuration through CLI
        config = await promptUserConfig();
        // selectedModel = config.model;
        app.log.info(`Initialized with API url: ${config.apiEndpoint} for use case: ${config.useCase} and model : ${config.selectedModel}`);
    } catch (error) {
        app.log.info("Failed to get user configuration");
    }

    app.log.info("Yay, the app was loaded!");

    const handlePrEvent = async (context: any) => {
        try {
            // First comment to confirm the bot is working
            await context.octokit.issues.createComment({
                ...context.repo(),
                issue_number: context.payload.pull_request.number,
                body: '🤖 PRism bot is analyzing your PR...'
            }).catch(error => app.log.error('Failed to post initial comment:', error));

            const prData = await getAllPrDetails(context, app);
            if (!prData) {
                throw new Error('Failed to get PR details');
            }

            if (!config || !config.apiEndpoint || !config.selectedModel) {
                throw new Error('Missing configuration. Please run setup again.');
            }

            // Add debug logging
            app.log.info('Config:', JSON.stringify(config));
            app.log.info('PR Data:', JSON.stringify(prData));

            const llmOutput = await handlePrAnalysis(context, prData, config.apiEndpoint, config.selectedModel, app);
            if (!llmOutput) {
                throw new Error('No output from LLM analysis');
            }

            await reviewPR(context, app, llmOutput);

            // Run additional checks
            await Promise.all([
                handleSecurityWorkflowTrigger(context),
                handleLintWorkflowTrigger(context)
            ]);

        } catch (error: any) {
            app.log.error('Error in handlePrEvent:', error);
            // Ensure error message is posted to PR
            await context.octokit.issues.createComment({
                ...context.repo(),
                issue_number: context.payload.pull_request.number,
                body: `❌ Error processing PR: ${error.message}`
            }).catch(e => app.log.error('Failed to post error comment:', e));
        }
    };

    // Only post default comment on PR open, not on synchronize
    app.on(["pull_request.opened", "pull_request.synchronize"], async (context) => {
        await postDefaultComment(context);
    });

    // Regular processing for both events
    app.on(["pull_request.opened", "pull_request.synchronize"], handlePrEvent);
};
