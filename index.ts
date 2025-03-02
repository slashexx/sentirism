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

export default async (app: {
    log: { info: (arg0: string, arg1?: string) => void };
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
            // Log the start of processing
            await context.octokit.issues.createComment({
                ...context.repo(),
                issue_number: context.payload.pull_request.number,
                body: '🚀 Starting PR analysis...'
            });

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

    app.on(["pull_request.opened", "pull_request.synchronize"], handlePrEvent);
};
