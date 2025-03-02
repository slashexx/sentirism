// diffParser.ts
import parseDiff from 'parse-diff';

export async function reviewPR(context: any, app: any, llmOutput: string) {
    if (llmOutput.includes('LGTM')) {
        await context.octokit.issues.createComment({
            ...context.repo(),
            issue_number: context.payload.pull_request.number,
            body: '✅ Code review passed: LGTM!'
        });
        return;
    }

    const diffStart = llmOutput.indexOf('```diff');
    const diffEnd = llmOutput.indexOf('```', diffStart + 6);
    const cleanDiff = llmOutput.substring(diffStart + 6, diffEnd).trim();

    const files = parseDiff(cleanDiff);
    const { pull_request } = context.payload;

    for (const file of files) {
        const filePath = file.to;
        if (!filePath) continue;

        for (const chunk of file.chunks) {
            for (const change of chunk.changes) {
                if (change.type === 'add' && change.content.startsWith('+')) {
                    try {
                        await context.octokit.pulls.createReviewComment({
                            ...context.repo(),
                            pull_number: pull_request.number,
                            commit_id: pull_request.head.sha,
                            path: filePath,
                            line: change.ln,
                            body: `Suggested change:\n\`\`\`suggestion\n${change.content.substring(1)}\n\`\`\``,
                        });
                    } catch (error) {
                        app.log.error(`Failed to create review comment: ${error}`);
                    }
                }
            }
        }
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