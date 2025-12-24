
export const logActivity = async (supabase, { description, action, page, user, role }) => {
    if (!user || !user.id) return;

    try {

        let targetLogId = user.sessionLogId;

        // Fallback: If no session ID in state, try to find the most recent active session for this user
        if (!targetLogId) {
            const { data: recentLog } = await supabase
                .from('activity_logs')
                .select('id')
                .eq('user_id', user.id)
                .in('action', ['LOGIN', 'SESSION_ACTIVITY'])
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (recentLog) {
                targetLogId = recentLog.id;
            }
        }

        // RETRY STRATEGY:
        // If we didn't find a session ID, it might be a race condition (Login row not yet committed).
        // Wait 1500ms and try finding the session one more time before giving up and creating a new row.
        if (!targetLogId && action !== 'LOGIN') {
            await new Promise(r => setTimeout(r, 1500));

            const { data: retryLog } = await supabase
                .from('activity_logs')
                .select('id')
                .eq('user_id', user.id)
                .in('action', ['LOGIN', 'SESSION_ACTIVITY'])
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (retryLog) {
                targetLogId = retryLog.id;
            }
        }

        if (targetLogId) {
            const { data: currentLog, error: fetchError } = await supabase
                .from('activity_logs')
                .select('description')
                .eq('id', targetLogId)
                .single();

            // If fetch failed with actual error (not just 'not found'), abort to avoid duplicate "split brain" rows
            if (fetchError && fetchError.code !== 'PGRST116') {
                console.error("Error fetching session log:", fetchError);
                return;
            }

            if (currentLog) {
                const timestamp = new Date().toLocaleTimeString();
                const lines = currentLog.description ? currentLog.description.split('\n') : [];

                // Deduplicate: Compare last line content (ignoring the "X. Time - " prefix)
                const lastLine = lines[lines.length - 1] || '';
                const lastContent = lastLine.includes(' - ') ? lastLine.split(' - ')[1] : lastLine;

                // If the new action description matches the last one, skip (debounce/dedupe views)
                if ((description || '') === lastContent) {
                    return;
                }

                const nextIndex = lines.length + 1;
                const newEntry = `${nextIndex}. ${timestamp} - ${description || ''}`;

                const updatedDescription = currentLog.description
                    ? `${currentLog.description}\n${newEntry}`
                    : `1. ${description || ''}`;

                const { error: updateError } = await supabase
                    .from('activity_logs')
                    .update({
                        description: updatedDescription,
                        action: 'SESSION_ACTIVITY',
                        page: page || 'Multiple',
                        created_at: new Date().toISOString() // Update timestamp to show latest activity at top of sort
                    })
                    .eq('id', targetLogId);

                if (updateError) {
                    console.error("Failed to update session activity log:", updateError);
                }
                return;
            }
        }

        // Only insert a new row if we strictly don't have a session ID or the session row is confirmed missing
        // CRITICAL: Do NOT create standalone "VIEW" rows. Only standalone "LOGIN", "CREATE", "UPDATE", "DELETE" etc are allowed.
        // If it's a "VIEW" action and we couldn't find a session to attach to, we simply discard it to keep logs clean.
        if (action === 'VIEW') {
            return;
        }

        await supabase.from('activity_logs').insert([
            {
                user_id: user.id,
                role: (role || user.role || 'user').toLowerCase(),
                action: action || 'ACTION',
                page: page || 'Unknown Page',
                description: description || '',
                created_at: new Date().toISOString(),
            },
        ]);
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
};
