

const N8N_WEBHOOK_URL = 'https://n8n.urlfactory.website/webhook/chatbotanswerainmnow';

export async function sendWebhook(payload) {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`Webhook failed with status ${response.status}: ${await response.text()}`);
    } else {
      console.log(`[Webhook] Successfully sent data to n8n:`, payload);
    }
  } catch (err) {
    console.error('Failed to dispatch webhook to n8n:', err.message);
  }
}
