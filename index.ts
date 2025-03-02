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
    log: { info: (arg0: string, arg1?: any) => void; error: (arg0: string, arg1?: any) => void };
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
            // Post default comment first thing
            await postDefaultComment(context);

            const prData = await getAllPrDetails(context, app);
            app.log.info('PR data collected:', JSON.stringify(prData));

            if (!config || !config.apiEndpoint || !config.selectedModel) {
                throw new Error('Missing configuration. Please run setup again.');
            }

            const llmOutput = await handlePrAnalysis(context, prData, config.apiEndpoint, config.selectedModel, app);
            app.log.info('LLM analysis complete:', JSON.stringify(llmOutput));

            await reviewPR(context, app, llmOutput);
            
            // Run additional checks
            await Promise.all([
                handleSecurityWorkflowTrigger(context),
                handleLintWorkflowTrigger(context)
            ]);

        } catch (error) {
            app.log.info('Error in handlePrEvent:');
            await handleError(context, app, error);
        }
    };

    // Only post default comment on PR open, not on synchronize
    app.on(["pull_request.opened", "pull_request.synchronize"], async (context) => {
        await postDefaultComment(context);
    });

    // Regular processing for both events
    app.on(["pull_request.opened", "pull_request.synchronize"], handlePrEvent);
};
