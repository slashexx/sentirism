export function formatComment(comment : any) {
    return {
      id: comment.id,
      user: comment.user?.login,
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      url: comment.html_url
    };
  }

  // Error handler
export async function handleError(context: any, app: any, error: any) {
    app.log.error('=== ERROR HANDLER START ===');
    app.log.error('Error:', error);
    
    try {
        const errorMessage = `❌ Error processing PR:
\`\`\`
${error.message}
${error.stack}
\`\`\`
Please check the bot logs for more details.`;

        const response = await context.octokit.issues.createComment({
            ...context.repo(),
            issue_number: context.payload.pull_request.number,
            body: errorMessage
        });
        
        app.log.info('Error comment posted:', response.data.url);
    } catch (commentError) {
        app.log.error('Failed to post error comment:', commentError);
    }
    
    app.log.error('=== ERROR HANDLER END ===');
}
