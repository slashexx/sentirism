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
            const prData = await getAllPrDetails(context, app);
            app.log.info(JSON.stringify(prData), "Full PR data collected");

            const llmOutput = await handlePrAnalysis(context, prData , config.apiEndpoint , config.selectedModel, app);
            const stringllmOutput = await JSON.stringify(llmOutput);
            app.log.info(JSON.stringify(stringllmOutput), "LLM analysis complete");
            await reviewPR(context, app, llmOutput);
            // await reviewPR(context, app);
            
            // await handleKeployWorkflowTrigger(context);  
            await handleSecurityWorkflowTrigger(context);
            // await handleLintWorkflowTrigger(context);    
        } catch (error) {
            await handleError(context, app, error);
        }
    };

    app.on(["pull_request.opened", "pull_request.synchronize"], handlePrEvent);
};
