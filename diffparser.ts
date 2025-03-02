// diffParser.ts
import parseDiff from 'parse-diff';

async function parseGitDiffFromLLMOutput(llmOutput: any) {
    const diffStart = llmOutput.indexOf('```diff');
    const diffEnd = llmOutput.indexOf('```', diffStart + 1);
    return llmOutput.substring(diffStart, diffEnd);
}

export async function reviewPR(context: any, app: any, llmOutput: any) {
    if (!llmOutput) {
        app.log.error('No LLM output received');
        await context.octokit.issues.createComment({
            ...context.repo(),
            issue_number: context.payload.pull_request.number,
            body: '❌ Error: No analysis output received'
        });
        return;
    }

    try {
        // Always post the LLM output first
        await context.octokit.issues.createComment({
            ...context.repo(),
            issue_number: context.payload.pull_request.number,
            body: '## Analysis Results\n\n' + llmOutput
        });

        const ifLGTM = llmOutput.includes('LGTM');
        if (ifLGTM) {
            await context.octokit.issues.createComment({
                ...context.repo(),
                issue_number: context.payload.pull_request.number,
                body: '✅ LGTM: Code looks good!'
            });
            return;
        }

        // Try to parse and create diff comments
        const gitDiff = await parseGitDiffFromLLMOutput(llmOutput);
        if (gitDiff) {
            await createInlineCommentsFromDiff(gitDiff, context, app);
        }

    } catch (error: any) {
        app.log.error('Error in reviewPR:', error);
        await context.octokit.issues.createComment({
            ...context.repo(),
            issue_number: context.payload.pull_request.number,
            body: `❌ Error during review: ${error.message}`
        });
    }
}

export async function createInlineCommentsFromDiff(diff: string, context: any, app: any) {
    const parsedFiles = parseDiff(diff);
    const { pull_request, repository } = context.payload;

    for (const file of parsedFiles) {
        if (file.to === '/dev/null') {
            app.log.info(`Skipping deleted file: ${file.from}`);
            continue;
        }

        const filePath = file.to || file.from;

        for (const chunk of file.chunks) {
            for (const change of chunk.changes) {
                if (change.type !== 'add') continue; // Focus on additions for comments

                const line = change.ln; // Line number in the new file
                const content = change.content.slice(1).trim();
                const body = `Suggested change:\n\`\`\`suggestion\n${content}\n\`\`\``;

                try {
                    await context.octokit.pulls.createReviewComment({
                        owner: repository.owner.login,
                        repo: repository.name,
                        pull_number: pull_request.number,
                        commit_id: pull_request.head.sha,
                        path: filePath,
                        body,
                        line,
                        mediaType: {
                            previews: ['comfort-fade'], // Enable comfort-fade preview
                        },
                    });
                    app.log.info(`Created comment on ${filePath} line ${line}`);
                } catch (error: any) {
                    app.log.error(
                        `Failed to create comment for ${filePath} line ${line}: ${error.message}`
                    );
                }
            }
        }
    }
}