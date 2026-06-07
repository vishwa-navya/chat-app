export interface Message {
  role: string;
  content: string;
}

export async function getAIResponse(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Message[]
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase ENV missing');
    return "Configuration error: missing Supabase setup.";
  }

  const apiUrl = `${supabaseUrl}/functions/v1/avatar-chat`;

  try {
    // ✅ NEW: Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        message: userMessage,
        systemPrompt: systemPrompt,
        conversationHistory: conversationHistory,
        provider: 'openai'
      }),
      signal: controller.signal, // ✅ NEW: Add abort signal
    });

    clearTimeout(timeoutId); // ✅ NEW: Clear timeout on successful response

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `Server error: ${response.status}`;

      if (contentType?.includes('application/json')) {
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
      }

      console.error('Avatar-chat API Error:', errorMessage);
      return errorMessage;
    }

    const data = await response.json();
    return data.response || 'I apologize, but I could not form a response.';
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        console.error('Request timeout:', err);
        return "Request timed out. Please try again.";
      }
      console.error('Error getting AI response:', err.message);
      return `Network error: ${err.message}`;
    }
    console.error('Unknown error:', err);
    return "Network error: Unable to contact AI service.";
  }
}
